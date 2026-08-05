"""Runtime evidence for the API: structured logs, Prometheus metrics, traces.

Everything here lives outside the frozen `/api` contract.
"""

import logging

from fastapi import FastAPI

from app.observability.context import current_request_id, current_trace_id
from app.observability.json_logging import configure_logging
from app.observability.metrics import register_collectors
from app.observability.metrics import router as metrics_router
from app.observability.middleware import REQUEST_ID_HEADER, RequestObservabilityMiddleware
from app.observability.tracing import configure_tracing

__all__ = [
    "REQUEST_ID_HEADER",
    "current_request_id",
    "current_trace_id",
    "setup_observability",
]

logger = logging.getLogger("app.observability")


def setup_observability(app: FastAPI) -> None:
    """Wire logging, metrics and tracing into `app`.

    Called last in `create_app` so the middleware wraps every other one and the
    route table is complete when metrics resolve route templates.
    """
    log_file = configure_logging()
    register_collectors()
    app.include_router(metrics_router)
    app.add_middleware(RequestObservabilityMiddleware)
    tracing_mode = configure_tracing(app)
    logger.info(
        "observability ready",
        extra={"logFile": str(log_file), "tracing": tracing_mode},
    )
