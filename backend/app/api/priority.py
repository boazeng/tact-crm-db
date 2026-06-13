"""Priority ERP sync configuration — connection, live field discovery, mapping.

Company-admin only, tenant-scoped via `resolve_company_id`. This phase covers
the mapping screen; actual customer ingestion is a later phase.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db, require_super_admin, resolve_company_id
from ..models import User
from ..schemas.priority import (
    PriorityConnectionIn,
    PriorityConnectionOut,
    PriorityFieldOut,
    SystemFieldOut,
    PriorityFieldMapOut,
    MappingBulkIn,
    TestResult,
    IngestRequest,
    IngestSummary,
)
from ..services import priority_service as svc
from ..services import priority_ingest

router = APIRouter(prefix="/api/priority-sync", tags=["priority-sync"])


def _conn_out(conn) -> PriorityConnectionOut:
    return PriorityConnectionOut(
        base_url=conn.base_url,
        username=conn.username,
        entity_name=conn.entity_name,
        is_active=conn.is_active,
        password_set=bool(conn.password),
        last_tested_at=conn.last_tested_at,
        last_test_ok=conn.last_test_ok,
        last_test_msg=conn.last_test_msg,
    )


@router.get("/connection", response_model=PriorityConnectionOut | None)
def get_connection(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    conn = svc.get_connection(db, company_id)
    return _conn_out(conn) if conn else None


@router.put("/connection", response_model=PriorityConnectionOut)
def save_connection(
    body: PriorityConnectionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    conn = svc.upsert_connection(db, company_id, body.model_dump())
    return _conn_out(conn)


@router.post("/connection/test", response_model=TestResult)
def test_connection(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    conn = svc.get_connection(db, company_id)
    if not conn:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "לא הוגדר חיבור פריורטי")
    ok, msg = svc.test_connection(db, conn)
    return TestResult(ok=ok, message=msg)


@router.get("/priority-fields", response_model=list[PriorityFieldOut])
def priority_fields(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    conn = svc.get_connection(db, company_id)
    if not conn:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "לא הוגדר חיבור פריורטי")
    try:
        return svc.fetch_priority_fields(conn)
    except svc.PriorityError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@router.get("/system-fields", response_model=list[SystemFieldOut])
def system_fields(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    return svc.system_fields(db, company_id)


@router.get("/mappings", response_model=list[PriorityFieldMapOut])
def list_mappings(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    return svc.list_maps(db, company_id)


@router.put("/mappings", response_model=list[PriorityFieldMapOut])
def save_mappings(
    body: MappingBulkIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    return svc.replace_maps(db, company_id, [r.model_dump() for r in body.rows])


@router.post("/ingest", response_model=IngestSummary)
def ingest(
    body: IngestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
    company_id: int = Depends(resolve_company_id),
):
    """Pull customer records from this company's Priority connection and upsert
    them into the CRM per the saved mapping."""
    try:
        return priority_ingest.ingest_customers(db, company_id, body.limit)
    except svc.PriorityError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))
