from fastapi import APIRouter, Depends

from src.core.deps import require_roles
from src.core.enums import Role, ServiceStatus
from src.core.logger import get_logger
from src.core.settings import settings
from src.services.tw import TimeWebService, get_timeweb_service
from src.services.xui import XuiService, get_xui_service

router = APIRouter(prefix="/api", tags=["root"], dependencies=[Depends(require_roles(Role.USER, Role.ADMIN, Role.SUPERUSER))])


logger = get_logger()


@router.get("/status")
async def read_root(
    xui_service: XuiService = Depends(get_xui_service),
    timeweb_service: TimeWebService = Depends(get_timeweb_service),
) -> dict:
    try:
        xui_version = await xui_service.get_version()
        xui_status = ServiceStatus.OK
    except Exception as e:
        logger.error(f"Error getting XUI version: {e}")
        xui_version = "0.0.0"
        xui_status = ServiceStatus.ERROR

    try:
        timeweb_status = await timeweb_service.get_status()
    except Exception as e:
        logger.error(f"Error getting TimeWeb status: {e}")
        timeweb_status = ServiceStatus.ERROR

    return {
        "API": {
            "version": settings.app.version,
            "status": ServiceStatus.OK,
        },
        "XUI": {
            "version": xui_version,
            "status": xui_status,
        },
        "TimeWeb": {
            "status": timeweb_status,
        },
        "avilable_statuses": list(ServiceStatus),
    }
