from fastapi import APIRouter

from app.api.deps import StoreDep
from app.domain.models import VisitType

router = APIRouter(tags=["visit-types"])


@router.get("/visit-types", response_model=list[VisitType])
def list_visit_types(store: StoreDep) -> list[VisitType]:
    return store.read().visit_types
