from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend

from src.api.admin import router as admin_router
from src.api.frontend import router as frontend_router
from src.api.root import router as root_router
from src.api.tw import router as tw_router
from src.api.user import router as user_router
from src.api.xui import router as xui_router
from src.core.cache import request_key_builder
from src.core.handlers import register_exception_handlers
from src.core.logger import logger
from src.core.settings import settings
from src.schemas import Base
from src.services.db import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    FastAPICache.init(
        InMemoryBackend(),
        prefix=settings.cache.namespace,
        key_builder=request_key_builder,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.app.name,
    version=settings.app.version,
    lifespan=lifespan,
)

register_exception_handlers(app)

static_dir = Path(__file__).resolve().parent / "src" / "static"
app.mount("/assets", StaticFiles(directory=static_dir), name="assets")
app.include_router(frontend_router)
app.include_router(root_router)
app.include_router(admin_router)
app.include_router(user_router)
app.include_router(tw_router)
app.include_router(xui_router)

init_msg = """
=========================
Fast Ray Gram API v%s
=========================
Debug: %s
Host: %s Port: %s
""" % (
    settings.app.version,
    settings.app.debug,
    settings.app.host,
    settings.app.port,
)

logger.info(init_msg)
