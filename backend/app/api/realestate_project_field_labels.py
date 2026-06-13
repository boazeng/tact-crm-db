"""Per-company display names (and list options) for a RealEstateProject's
configurable fields: params / numbers / flags / lists.

Any user in the company may read them (the project form needs them); only a
company admin may change them."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_company_admin, resolve_company_id
from ..models import (
    RealEstateProjectFieldLabel,
    RE_PROJECT_PARAM_COUNT,
    RE_PROJECT_NUM_COUNT,
    RE_PROJECT_FLAG_COUNT,
    RE_PROJECT_LIST_COUNT,
    User,
    default_re_project_label,
)
from ..schemas.realestate_project_field_label import (
    RealEstateProjectFieldLabelOut,
    RealEstateProjectFieldLabelsUpdate,
    RealEstateProjectFieldOrderUpdate,
)


router = APIRouter(prefix="/api/realestate-project-field-labels", tags=["realestate-project-field-labels"])

# kind → how many fixed fields of that kind exist. Order here defines the
# natural (default) global display order: all params, then numbers, etc.
_COUNTS = {
    "param": RE_PROJECT_PARAM_COUNT,
    "number": RE_PROJECT_NUM_COUNT,
    "flag": RE_PROJECT_FLAG_COUNT,
    "list": RE_PROJECT_LIST_COUNT,
}


def _natural_order(kind: str, idx: int) -> int:
    """The default global position of a field when no custom order is stored."""
    pos = 0
    for k, count in _COUNTS.items():
        if k == kind:
            return pos + (idx - 1)
        pos += count
    return pos


def _resolve(db: Session, company_id: int) -> list[RealEstateProjectFieldLabelOut]:
    stored = {
        (r.kind, r.idx): r
        for r in db.query(RealEstateProjectFieldLabel).filter(RealEstateProjectFieldLabel.company_id == company_id)
    }
    out: list[RealEstateProjectFieldLabelOut] = []
    for kind, count in _COUNTS.items():
        for i in range(1, count + 1):
            row = stored.get((kind, i))
            order = row.sort_order if row and row.sort_order is not None else _natural_order(kind, i)
            out.append(
                RealEstateProjectFieldLabelOut(
                    kind=kind,
                    idx=i,
                    label=(row.label if row else None) or default_re_project_label(kind, i),
                    options=list(row.options) if row and row.options else [],
                    is_active=row.is_active if row else True,
                    sort_order=order,
                )
            )
    # Stable sort by the resolved order; ties keep the natural sequence above.
    out.sort(key=lambda o: o.sort_order)
    return out


@router.get("", response_model=list[RealEstateProjectFieldLabelOut])
def list_labels(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    return _resolve(db, company_id)


@router.put("", response_model=list[RealEstateProjectFieldLabelOut])
def update_labels(
    body: RealEstateProjectFieldLabelsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    existing = {
        (r.kind, r.idx): r
        for r in db.query(RealEstateProjectFieldLabel).filter(RealEstateProjectFieldLabel.company_id == company_id)
    }
    for item in body.labels:
        count = _COUNTS.get(item.kind)
        if count is None or not 1 <= item.idx <= count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field {item.kind}:{item.idx}",
            )
        label = item.label.strip()
        options = [o.strip() for o in item.options if o.strip()] if item.kind == "list" else []
        row = existing.get((item.kind, item.idx))
        is_default = not label or label == default_re_project_label(item.kind, item.idx)
        # A row may exist only to carry a custom display order; keep it then.
        has_custom_order = bool(row and row.sort_order is not None)
        # Pure default (default label, no options, active, natural order) → drop.
        if is_default and not options and item.is_active and not has_custom_order:
            if row:
                db.delete(row)
            continue
        resolved = label or default_re_project_label(item.kind, item.idx)
        if row:
            row.label = resolved
            row.options = options
            row.is_active = item.is_active
            # sort_order is owned by the reorder endpoint — leave it untouched.
        else:
            db.add(
                RealEstateProjectFieldLabel(
                    company_id=company_id,
                    kind=item.kind,
                    idx=item.idx,
                    label=resolved,
                    options=options,
                    is_active=item.is_active,
                )
            )
    db.commit()
    return _resolve(db, company_id)


@router.put("/order", response_model=list[RealEstateProjectFieldLabelOut])
def update_order(
    body: RealEstateProjectFieldOrderUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_company_admin),
    company_id: int = Depends(resolve_company_id),
):
    """Persist a custom global display order for the company's real-estate project
    fields. The body lists every field in the desired order; position i becomes
    the field's sort_order. Rows are created on demand to hold the order."""
    existing = {
        (r.kind, r.idx): r
        for r in db.query(RealEstateProjectFieldLabel).filter(RealEstateProjectFieldLabel.company_id == company_id)
    }
    for position, ref in enumerate(body.order):
        count = _COUNTS.get(ref.kind)
        if count is None or not 1 <= ref.idx <= count:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid field {ref.kind}:{ref.idx}",
            )
        row = existing.get((ref.kind, ref.idx))
        if row:
            row.sort_order = position
        else:
            db.add(
                RealEstateProjectFieldLabel(
                    company_id=company_id,
                    kind=ref.kind,
                    idx=ref.idx,
                    label=default_re_project_label(ref.kind, ref.idx),
                    options=[],
                    is_active=True,
                    sort_order=position,
                )
            )
    db.commit()
    return _resolve(db, company_id)
