from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
FRONTEND_DIST = STATIC_DIR / "dist"

router = APIRouter(tags=["frontend"])


def frontend_dist_ready() -> bool:
    return (FRONTEND_DIST / "index.html").is_file()


def _index_response() -> FileResponse:
    if frontend_dist_ready():
        return FileResponse(FRONTEND_DIST / "index.html")
    return FileResponse(STATIC_DIR / "index.html")


@router.get("/", include_in_schema=False)
async def index() -> FileResponse:
    return _index_response()


def register_frontend(app: FastAPI) -> None:
    if frontend_dist_ready():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="frontend-assets")
    else:
        app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="legacy-assets")

    app.include_router(router)

    if not frontend_dist_ready():
        return

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str) -> FileResponse:
        file_path = (FRONTEND_DIST / full_path).resolve()
        dist_root = FRONTEND_DIST.resolve()

        if not str(file_path).startswith(f"{dist_root}/") and file_path != dist_root:
            raise HTTPException(status_code=404)

        if file_path.is_file():
            return FileResponse(file_path)

        return FileResponse(FRONTEND_DIST / "index.html")
