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
    # RDS Postgres (16+) enforces TLS by default. pg8000 takes an ssl.SSLContext
    # via connect_args. The connection is private (in-VPC), so we encrypt the link
    # but skip CA/hostname verification to avoid bundling the RDS cert chain.
    if "pg8000" in settings.database_url:
        import ssl

        _ssl_ctx = ssl.create_default_context()
        _ssl_ctx.check_hostname = False
        _ssl_ctx.verify_mode = ssl.CERT_NONE
        _engine_kwargs["connect_args"] = {"ssl_context": _ssl_ctx}

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
