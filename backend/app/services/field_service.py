"""Serialize / deserialize / validate custom field values against their definition.

Values are persisted as text on CustomerFieldValue. This module is the single
place that knows how each FieldType maps to/from a stored string.
"""
import json
from typing import Any

from fastapi import HTTPException, status

from ..models import FieldDefinition, FieldType


def _bad(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


def serialize_value(fd: FieldDefinition, raw: Any) -> str | None:
    """Validate `raw` against the field definition and return its stored string."""
    if raw is None or raw == "":
        if fd.is_required:
            raise _bad(f"Field '{fd.key}' is required")
        return None

    ftype = fd.field_type
    if ftype == FieldType.NUMBER:
        try:
            float(raw)
        except (TypeError, ValueError):
            raise _bad(f"Field '{fd.key}' must be a number")
        return str(raw)

    if ftype == FieldType.BOOLEAN:
        truthy = raw in (True, "true", "True", 1, "1")
        return "true" if truthy else "false"

    if ftype == FieldType.DATE:
        return str(raw)  # ISO date string (YYYY-MM-DD), validated client-side

    if ftype == FieldType.SELECT:
        if fd.options and str(raw) not in fd.options:
            raise _bad(f"'{raw}' is not a valid option for '{fd.key}'")
        return str(raw)

    if ftype == FieldType.MULTISELECT:
        values = raw if isinstance(raw, list) else [raw]
        if fd.options:
            invalid = [v for v in values if v not in fd.options]
            if invalid:
                raise _bad(f"Invalid options for '{fd.key}': {invalid}")
        return json.dumps(values, ensure_ascii=False)

    return str(raw)  # TEXT


def deserialize_value(fd: FieldDefinition, stored: str | None) -> Any:
    """Turn a stored string back into a typed value for API output."""
    if stored is None:
        return None
    ftype = fd.field_type
    if ftype == FieldType.NUMBER:
        try:
            f = float(stored)
            return int(f) if f.is_integer() else f
        except ValueError:
            return stored
    if ftype == FieldType.BOOLEAN:
        return stored == "true"
    if ftype == FieldType.MULTISELECT:
        try:
            return json.loads(stored)
        except json.JSONDecodeError:
            return []
    return stored  # TEXT / DATE / SELECT
