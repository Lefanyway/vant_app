import logging
import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from routers.vlr_router import router as vlr_router
from routers.v2_router import router as v2_router
from utils.http_client import close_http_client
from utils.constants import API_TITLE, API_DESCRIPTION, API_PORT
from routers.shared_handlers import get_health_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting vlrggapi")
    yield
    logger.info("Shutting down — closing HTTP client")
    await close_http_client()


app = FastAPI(
    title=API_TITLE,
    description=API_DESCRIPTION,
    docs_url="/",
    redoc_url=None,
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(vlr_router)
app.include_router(v2_router)


@app.get("/version", tags=["Meta"])
def version():
    return {"version": "2.0.0", "default_api": "v2"}


@app.get("/health", tags=["Meta"])
async def health():
    """Lightweight health/readiness endpoint for Replit and external monitors."""
    return await get_health_data()


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", API_PORT)),
    )
