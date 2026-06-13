"""Alembic environment for TACT-CRM.

Pulls the DB URL and the ORM metadata from the backend app, so a single set of
migrations drives both SQLite (dev) and PostgreSQL (prod). `render_as_batch` is
enabled so SQLite — which can't ALTER columns in place — is migrated via the
table-copy ("batch") strategy. That's what lets schema changes apply WITHOUT
dropping data.
"""
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# Make the backend app package importable (env.py lives at database/migrations/).
BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
import app.models  # noqa: E402,F401  (register every model on Base.metadata)

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# DB URL comes from app settings (.env / DATABASE_URL / default), never hardcoded.
config.set_main_option("sqlalchemy.url", settings.database_url)
target_metadata = Base.metadata

# SQLite needs batch mode for ALTER; compare_type catches column type changes.
_BATCH = settings.database_url.startswith("sqlite")


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=_BATCH,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=_BATCH,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
