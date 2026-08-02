from fastapi import APIRouter

from app.api.deps import StoreDep
from app.domain.models import ResetResponse

router = APIRouter(tags=["dev"])


@router.post("/dev/reset", response_model=ResetResponse)
def reset_store(store: StoreDep) -> ResetResponse:
    store.reset()
    return ResetResponse(status="reset")
