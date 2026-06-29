from dataclasses import dataclass
from datetime import datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.enums import InvoiceStatus, ServiceStatus
from src.core.logger import logger
from src.core.settings import settings
from src.models.tw import FinancesResponse, InvoiceResponse, PaymentResponse
from src.schemas.invoices import Invoice


@dataclass
class TimeWebService:
    base_url: str
    token: str
    timeout: int

    async def get_status(self) -> ServiceStatus:
        url = f"{self.base_url}/account/status"
        headers = {
            "Authorization": f"Bearer {self.token}",
        }
        response = await AsyncClient(timeout=self.timeout).get(url, headers=headers)
        response.raise_for_status()
        return ServiceStatus.OK

    async def get_finances(self) -> FinancesResponse:
        url = f"{self.base_url}/account/finances"
        logger.debug(f"tw token: {self.token[:10]}...")
        headers = {
            "Authorization": f"Bearer {self.token}",
        }
        response = await AsyncClient(timeout=self.timeout).get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        return FinancesResponse(
            balance=data["finances"]["balance"],
            currency=data["finances"]["currency"],
            monthly_cost=data["finances"]["monthly_cost"],
            total_paid=data["finances"]["total_paid"],
            hours_left=data["finances"]["hours_left"],
        )

    async def new_invoice(
        self, db: AsyncSession, user_id: int, amount: int, return_url: str, fail_url: str
    ) -> InvoiceResponse:
        db_invoice = await db.execute(
            select(Invoice).where(Invoice.user_id == user_id, Invoice.status == InvoiceStatus.PENDING)
        )
        invoice = db_invoice.scalar_one_or_none()
        if invoice is not None:
            return InvoiceResponse.model_validate(invoice)

        url = f"{settings.timeweb.portal_url}/invoices"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            **settings.timeweb.default_headers,
        }
        payload = {
            "total_amount": amount,
            "payer": {"id": settings.timeweb.payer_id},
            "payment_method": {
                "type": "card",
                "params": {
                    "bind": False,
                    "return_url": return_url,
                    "fail_url": fail_url,
                },
            },
            "items": [],
        }
        response = await AsyncClient(timeout=self.timeout).post(
            url,
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

        invoice = Invoice(
            invoice_id=int(data["invoice_id"]),
            user_id=user_id,
            payment_uuid=data["payment_info"]["id"],
            confirmation_url=data["payment_info"]["confirmation"]["confirmation_url"],
            amount=amount,
            status=InvoiceStatus.PENDING,
        )
        db.add(invoice)
        await db.commit()
        return InvoiceResponse(
            invoice_id=invoice.invoice_id,
            user_id=invoice.user_id,
            payment_uuid=invoice.payment_uuid,
            confirmation_url=invoice.confirmation_url,
            status=invoice.status,
            created_at=invoice.created_at,
            updated_at=invoice.updated_at,
        )

    async def get_payments(self) -> list[PaymentResponse]:
        url = f"{settings.timeweb.api_url}/accounts/payments?limit=1000&offset=0&locale=ru"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            **settings.timeweb.default_headers,
        }
        response = await AsyncClient(timeout=self.timeout).get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        payments = data["payments"]
        return [PaymentResponse.model_validate(payment) for payment in payments if payment["type"] == "incom"]

    async def check_invoices(self, db: AsyncSession) -> list[InvoiceResponse]:
        payments = await self.get_payments()
        logger.debug(f"Found payments: {payments}")
        payed_invoices = []
        for payment in payments:
            invoice = await db.execute(select(Invoice).where(Invoice.invoice_id == payment.invoice))
            invoice = invoice.scalar_one_or_none()
            if invoice is not None:
                if invoice.created_at < datetime.now() - timedelta(hours=1):
                    invoice.status = InvoiceStatus.CANCELLED
                    await db.commit()
                    logger.debug(f"Cancelled invoice {invoice.invoice_id} because it was created more than 1 hour ago")
                    continue
                invoice.status = InvoiceStatus.PAID
                logger.debug(f"Set invoice {invoice.invoice_id} status to PAID")
                await db.commit()
                payed_invoices.append(invoice)

        return [InvoiceResponse.model_validate(invoice) for invoice in payed_invoices]


async def get_timeweb_service() -> TimeWebService:
    return TimeWebService(
        base_url=settings.timeweb.base_url,
        token=settings.timeweb.token,
        timeout=settings.app.request_timeout,
    )
