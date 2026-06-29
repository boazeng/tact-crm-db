"""Dependency injection: DB session, authenticated user/company, permission gates.

Two authentication paths share the same tenant-scoping rule:
  • JWT (admin UI)        → get_current_user / get_current_company / resolve_company_id
  • X-API-Key (programmatic) → get_api_company
A company can only ever touch rows whose company_id matches the resolved tenant.
"""
import secrets
from datetime import datetime

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session
import jwt

from .auth.keys import hash_key
from .auth.tokens import decode_token
from .config import settings
from .database import SessionLocal
from .models import ApiKey, Company, User, UserRole


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    """Resolve the authenticated user from the `Authorization: Bearer <jwt>` header."""
    if not authorization:
        raise _unauthorized("Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _unauthorized("Authorization header must be 'Bearer <token>'")

    try:
        user_id = decode_token(parts[1])
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.PyJWTError:
        raise _unauthorized("Invalid token")

    user = (
        db.query(User)
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )
    if not user:
        raise _unauthorized("User not found or inactive")
    return user


def require_super_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super admin only"
        )
    return user


def require_company_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in (UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Company admin only"
        )
    return user


def _load_active_company(db: Session, company_id: int) -> Company:
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company or not company.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found or inactive",
        )
    return company


def resolve_company_id(
    actor: User = Depends(get_current_user),
    company_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> int:
    """The tenant a JWT request operates on.

    super_admin must pass ?company_id=<id>. Everyone else is locked to their own
    company; a mismatching ?company_id is rejected (never trust the client).
    """
    if actor.role == UserRole.SUPER_ADMIN:
        if company_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super admin must specify ?company_id",
            )
        _load_active_company(db, company_id)
        return company_id
    if actor.company_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User has no company assigned"
        )
    if company_id is not None and company_id != actor.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another company's data",
        )
    return actor.company_id


def get_current_company(
    actor: User = Depends(get_current_user),
    company_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> Company:
    """Like resolve_company_id but returns the Company object."""
    return _load_active_company(db, resolve_company_id(actor, company_id, db))


def get_api_company(
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
) -> Company:
    """Resolve the tenant company from the `X-API-Key` header (programmatic API)."""
    if not x_api_key:
        raise _unauthorized("Missing X-API-Key header")
    key = (
        db.query(ApiKey)
        .filter(ApiKey.key_hash == hash_key(x_api_key), ApiKey.is_active.is_(True))
        .first()
    )
    if not key:
        raise _unauthorized("Invalid or revoked API key")
    key.last_used_at = datetime.utcnow()
    db.commit()
    return _load_active_company(db, key.company_id)


def require_service_key(x_service_key: str | None = Header(default=None)) -> None:
    """Validate the shared service secret (X-Service-Key) without tenant scoping.

    Used by cross-tenant service endpoints such as listing all companies."""
    expected = settings.service_api_key
    if not expected:
        raise _unauthorized("Service API is disabled")
    if not x_service_key or not secrets.compare_digest(x_service_key, expected):
        raise _unauthorized("Invalid service key")


def get_service_company(
    db: Session = Depends(get_db),
    x_service_key: str | None = Header(default=None),
    company_id: int | None = Query(default=None),
) -> Company:
    """Trusted first-party service auth for app-to-app reads (e.g. the bedek app).

    One shared secret in the `X-Service-Key` header authenticates the calling
    service; the tenant is scoped by the required `company_id` query param. The
    secret lives only server-side in the calling app — never in a browser."""
    require_service_key(x_service_key)
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="company_id query parameter is required",
        )
    return _load_active_company(db, company_id)
