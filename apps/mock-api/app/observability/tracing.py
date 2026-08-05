"""OpenTelemetry tracing that works with zero configuration and no collector."""

import logging
import os
from pathlib import Path
from typing import TextIO

from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import SERVICE_NAME, SERVICE_VERSION, Resource
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SpanExporter

from app.config import settings

OTLP_ENDPOINT_ENV = "OTEL_EXPORTER_OTLP_ENDPOINT"
SDK_DISABLED_ENV = "OTEL_SDK_DISABLED"

logger = logging.getLogger("app.tracing")

_TRUTHY = frozenset({"1", "true", "yes", "on"})


def tracing_disabled() -> bool:
    if os.getenv(SDK_DISABLED_ENV, "").strip().lower() in _TRUTHY:
        return True
    return not settings.tracing_enabled


def _span_line(span: ReadableSpan) -> str:
    # ReadableSpan.to_json is untyped in the SDK, so bind it to str before returning.
    encoded: str = span.to_json(indent=None)
    return encoded + "\n"


def _file_exporter() -> tuple[SpanExporter, str]:
    path = Path(settings.trace_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Held open for the process lifetime; ConsoleSpanExporter flushes each batch.
    stream: TextIO = path.open("a", encoding="utf-8")
    return ConsoleSpanExporter(out=stream, formatter=_span_line), str(path)


def configure_tracing(app: FastAPI) -> str:
    """Install a tracer provider and instrument `app`. Returns the exporter mode."""
    if tracing_disabled():
        return "disabled"

    endpoint = os.getenv(OTLP_ENDPOINT_ENV, "").strip()
    if endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        exporter: SpanExporter = OTLPSpanExporter()
        destination = endpoint
        mode = "otlp"
    else:
        exporter, destination = _file_exporter()
        mode = "file"

    resource = Resource.create(
        {SERVICE_NAME: settings.name, SERVICE_VERSION: settings.version},
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(
        app, tracer_provider=provider, excluded_urls="/metrics,/healthz"
    )
    logger.info("tracing enabled", extra={"exporter": mode, "destination": destination})
    return mode
