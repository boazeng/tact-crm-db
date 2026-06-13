"""Per-company API key management (JWT, company admin). The raw key is shown once."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.keys import generate_api_key
from ..deps import get_db, require_company_admin, resolve_company_id
from ..models import ApiKey, User
from ..schemas.api_key import ApiKeyCreated, ApiKeyIn, ApiKeyOut


router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


@router.get("", response_model=list[ApiKeyOut])
def list_keys(
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    return (
        db.query(ApiKey)
        .filter(ApiKey.company_id == company_id)
        .order_by(ApiKey.created_at.desc())
        .all()
    )


@router.post("", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_key(
    body: ApiKeyIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    raw, prefix, key_hash = generate_api_key()
    key = ApiKey(company_id=company_id, label=body.label, key_prefix=prefix, key_hash=key_hash)
    db.add(key)
    db.commit()
    db.refresh(key)
    return ApiKeyCreated.model_validate({**key.__dict__, "raw_key": raw})


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_key(
    key_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    key = (
        db.query(ApiKey)
        .filter(ApiKey.id == key_id, ApiKey.company_id == company_id)
        .first()
    )
    if not key:
        return
    key.is_active = False
    db.commit()
