"""Small VANT compatibility overlay loaded by the Replit sidecar entrypoint."""

from fastapi import FastAPI


def apply(app: FastAPI) -> FastAPI:
    """Return the upstream app without changing its public V2 contract."""
    return app