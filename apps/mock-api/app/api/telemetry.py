"""Structured logging + error reporting for the two frontends.

Outside the frozen domain contract in docs/api-contract.md (it's infrastructure, like
/api/health and /metrics, not an appointment resource), but still listed in that file's
endpoint table for completeness.

FrontendEvent deliberately has no open-ended context object. The scrubber in
json_logging.py only guards field *names* via an allowlist; it does not inspect the
*content* of a value it already trusts. A `context: dict` field would let a future
caller tunnel arbitrary data (say, the appointment `reason` a patient typed) straight
past that guard. Keeping every field either a closed enum or a bounded machine
identifier is what makes it safe to fold into the same JSON logs and Prometheus
registry the API already writes.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, Field

from app.observability.metrics import observe_frontend_event

logger = logging.getLogger("app.frontend")

router = APIRouter(tags=["observability"])

_LEVEL_TO_LOGGING = {
    "error": logging.ERROR,
    "warn": logging.WARNING,
    "info": logging.INFO,
}


class FrontendEvent(BaseModel):
    source: Literal["angular", "react"]
    level: Literal["error", "warn", "info"]
    message: str = Field(min_length=1, max_length=500)
    # The frontend's own client-side route, e.g. "/appointments/schedule" -- distinct
    # from the API's route templates already logged under this same field name.
    route: str | None = Field(default=None, max_length=200)
    # Correlates back to the X-Request-Id of an earlier failed API call, if this event
    # was triggered by one. Logged as `clientRequestId`, never `requestId`: that field
    # is reserved for the id of *this* /api/telemetry call, set automatically by
    # RequestContextFilter, and a same-named field in `extra=` would silently shadow it.
    requestId: str | None = Field(default=None, max_length=100)
    errorCode: str | None = Field(default=None, max_length=100)


@router.post("/telemetry", status_code=status.HTTP_204_NO_CONTENT)
def report_event(event: FrontendEvent) -> Response:
    observe_frontend_event(event.source, event.level)
    extra: dict[str, str] = {"source": event.source}
    if event.route is not None:
        extra["route"] = event.route
    if event.requestId is not None:
        extra["clientRequestId"] = event.requestId
    if event.errorCode is not None:
        extra["errorCode"] = event.errorCode
    logger.log(_LEVEL_TO_LOGGING[event.level], event.message, extra=extra)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
