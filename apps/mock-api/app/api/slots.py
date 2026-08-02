from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import StoreDep
from app.domain.models import Slot
from app.domain.rules import now_utc, select_slots, to_utc

router = APIRouter(tags=["slots"])


@router.get("/slots", response_model=list[Slot])
def list_slots(
    store: StoreDep,
    provider_id: Annotated[str | None, Query(alias="providerId")] = None,
    starts_from: Annotated[datetime | None, Query(alias="from")] = None,
    starts_to: Annotated[datetime | None, Query(alias="to")] = None,
    include_booked: Annotated[bool, Query(alias="includeBooked")] = False,
) -> list[Slot]:
    return select_slots(
        store.read().slots,
        now=now_utc(),
        provider_id=provider_id,
        starts_from=to_utc(starts_from),
        starts_to=to_utc(starts_to),
        include_booked=include_booked,
    )
