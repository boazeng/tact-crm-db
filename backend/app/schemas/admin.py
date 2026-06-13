"""Pydantic schemas for company + user management endpoints."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


# ---------- Companies ----------
class CompanyIn(BaseModel):
    name: str
    slug: str
    contact_email: str | None = None
    phone: str | None = None
    is_active: bool = True


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    contact_email: str | None
    phone: str | None
    is_active: bool
    created_at: datetime


# ---------- Users (managers only) ----------
class UserIn(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    role: str
    company_id: int | None = None
    is_active: bool = True


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str | None
    role: str
    company_id: int | None
    is_active: bool
    created_at: datetime
