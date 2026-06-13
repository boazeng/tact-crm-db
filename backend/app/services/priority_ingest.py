"""Ingest customer records from Priority into the CRM, per the saved mapping.

Tenant-scoped: operates strictly on one company's own connection + mapping, so a
different company can have a different Priority connection (and different mapped
fields). Priority is the source of truth ONLY for mapped fields — unmapped CRM
fields (and anything edited by hand) are preserved on update.

Dedup: a customer is matched by the value mapped to `customer_number` (Priority
``CUSTNAME``), then by `national_id`, so re-running the ingest updates in place
instead of creating duplicates.
"""
import json

from sqlalchemy.orm import Session

from ..models import Customer, CustomerCompany
from ..schemas.customer import CustomerIn
from . import customer_service
from .priority_service import (
    PriorityError,
    _base,
    _request,
    get_connection,
    list_maps,
)

VALID_TYPES = {"person", "organization", "authorized_dealer"}


# ---------- value coercion ----------
def _s(raw) -> str | None:
    if raw is None:
        return None
    s = raw if isinstance(raw, str) else str(raw)
    s = s.strip()
    return s or None


def _f(raw) -> float | None:
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _b(raw) -> bool:
    return raw in (True, "Y", "y", "1", 1, "true", "True", "כן")


def _coerce_status(raw) -> str | None:
    s = str(raw or "").strip()
    if s in ("פעיל", "active", "Active", "Y"):
        return "active"
    if s in ("לא פעיל", "inactive", "Inactive", "N"):
        return "inactive"
    if s in ("ליד", "lead", "Lead"):
        return "lead"
    return None


def _coerce_date(raw) -> str | None:
    s = str(raw or "")
    # Priority dates look like "2017-11-16T00:00:00Z".
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return None


# ---------- fetching ----------
def _fetch_records(conn, limit: int | None):
    """Yield CUSTOMERS records, following OData @odata.nextLink pagination."""
    base = _base(conn)
    entity = (conn.entity_name or "CUSTOMERS").strip()
    url = f"{base}{entity}"
    yielded = 0
    pages = 0
    while url and pages < 500:
        data = json.loads(_request(url, conn, "application/json").decode("utf-8", "replace"))
        for row in data.get("value", []) or []:
            if isinstance(row, dict):
                yield row
                yielded += 1
                if limit and yielded >= limit:
                    return
        url = data.get("@odata.nextLink")
        pages += 1


def _fetch_window(conn, limit: int, offset: int) -> list[dict]:
    """Fetch a single bounded window of records via OData ``$top``/``$skip``.

    One HTTP request, hard-capped at ``limit`` rows, so a batch can never blow the
    API Gateway 30s budget regardless of Priority's default page size. The client
    walks the whole table by repeating with ``offset += limit``.
    """
    base = _base(conn)
    entity = (conn.entity_name or "CUSTOMERS").strip()
    sep = "&" if "?" in entity else "?"
    url = f"{base}{entity}{sep}$top={int(limit)}&$skip={int(offset)}"
    data = json.loads(_request(url, conn, "application/json").decode("utf-8", "replace"))
    rows = [r for r in (data.get("value") or []) if isinstance(r, dict)]
    return rows[:limit]


# ---------- mapping a record onto a CustomerIn ----------
def _empty_in() -> dict:
    return {
        "customer_number": None, "full_name": "", "customer_type": "person",
        "company_name": None, "national_id": None, "nickname": None, "role": None,
        "street1": None, "city1": None, "street2": None, "city2": None,
        "phone": None, "email": None, "allow_mailing": True, "notes": None,
        "creation_date": None, "status": "active", "source": "sync", "external_ref": None,
        "is_paying": True, "paid_by_membership_id": None,
        "params": [None] * 15, "numbers": [None] * 15, "flags": [False] * 5,
        "lists": [None] * 10, "fields": {}, "links": [],
    }


def _existing_in(db: Session, membership: CustomerCompany, customer: Customer) -> dict:
    """Current customer state as a CustomerIn dict, so an update overlays only the
    mapped fields and leaves everything else intact."""
    out = customer_service.to_out(db, membership, customer)
    return {
        "customer_number": out.customer_number, "full_name": out.full_name,
        "customer_type": out.customer_type, "company_name": out.company_name,
        "national_id": out.national_id, "nickname": out.nickname, "role": out.role,
        "street1": out.street1, "city1": out.city1, "street2": out.street2, "city2": out.city2,
        "phone": out.phone, "email": out.email, "allow_mailing": out.allow_mailing,
        "notes": out.notes, "creation_date": out.creation_date, "status": out.status,
        "source": out.source, "external_ref": out.external_ref,
        "is_paying": out.is_paying, "paid_by_membership_id": out.paid_by_membership_id,
        "params": list(out.params), "numbers": list(out.numbers),
        "flags": list(out.flags), "lists": list(out.lists),
        "fields": dict(out.fields),
        "links": [{"linked_membership_id": l.linked_membership_id, "role": l.role} for l in out.links],
    }


def _find_membership(db: Session, company_id: int, key_val: str | None, nat: str | None) -> int | None:
    """Locate an existing membership in THIS company by Priority key, then by ח.פ."""
    if key_val:
        m = (
            db.query(CustomerCompany)
            .filter(CustomerCompany.company_id == company_id, CustomerCompany.external_ref == key_val)
            .first()
        )
        if m:
            return m.id
        m = (
            db.query(CustomerCompany)
            .join(Customer, Customer.id == CustomerCompany.customer_id)
            .filter(CustomerCompany.company_id == company_id, Customer.customer_number == key_val)
            .first()
        )
        if m:
            return m.id
    if nat:
        m = (
            db.query(CustomerCompany)
            .join(Customer, Customer.id == CustomerCompany.customer_id)
            .filter(CustomerCompany.company_id == company_id, Customer.national_id == nat)
            .first()
        )
        if m:
            return m.id
    return None


def _overlay(base: dict, target: str, raw) -> None:
    """Write one mapped Priority value onto the CustomerIn dict at `target`."""
    if target.startswith("param"):
        base["params"][int(target[5:]) - 1] = _s(raw)
    elif target.startswith("num"):
        base["numbers"][int(target[3:]) - 1] = _f(raw)
    elif target.startswith("flag"):
        base["flags"][int(target[4:]) - 1] = _b(raw)
    elif target.startswith("list"):
        base["lists"][int(target[4:]) - 1] = _s(raw)
    elif target.startswith("fd:"):
        base["fields"][target[3:]] = raw
    elif target == "status":
        base["status"] = _coerce_status(raw) or base["status"]
    elif target == "creation_date":
        base["creation_date"] = _coerce_date(raw) or base["creation_date"]
    elif target == "customer_type":
        v = _s(raw)
        if v in VALID_TYPES:
            base["customer_type"] = v  # ignore unknown codes, keep existing/default
    else:  # plain core string field (full_name, phone, email, street1, ...)
        base[target] = _s(raw)


def _ingest_one(db: Session, company_id: int, rec: dict, maps, summary: dict) -> None:
    mv = {m.target_field: rec.get(m.priority_field) for m in maps}
    key_val = _s(mv.get("customer_number"))
    nat = _s(mv.get("national_id"))
    membership_id = _find_membership(db, company_id, key_val, nat)

    if membership_id:
        membership, customer = customer_service.get_membership(db, company_id, membership_id)
        base = _existing_in(db, membership, customer)
    else:
        base = _empty_in()

    for m in maps:
        _overlay(base, m.target_field, rec.get(m.priority_field))

    if not base.get("full_name"):
        base["full_name"] = key_val or "(ללא שם)"
    base["external_ref"] = key_val or base.get("external_ref")
    base["source"] = "sync"

    customer_service.upsert_customer(db, company_id, CustomerIn(**base), membership_id)
    summary["updated" if membership_id else "created"] += 1


def ingest_customers(
    db: Session, company_id: int, limit: int | None = None, offset: int | None = None
) -> dict:
    conn = get_connection(db, company_id)
    if not conn or not (conn.base_url or "").strip():
        raise PriorityError("לא הוגדר חיבור פריורטי לחברה זו")
    maps = [m for m in list_maps(db, company_id) if m.is_imported and m.target_field]
    if not maps:
        raise PriorityError("אין שדות ממופים לקליטה — הגדר מיפוי תחילה")

    summary = {
        "total": 0, "created": 0, "updated": 0, "skipped": 0,
        "errors": [], "has_more": False,
    }

    # Windowed (batched) mode — one bounded request, driven by the client loop.
    # Falls back to the original "stream everything" mode only when no offset is
    # given (kept for scripts/CLI; the UI always batches to dodge the 30s timeout).
    if offset is not None:
        batch = limit or 150
        records = _fetch_window(conn, batch, offset)
        summary["has_more"] = len(records) >= batch
        source = records
    else:
        source = _fetch_records(conn, limit)

    for rec in source:
        summary["total"] += 1
        try:
            _ingest_one(db, company_id, rec, maps, summary)
        except Exception as e:  # noqa: BLE001 — isolate a bad record, keep going
            db.rollback()
            summary["skipped"] += 1
            if len(summary["errors"]) < 50:
                key = None
                for m in maps:
                    if m.target_field == "customer_number":
                        key = _s(rec.get(m.priority_field))
                summary["errors"].append({"key": key, "error": str(e)})
    return summary
