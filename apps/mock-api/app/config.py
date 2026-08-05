from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    name: str = "pulse-health-api"
    version: str = "0.1.0"
    # The Angular dev server proxies /api, so same-origin requests need no CORS
    # entry. This list only matters when the frontend is served from elsewhere.
    cors_origins: list[str] = ["http://localhost:4200"]
    # Relative to the process working directory (apps/mock-api).
    store_path: str = "data/store.json"
    log_level: str = "INFO"
    # Structured JSON logs are written here as well as to stdout, because
    # after-the-fact debugging reads the filesystem, not the console.
    log_path: str = "data/logs/api.log"
    # Default span destination. Ignored when OTEL_EXPORTER_OTLP_ENDPOINT is set.
    trace_path: str = "data/logs/traces.jsonl"
    tracing_enabled: bool = True


settings = Settings()
