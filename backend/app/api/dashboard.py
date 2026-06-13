"""Dashboard KPIs for the active company: customer counts + a classification breakdown."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, resolve_company_id
from ..models import (
    CHOICE_TYPES,
    CustomerCompany,
    CustomerFieldValue,
    FieldDefinition,
    User,
)
from ..services import field_service


router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


class FieldBreakdown(BaseModel):
    key: str
    label: str
    counts: dict[str, int]


class DashboardResponse(BaseModel):
    total_customers: int
    by_status: dict[str, int]
    total_fields: int
    breakdowns: list[FieldBreakdown]


@router.get("", response_model=DashboardResponse)
def dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
    company_id: int = Depends(resolve_company_id),
):
    active = (
        CustomerCompany.company_id == company_id,
        CustomerCompany.is_active.is_(True),
    )
    total = db.query(func.count(CustomerCompany.id)).filter(*active).scalar() or 0

    by_status: dict[str, int] = {
        status_v: count
        for status_v, count in (
            db.query(CustomerCompany.status, func.count(CustomerCompany.id))
            .filter(*active)
            .group_by(CustomerCompany.status)
            .all()
        )
    }

    choice_types = [t.value for t in CHOICE_TYPES]
    fields = (
        db.query(FieldDefinition)
        .filter(
            FieldDefinition.company_id == company_id,
            FieldDefinition.is_active.is_(True),
        )
        .order_by(FieldDefinition.sort_order)
        .all()
    )

    breakdowns: list[FieldBreakdown] = []
    for fd in (f for f in fields if f.field_type in choice_types):
        counts: dict[str, int] = {opt: 0 for opt in (fd.options or [])}
        rows = (
            db.query(CustomerFieldValue.value)
            .join(CustomerCompany, CustomerCompany.id == CustomerFieldValue.membership_id)
            .filter(
                CustomerFieldValue.field_definition_id == fd.id,
                CustomerCompany.is_active.is_(True),
            )
            .all()
        )
        for (stored,) in rows:
            value = field_service.deserialize_value(fd, stored)
            for item in (value if isinstance(value, list) else [value]):
                if item is not None:
                    counts[item] = counts.get(item, 0) + 1
        breakdowns.append(FieldBreakdown(key=fd.key, label=fd.label, counts=counts))

    return DashboardResponse(
        total_customers=total,
        by_status=by_status,
        total_fields=len(fields),
        breakdowns=breakdowns,
    )
