"""Prometheus instrumentation exposed at `/metrics`, outside the frozen `/api` contract."""

from collections.abc import Iterator

from fastapi import APIRouter, Response
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, Counter, Histogram, generate_latest
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import Collector

from app.domain.models import AppointmentStatus
from app.store import get_store

_LABELS = ("method", "route", "status")

REQUEST_COUNT = Counter(
    "pulse_http_requests_total",
    "HTTP requests handled, by method, route template and status code.",
    _LABELS,
)

REQUEST_LATENCY = Histogram(
    "pulse_http_request_duration_seconds",
    "HTTP request duration in seconds, by method, route template and status code.",
    _LABELS,
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)


def observe_request(method: str, route: str, status: int, duration_seconds: float) -> None:
    labels = (method, route, str(status))
    REQUEST_COUNT.labels(*labels).inc()
    REQUEST_LATENCY.labels(*labels).observe(duration_seconds)


class AppointmentsCollector(Collector):
    """Reports the live appointment counts per status straight from the store."""

    def collect(self) -> Iterator[GaugeMetricFamily]:
        gauge = GaugeMetricFamily(
            "pulse_appointments",
            "Appointments currently in the store, by status.",
            labels=["status"],
        )
        counts = dict.fromkeys(AppointmentStatus, 0)
        try:
            data = get_store().read()
        except Exception:
            # Scraping must never fail because the store is mid-reseed.
            return
        for record in data.appointments:
            counts[record.status] = counts.get(record.status, 0) + 1
        for status, count in counts.items():
            gauge.add_metric([status.value], count)
        yield gauge


_collectors_registered = False


def register_collectors() -> None:
    """Register the domain collector once per process; re-registering would raise."""
    global _collectors_registered
    if _collectors_registered:
        return
    REGISTRY.register(AppointmentsCollector())
    _collectors_registered = True


router = APIRouter(tags=["observability"], include_in_schema=False)


@router.get("/metrics")
def metrics() -> Response:
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
