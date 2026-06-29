from fastapi import APIRouter

from src.core.settings import settings

router = APIRouter(tags=["meta"])


@router.get("/api/config")
async def app_config() -> dict[str, str | int]:
    return {
        "version": settings.app.version,
        "min_invoice_amount": settings.app.min_invoice_amount,
        "max_invoice_amount": settings.app.max_invoice_amount,
        "default_expiry_time_days": settings.app.default_expiry_time_days,
    }
