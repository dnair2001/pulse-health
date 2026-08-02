from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    time: datetime


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.name,
        version=settings.version,
        time=datetime.now(timezone.utc),
    )
