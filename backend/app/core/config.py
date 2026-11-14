from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore", hide_input_in_errors=True)
    app_env: Literal["development", "production", "test"] = "development"
    mongodb_uri: SecretStr
    mongodb_database: str = "roommate"
    jwt_secret: SecretStr = Field(min_length=32)
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    bootstrap_username: str = "admin"
    bootstrap_password: SecretStr | None = None
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cookie_secure: bool = False
    cookie_samesite: Literal["strict", "lax", "none"] = "strict"
    db_timeout_ms: int = 8000

    @model_validator(mode="after")
    def production_security(self):
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError("Production requires COOKIE_SECURE=true")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("Cross-site cookies require COOKIE_SECURE=true")
        if self.app_env == "test":
            if not self.mongodb_database.startswith(("test_", "qa_")):
                raise ValueError("Automated tests require a test_ or qa_ database name")
        else:
            try:
                uri = urlsplit(self.mongodb_uri.get_secret_value())
                valid = (
                    uri.scheme == "mongodb+srv"
                    and bool(uri.hostname and uri.hostname.endswith(".mongodb.net"))
                    and bool(uri.username and uri.password)
                    and "<" not in self.mongodb_uri.get_secret_value()
                    and ">" not in self.mongodb_uri.get_secret_value()
                )
            except ValueError:
                valid = False
            if not valid:
                raise ValueError("Set MONGODB_URI to a complete MongoDB Atlas SRV connection string; local database mode is unavailable")
        return self
