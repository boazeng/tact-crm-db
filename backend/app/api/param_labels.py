"""Per-company display names for the fixed customer parameters (param1..param10).

Any user in the company may read them (the customer form + list need them); only
a company admin may change them. Slots left at their default `פרמטר N` are simply
not stored — GET fills those in on the fly."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import ParamLabel, PARAM_COUNT, User, default_param_label
from ..schemas.param_label import ParamLabelOut, ParamLabelsUpdate


router = APIRouter(prefix="/api/param-labels", tags=["param-labels"])


def _resolve(db: Session, company_id: int) -> list[ParamLabelOut]:
    """Return all PARAM_COUNT slots in order, custom label or default per slot."""
    stored = {
        r.param_index: r
        for r in db.query(ParamLabel).filter(ParamLabel.company_id == company_id)
    }
    out = []
    for i in range(1, PARAM_COUNT + 1):
        row = stored.get(i)
        out.append(ParamLabelOut(
            param_index=i,
            label=(row.label if row else None) or default_param_label(i),
            is_active=row.is_active if row else True,
        ))
    return out


@router.get("", response_model=list[ParamLabelOut])
def list_labels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[ParamLabelOut])
def update_labels(
    body: ParamLabelsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    existing = {
        r.param_index: r
        for r in db.query(ParamLabel).filter(ParamLabel.company_id == company_id)
    }
    for item in body.labels:
        if not 1 <= item.param_index <= PARAM_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"param_index must be 1..{PARAM_COUNT}",
            )
        label = item.label.strip()
        row = existing.get(item.param_index)
        is_default = not label or label == default_param_label(item.param_index)
        # Default label AND still active → drop the row (pure default).
        if is_default and item.is_active:
            if row:
                db.delete(row)
            continue
        resolved = label or default_param_label(item.param_index)
        if row:
            row.label = resolved
            row.is_active = item.is_active
        else:
            db.add(
                ParamLabel(
                    company_id=company_id, param_index=item.param_index,
                    label=resolved, is_active=item.is_active,
                )
            )
    db.commit()
    return _resolve(db, company_id)
