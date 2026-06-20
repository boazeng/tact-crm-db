from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root = tact-crm/ (config.py is at backend/app/config.py).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
# All DB artifacts live under tact-crm/database/. Absolute path → the DB file is
# the same no matter which directory the process is launched from.
DB_FILE = PROJECT_ROOT / "database" / "tactcrm.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "TACT-CRM"
    app_env: str = "development"
    # Local dev defaults to SQLite at tact-crm/database/tactcrm.db (absolute, so
    # CWD never matters). For Postgres set:
    # DATABASE_URL=postgresql+psycopg2://crm:crm@localhost:5432/crm
    database_url: str = f"sqlite:///{DB_FILE.as_posix()}"
    # Postgres connection pool. Small by default: on Lambda each warm container
    # holds its own pool, so a big pool × many concurrent containers exhausts
    # RDS max_connections. Keep tiny and cap Lambda reserved concurrency instead.
    db_pool_size: int = 2
    db_max_overflow: int = 3
    cors_origins: str = "http://localhost:5173"

    # JWT — replace in production with a long random value via .env
    jwt_secret: str = "dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 24

    # Allow the /api/auth/dev-login endpoint and listing all users only while
    # this is True. MUST be False in any deployed environment.
    enable_dev_login: bool = True

    # "Sign in with Google": the OAuth Web client ID. Used as the expected `aud`
    # when verifying a Google ID token. Empty → Google login is disabled.
    google_client_id: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env.lower() in ("development", "dev", "local")


settings = Settings()
