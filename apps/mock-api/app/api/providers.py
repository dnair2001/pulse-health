from fastapi import APIRouter

from app.api.deps import StoreDep
from app.domain.models import Provider
from app.domain.rules import require_provider

router = APIRouter(tags=["providers"])


@router.get("/providers", response_model=list[Provider])
def list_providers(store: StoreDep) -> list[Provider]:
    return store.read().providers


@router.get("/providers/{provider_id}", response_model=Provider)
def get_provider(provider_id: str, store: StoreDep) -> Provider:
    return require_provider(store.read().providers, provider_id)
