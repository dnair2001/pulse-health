from fastapi import APIRouter

from app.api.deps import StoreDep
from app.domain.models import Provider

router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=list[Provider])
def list_providers(store: StoreDep) -> list[Provider]:
    return store.read().providers
