from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from sqlalchemy import case, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.enums import InvoiceStatus
from src.core.logger import get_logger
from src.core.settings import settings
from src.models.tw import InvoiceResponse
from src.models.users import CreateUserRequest, UserProfileResponse
from src.models.xui import ClientResponse, CreateClientRequest
from src.schemas.invoices import Invoice
from src.schemas.users import User
from src.services.jwt import JwtService, get_jwt_service
from src.services.xui import XuiService, get_xui_service

logger = get_logger()


@dataclass
class UserService:
    jwt_service: JwtService
    xui_service: XuiService

    async def create(self, db: AsyncSession, user: CreateUserRequest) -> str:
        token_position = 0
        await self.xui_service.add_client_to_inbounds(
            CreateClientRequest(
                email=user.username,
                comment=user.mark,
                total_gb=user.total_gb,
                expiry_time_days=user.expiry_time_days,
                limit_ips=user.limit_ips,
                enable=user.enable,
            )
        )
        xui_client = await self.xui_service.get_client_by_email(user.username)
        if xui_client is None:
            raise HTTPException(status_code=400, detail="Failed to create XUI client")

        db_user = User(
            username=user.username,
            role=user.role,
            mark=user.mark,
            sub_url=xui_client.sub_url,
            token_position=token_position,
        )
        db.add(db_user)
        await db.flush()
        await db.commit()
        jwt_data = {
            "sub": str(db_user.id),
            "role": str(db_user.role),
            "exp": (datetime.now() + timedelta(days=settings.app.jwt_exp_days)).timestamp(),
            "token_position": token_position,
        }
        logger.debug(f"Create user with: {jwt_data}")
        jwt_token = await self.jwt_service.encode(jwt_data)
        return jwt_token

    async def get_by_id(self, db: AsyncSession, id: int) -> User | None:
        result = await db.execute(select(User).where(User.id == id))
        return result.scalar_one_or_none()

    async def get_user_profile_by_id(self, db: AsyncSession, id: int) -> UserProfileResponse:
        user = await self.get_by_id(db, id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        invoices = await db.execute(
            select(Invoice)
            .where(Invoice.user_id == id)
            .order_by(
                case((Invoice.status == InvoiceStatus.PENDING, 0), else_=1),
                Invoice.created_at.desc(),
            )
            .limit(3)
        )
        invoices = invoices.scalars().all()
        return UserProfileResponse(
            id=user.id,
            username=user.username,
            role=user.role,
            sub_url=user.sub_url,
            invoices=[InvoiceResponse.model_validate(invoice) for invoice in invoices],
        )

    async def delete(self, db: AsyncSession, id: int) -> int:
        user = await self.get_by_id(db, id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        await db.delete(user)
        await db.commit()
        return id

    async def refresh_token(self, db: AsyncSession, id: int) -> str:
        user = await self.get_by_id(db, id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        token_position = user.token_position + 1
        user.token_position = token_position
        await db.flush()
        await db.commit()
        jwt_data = {
            "sub": str(user.id),
            "role": str(user.role),
            "exp": (datetime.now() + timedelta(days=settings.app.jwt_exp_days)).timestamp(),
            "token_position": token_position,
        }
        logger.debug(f"Refresh token for user {user.id} with: {jwt_data}")
        jwt_token = await self.jwt_service.encode(jwt_data)
        return jwt_token

    async def get_xui_user_profile_by_id(self, db: AsyncSession, id: int) -> ClientResponse:
        user = await self.get_by_id(db, id)
        if user is None:
            raise HTTPException(status_code=404, detail="User not found")
        xui_client = await self.xui_service.get_client_by_email(user.username)
        if xui_client is None:
            raise HTTPException(status_code=400, detail="User not found in XUI")
        return ClientResponse.model_validate(xui_client)


def get_user_service(
    jwt_service: JwtService = Depends(get_jwt_service), xui_service: XuiService = Depends(get_xui_service)
) -> UserService:
    return UserService(jwt_service=jwt_service, xui_service=xui_service)
