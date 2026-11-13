from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    app_env: str = "development"
    mongodb_uri: SecretStr = SecretStr("mongodb://localhost:27017")
    mongodb_database: str = "roommate_ledger_dev"
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    bootstrap_username: str = "admin"
    bootstrap_password: SecretStr | None = None
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cookie_secure: bool = False
    db_timeout_ms: int = 8000

    @model_validator(mode="after")
    def production_security(self):
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError("Production requires COOKIE_SECURE=true")
        return self
