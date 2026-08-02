from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="APP_", extra="ignore")

    name: str = "webapp-api"
    version: str = "0.1.0"
    # The Angular dev server proxies /api, so same-origin requests need no CORS
    # entry. This list only matters when the frontend is served from elsewhere.
    cors_origins: list[str] = ["http://localhost:4200"]


settings = Settings()
