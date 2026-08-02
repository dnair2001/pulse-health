from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.appointments import router as appointments_router
from app.api.dev import router as dev_router
from app.api.health import router as health_router
from app.api.providers import router as providers_router
from app.api.slots import router as slots_router
from app.api.visit_types import router as visit_types_router
from app.config import settings
from app.domain.errors import register_exception_handlers


def create_app() -> FastAPI:
    app = FastAPI(title=settings.name, version=settings.version)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(health_router, prefix="/api")
    app.include_router(providers_router, prefix="/api")
    app.include_router(visit_types_router, prefix="/api")
    app.include_router(slots_router, prefix="/api")
    app.include_router(appointments_router, prefix="/api")
    app.include_router(dev_router, prefix="/api")
    return app


app = create_app()
