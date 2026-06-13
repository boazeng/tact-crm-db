"""Per-company configuration for the fixed customer list fields (list1..list3):
each list's display name and its allowed choices.

Any user in the company may read them (the customer form needs them); only a
company admin may change them. A list left at its default `רשימה N` with no
options is simply not stored — GET fills those in on the fly."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import ListField, LIST_COUNT, User, default_list_label
from ..schemas.list_field import ListFieldOut, ListFieldsUpdate


router = APIRouter(prefix="/api/list-fields", tags=["list-fields"])


def _resolve(db: Session, company_id: int) -> list[ListFieldOut]:
    """Return all LIST_COUNT lists in order, custom config or default per list."""
    stored = {
        r.list_index: r
        for r in db.query(ListField).filter(ListField.company_id == company_id)
    }
    out: list[ListFieldOut] = []
    for i in range(1, LIST_COUNT + 1):
        row = stored.get(i)
        out.append(
            ListFieldOut(
                list_index=i,
                label=(row.label if row else None) or default_list_label(i),
                options=list(row.options) if row and row.options else [],
                is_active=row.is_active if row else True,
            )
        )
    return out


@router.get("", response_model=list[ListFieldOut])
def list_lists(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[ListFieldOut])
def update_lists(
    body: ListFieldsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    existing = {
        r.list_index: r
        for r in db.query(ListField).filter(ListField.company_id == company_id)
    }
    for item in body.labels:
        if not 1 <= item.list_index <= LIST_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"list_index must be 1..{LIST_COUNT}",
            )
        label = item.label.strip()
        options = [o.strip() for o in item.options if o.strip()]
        row = existing.get(item.list_index)
        is_default_label = not label or label == default_list_label(item.list_index)
        # Default name AND no options AND still active → drop the row (pure default).
        if is_default_label and not options and item.is_active:
            if row:
                db.delete(row)
            continue
        resolved_label = label or default_list_label(item.list_index)
        if row:
            row.label = resolved_label
            row.options = options
            row.is_active = item.is_active
        else:
            db.add(
                ListField(
                    company_id=company_id,
                    list_index=item.list_index,
                    label=resolved_label,
                    options=options,
                    is_active=item.is_active,
                )
            )
    db.commit()
    return _resolve(db, company_id)
