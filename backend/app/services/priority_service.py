"""Priority ERP sync — connection settings, live field discovery, and the
per-company Priority→CRM field mapping.

This phase builds the *configuration* surface only (connection + mapping). The
actual customer ingestion is a later phase; the mapping rows stored here are the
contract that ingestion will read.

Priority exposes an OData/REST API. We discover the field list of the customers
entity from the service `$metadata` (EDMX XML), falling back to reading the keys
of one sample record. Auth is HTTP Basic. Dependency-free (stdlib urllib + xml).
"""
import base64
import json
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import (
    PriorityConnection,
    PriorityFieldMap,
    FieldDefinition,
    ParamLabel,
    NumberLabel,
    FlagLabel,
    ListField,
    PARAM_COUNT,
    NUM_COUNT,
    FLAG_COUNT,
    LIST_COUNT,
)
from ..models.param_label import default_param_label
from ..models.number_label import default_number_label
from ..models.flag_label import default_flag_label
from ..models.list_field import default_list_label
from .priority_fields_ref import enrich as _enrich_fields


# ---------------------------------------------------------------------------
# Connection
# ---------------------------------------------------------------------------
def get_connection(db: Session, company_id: int) -> PriorityConnection | None:
    return (
        db.query(PriorityConnection)
        .filter(PriorityConnection.company_id == company_id)
        .first()
    )


def upsert_connection(db: Session, company_id: int, data: dict) -> PriorityConnection:
    """Create or update the company's single Priority connection.

    A blank/omitted password leaves the stored one untouched (so the UI can save
    other settings without re-typing the secret).
    """
    conn = get_connection(db, company_id)
    if conn is None:
        conn = PriorityConnection(company_id=company_id)
        db.add(conn)
    for k in ("base_url", "username", "entity_name", "is_active"):
        if k in data and data[k] is not None:
            setattr(conn, k, data[k])
    pw = data.get("password")
    if pw:  # only overwrite when a non-empty password is provided
        conn.password = pw
    db.commit()
    db.refresh(conn)
    return conn


# ---------------------------------------------------------------------------
# Live Priority field discovery
# ---------------------------------------------------------------------------
class PriorityError(Exception):
    """A connection/fetch failure with a user-facing (Hebrew) message."""


def _request(url: str, conn: PriorityConnection, accept: str) -> bytes:
    req = urllib.request.Request(url, headers={"Accept": accept})
    if conn.username:
        token = base64.b64encode(
            f"{conn.username}:{conn.password or ''}".encode()
        ).decode()
        req.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            raise PriorityError("הזדהות נכשלה — בדוק שם משתמש / סיסמה")
        raise PriorityError(f"פריורטי החזיר שגיאה {e.code}")
    except urllib.error.URLError as e:
        raise PriorityError(f"לא ניתן להתחבר לכתובת פריורטי ({e.reason})")
    except Exception as e:  # noqa: BLE001 — surface anything as a clean message
        raise PriorityError(f"שגיאת חיבור: {e}")


def _base(conn: PriorityConnection) -> str:
    base = (conn.base_url or "").strip()
    if not base:
        raise PriorityError("לא הוגדרה כתובת פריורטי")
    return base if base.endswith("/") else base + "/"


# OData EDMX is namespaced; match tags by local name to stay version-agnostic.
def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _parse_metadata(xml: bytes, entity: str) -> list[dict]:
    root = ET.fromstring(xml)
    target = entity.strip().lower()
    fields: list[dict] = []
    for et in root.iter():
        if _local(et.tag) != "EntityType":
            continue
        if (et.get("Name") or "").lower() != target:
            continue
        for prop in et:
            if _local(prop.tag) != "Property":
                continue
            name = prop.get("Name")
            if not name:
                continue
            fields.append({
                "name": name,
                "type": prop.get("Type") or "",
                "label": name,
            })
        if fields:
            break
    return fields


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T")


def _infer_type(v) -> str:
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, (int, float)):
        return "number"
    if isinstance(v, str):
        return "date" if _DATE_RE.match(v) else "string"
    return ""


def _parse_sample(body: bytes) -> list[dict]:
    """Build the field list from a few sample records.

    Reading actual records is far cheaper than the (multi-MB) ``$metadata`` doc
    and gives us a real example VALUE per field — which is what makes the mapping
    screen decidable. The OData JSON is already typed, so we infer the type from
    the first non-null value seen across the sample rows.
    """
    data = json.loads(body.decode("utf-8", "replace"))
    rows = data.get("value") if isinstance(data, dict) else None
    if not rows and isinstance(data, dict):
        rows = [data]
    if not rows:
        return []
    fields: dict[str, dict] = {}
    order: list[str] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        for k, v in row.items():
            if k.startswith("@"):
                continue
            if k not in fields:
                fields[k] = {"name": k, "type": "", "label": k, "sample": ""}
                order.append(k)
            f = fields[k]
            if not f["sample"] and v not in (None, ""):
                f["sample"] = str(v)[:80]
                f["type"] = _infer_type(v)
    return [fields[k] for k in order]


def fetch_priority_fields(conn: PriorityConnection) -> list[dict]:
    """Live-fetch the field list of the configured Priority entity.

    Primary source is a small sample of records (fast, and carries example
    values). Only if the entity is empty do we fall back to the heavy
    ``$metadata`` document for the bare field names/types.
    """
    base = _base(conn)
    entity = (conn.entity_name or "CUSTOMERS").strip()
    sample = _request(f"{base}{entity}?$top=20", conn, "application/json")
    fields = _parse_sample(sample)
    if not fields:
        # Empty table — fall back to the schema document for field names.
        meta = _request(base + "$metadata", conn, "application/xml")
        fields = _parse_metadata(meta, entity)
    if not fields:
        raise PriorityError(f"לא נמצאו שדות עבור הישות '{entity}' בפריורטי")
    # Attach Hebrew descriptions + recommended targets for known fields.
    return _enrich_fields(fields)


def test_connection(db: Session, conn: PriorityConnection) -> tuple[bool, str]:
    try:
        fields = fetch_priority_fields(conn)
        ok, msg = True, f"חיבור תקין — נמצאו {len(fields)} שדות"
    except PriorityError as e:
        ok, msg = False, str(e)
    conn.last_tested_at = datetime.utcnow()
    conn.last_test_ok = ok
    conn.last_test_msg = msg
    db.commit()
    return ok, msg


# ---------------------------------------------------------------------------
# Our system fields (the right-hand side of the mapping)
# ---------------------------------------------------------------------------
# Fixed core fields on Customer / membership, with Hebrew labels.
_CORE_FIELDS: list[tuple[str, str]] = [
    ("customer_number", "מספר לקוח"),
    ("full_name", "שם מלא"),
    ("nickname", "כינוי"),
    ("role", "תפקיד"),
    ("customer_type", "סוג לקוח"),
    ("company_name", "שם חברה"),
    ("national_id", "ת.ז / ח.פ"),
    ("phone", "טלפון"),
    ("email", 'דוא"ל'),
    ("street1", "רחוב (כתובת 1)"),
    ("city1", "עיר (כתובת 1)"),
    ("street2", "רחוב (כתובת 2)"),
    ("city2", "עיר (כתובת 2)"),
    ("notes", "הערות"),
    ("creation_date", "תאריך יצירה"),
    ("status", "סטטוס לקוח (ליד/פעיל/לא פעיל)"),
    ("external_ref", "מזהה חיצוני (במערכת המקור)"),
]


def system_fields(db: Session, company_id: int) -> list[dict]:
    """The full set of CRM target fields a Priority field can map onto.

    Returns ``{key, label, group}`` items. ``key`` is what gets stored in
    ``PriorityFieldMap.target_field`` (core name, ``paramN``/``numN``/``flagN``/
    ``listN``, or ``fd:<key>`` for a classification field).
    """
    out: list[dict] = [
        {"key": k, "label": lbl, "group": "פרטי ליבה"} for k, lbl in _CORE_FIELDS
    ]

    def _labels(model, idx_attr: str) -> dict[int, str]:
        rows = db.query(model).filter(model.company_id == company_id).all()
        return {getattr(r, idx_attr): r.label for r in rows if r.is_active}

    params = _labels(ParamLabel, "param_index")
    for i in range(1, PARAM_COUNT + 1):
        out.append({
            "key": f"param{i}",
            "label": params.get(i, default_param_label(i)),
            "group": "פרמטרים",
        })
    nums = _labels(NumberLabel, "num_index")
    for i in range(1, NUM_COUNT + 1):
        out.append({
            "key": f"num{i}",
            "label": nums.get(i, default_number_label(i)),
            "group": "מספרים",
        })
    flags = _labels(FlagLabel, "flag_index")
    for i in range(1, FLAG_COUNT + 1):
        out.append({
            "key": f"flag{i}",
            "label": flags.get(i, default_flag_label(i)),
            "group": "דגלים (כן/לא)",
        })
    lists = _labels(ListField, "list_index")
    for i in range(1, LIST_COUNT + 1):
        out.append({
            "key": f"list{i}",
            "label": lists.get(i, default_list_label(i)),
            "group": "רשימות",
        })

    for fd in (
        db.query(FieldDefinition)
        .filter(FieldDefinition.company_id == company_id, FieldDefinition.is_active.is_(True))
        .order_by(FieldDefinition.sort_order, FieldDefinition.id)
        .all()
    ):
        out.append({
            "key": f"fd:{fd.key}",
            "label": fd.label,
            "group": "שדות סיווג",
        })
    return out


# ---------------------------------------------------------------------------
# Mapping rows
# ---------------------------------------------------------------------------
def list_maps(db: Session, company_id: int) -> list[PriorityFieldMap]:
    return (
        db.query(PriorityFieldMap)
        .filter(PriorityFieldMap.company_id == company_id)
        .order_by(PriorityFieldMap.sort_order, PriorityFieldMap.id)
        .all()
    )


def replace_maps(db: Session, company_id: int, rows: list[dict]) -> list[PriorityFieldMap]:
    """Bulk replace the company's mapping with the supplied rows (one per
    Priority field). Simpler and race-free vs. per-row diffing."""
    db.query(PriorityFieldMap).filter(
        PriorityFieldMap.company_id == company_id
    ).delete(synchronize_session=False)
    seen: set[str] = set()
    for i, r in enumerate(rows):
        pf = (r.get("priority_field") or "").strip()
        if not pf or pf in seen:
            continue
        seen.add(pf)
        db.add(PriorityFieldMap(
            company_id=company_id,
            priority_field=pf,
            priority_label=r.get("priority_label"),
            priority_type=r.get("priority_type"),
            target_field=(r.get("target_field") or None),
            is_imported=bool(r.get("is_imported", True)),
            sort_order=r.get("sort_order", i),
        ))
    db.commit()
    return list_maps(db, company_id)
