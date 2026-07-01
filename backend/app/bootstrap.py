"""Idempotent deploy-time bootstrap: create the schema and ensure a super_admin
with a known password exists.

Solves the chicken-and-egg of production login (you cannot log in to create the
first user, and you cannot create a password without logging in). Invoked by the
Lambda migrate handler after each deploy, and runnable locally:

    python -m app.bootstrap  --  reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
"""
import os
import random

from sqlalchemy import inspect, text

from .auth.passwords import hash_password
from .database import Base, SessionLocal, engine
from .models import Company, User, UserRole

_COMPANY_NUMBER_MIN = 10000
_COMPANY_NUMBER_MAX = 99999


def create_tables() -> None:
    from . import models  # noqa: F401 — register every model on Base.metadata

    Base.metadata.create_all(bind=engine)


# Idempotent additive column patches for tables that already exist (create_all only
# creates missing tables, it never alters existing ones). Each entry:
# table -> {column: SQL type}. Safe to run on every deploy.
_COLUMN_PATCHES: dict[str, dict[str, str]] = {
    "companies": {"company_number": "INTEGER"},
}


def patch_schema() -> list[str]:
    """Add any missing columns listed in _COLUMN_PATCHES. Dialect-agnostic: both
    Postgres and SQLite support `ALTER TABLE ADD COLUMN <name> <type>`."""
    insp = inspect(engine)
    applied: list[str] = []
    existing_tables = set(insp.get_table_names())
    for table, columns in _COLUMN_PATCHES.items():
        if table not in existing_tables:
            continue  # create_all will have made it with all columns
        have = {c["name"] for c in insp.get_columns(table)}
        for col, sqltype in columns.items():
            if col not in have:
                with engine.begin() as conn:
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {col} {sqltype}'))
                applied.append(f"{table}.{col}")
    return applied


def backfill_company_numbers() -> int:
    """Assign a random unused 5-digit number to every company that lacks one.
    Idempotent: once all companies have a number, subsequent runs do nothing."""
    db = SessionLocal()
    try:
        used = {
            n for (n,) in db.query(Company.company_number)
            .filter(Company.company_number.isnot(None)).all()
        }
        missing = db.query(Company).filter(Company.company_number.is_(None)).all()
        assigned = 0
        for company in missing:
            n = None
            for _ in range(200):
                cand = random.randint(_COMPANY_NUMBER_MIN, _COMPANY_NUMBER_MAX)
                if cand not in used:
                    n = cand
                    break
            if n is None:  # space nearly full — fall back to first free
                for cand in range(_COMPANY_NUMBER_MIN, _COMPANY_NUMBER_MAX + 1):
                    if cand not in used:
                        n = cand
                        break
            if n is None:
                break
            used.add(n)
            company.company_number = n
            assigned += 1
        db.commit()
        return assigned
    finally:
        db.close()


def ensure_super_admin(email: str, password: str, full_name: str = "Administrator") -> int:
    """Create the super_admin if absent; always (re)set its password and reactivate.
    Returns the user id."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                email=email,
                full_name=full_name,
                role=UserRole.SUPER_ADMIN,
                company_id=None,
                is_active=True,
            )
            db.add(user)
        user.password_hash = hash_password(password)
        user.is_active = True
        db.commit()
        db.refresh(user)
        return user.id
    finally:
        db.close()


def run(email: str | None = None, password: str | None = None) -> dict:
    """Create tables and, if admin credentials are supplied, ensure the super_admin."""
    create_tables()
    result: dict = {
        "tables": "ensured",
        "columns_added": patch_schema(),
        "company_numbers_assigned": backfill_company_numbers(),
    }
    email = email or os.environ.get("SEED_ADMIN_EMAIL")
    password = password or os.environ.get("SEED_ADMIN_PASSWORD")
    if email and password:
        result["super_admin_id"] = ensure_super_admin(email, password)
        result["super_admin_email"] = email
    else:
        result["super_admin"] = "skipped (no SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD)"
    return result


if __name__ == "__main__":
    print(run())
