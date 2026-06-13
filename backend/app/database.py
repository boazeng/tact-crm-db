from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


_is_sqlite = settings.database_url.startswith("sqlite")

# SQLite ignores pool sizing; Postgres uses a deliberately small pool (see config).
# pool_recycle guards against RDS idle-timeout killing a connection that a frozen
# Lambda container would otherwise try to reuse.
_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs.update(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=900,
    )

engine = create_engine(settings.database_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
