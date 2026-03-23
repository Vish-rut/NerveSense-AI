"""Application configuration using pydantic-settings."""

import os
from urllib.parse import quote_plus
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NerveSenseAI"
    DEBUG: bool = True

    # Database — individual components (avoids URL-encoding issues with passwords)
    DB_HOST: str = ""
    DB_PORT: int = 6543
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_NAME: str = "postgres"

    # Falls back to SQLite if DB_HOST is not set
    DATABASE_URL: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Security
    SECRET_KEY: str = "nervesense-dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    INTERVIEW_TOKEN_EXPIRE_DAYS: int = 30

    # CORS — set via env var as comma-separated string, e.g.:
    # CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @property
    def effective_database_url(self) -> str:
        """Build DATABASE_URL from components, or fall back to SQLite."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        if self.DB_HOST:
            encoded_password = quote_plus(self.DB_PASSWORD)
            return (
                f"postgresql+asyncpg://{self.DB_USER}:{encoded_password}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        return "sqlite+aiosqlite:///./nervesense.db"

    class Config:
        env_file = ".env"
        extra = "ignore"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse CORS_ORIGINS from env if it's a comma-separated string
        cors_env = os.environ.get("CORS_ORIGINS", "")
        if cors_env:
            parsed = [o.strip() for o in cors_env.split(",") if o.strip()]
            if parsed:
                object.__setattr__(self, "CORS_ORIGINS", parsed)


settings = Settings()

