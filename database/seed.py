"""Seed the database: super-admin + 2 demo companies, each with its own custom
classification fields, plus customers — including ONE customer shared between both
companies with different classification values, and a building-committee (ועד) that
another customer links to and pays on behalf of.

Run from anywhere (the DB path is absolute, see backend/app/config.py):

    backend\\.venv\\Scripts\\python.exe database\\seed.py

The ORM models live in the backend app layer; this script imports them.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Make the backend app package importable when run as a plain script.
BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Company,
    Customer,
    CustomerType,
    CustomerCompany,
    CustomerFieldValue,
    CustomerLink,
    FieldDefinition,
    FieldType,
    MembershipStatus,
    ParamLabel,
    RoleOption,
    DEFAULT_ROLE_OPTIONS,
    User,
    UserRole,
)


def _company(db, slug: str, name: str) -> Company:
    c = Company(name=name, slug=slug, contact_email=f"info@{slug}.co.il", phone="03-1234567")
    db.add(c)
    db.flush()
    for i, label in enumerate(DEFAULT_ROLE_OPTIONS):
        db.add(RoleOption(company_id=c.id, label=label, sort_order=i))
    return c


def _field(db, company_id, key, label, ftype, options=None, order=0) -> FieldDefinition:
    fd = FieldDefinition(
        company_id=company_id,
        key=key,
        label=label,
        field_type=ftype,
        options=options,
        sort_order=order,
    )
    db.add(fd)
    db.flush()
    return fd


def _customer(db, full_name, email=None, phone=None, national_id=None,
              ctype=CustomerType.PERSON) -> Customer:
    cust = Customer(
        full_name=full_name, email=email, phone=phone,
        national_id=national_id, customer_type=ctype,
    )
    db.add(cust)
    db.flush()
    return cust


def _link(db, company_id, customer_id, status=MembershipStatus.ACTIVE,
          source="manual") -> CustomerCompany:
    m = CustomerCompany(
        company_id=company_id, customer_id=customer_id, status=status, source=source
    )
    db.add(m)
    db.flush()
    return m


def _value(db, membership_id, field_id, value):
    db.add(
        CustomerFieldValue(
            membership_id=membership_id,
            field_definition_id=field_id,
            value=value if isinstance(value, str) else json.dumps(value, ensure_ascii=False),
        )
    )


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.role == UserRole.SUPER_ADMIN).first():
            print("Already seeded; skipping. Delete database/tactcrm.db to reseed.")
            return

        db.add(User(company_id=None, full_name="Super Admin",
                    email="root@tact-crm.io", role=UserRole.SUPER_ADMIN))

        # ---- Company DEMO ----
        demo = _company(db, "demo", "חברת דמו בע\"מ")
        d_status = _field(db, demo.id, "status", "סטטוס לקוח", FieldType.SELECT,
                          ["ליד", "פעיל", "לא פעיל"], 0)
        d_source = _field(db, demo.id, "lead_source", "מקור הגעה", FieldType.SELECT,
                          ["אתר", "הפניה", "קמפיין", "תערוכה"], 1)
        d_rating = _field(db, demo.id, "rating", "דירוג (1-5)", FieldType.NUMBER, None, 2)
        # Demo renames its first two parameter slots; the rest stay "פרמטר N".
        db.add(ParamLabel(company_id=demo.id, param_index=1, label="תחום עניין"))
        db.add(ParamLabel(company_id=demo.id, param_index=2, label="דירוג פנימי"))
        db.add_all([
            User(company_id=demo.id, full_name="אדמין דמו",
                 email="admin@demo.co.il", role=UserRole.COMPANY_ADMIN),
            User(company_id=demo.id, full_name="נציג מכירות דמו",
                 email="user@demo.co.il", role=UserRole.COMPANY_USER),
        ])

        # ---- Company BNB ----
        bnb = _company(db, "bnb", "ב.נ.ב שיווק")
        db.add_all([
            User(company_id=bnb.id, full_name="אדמין בנב",
                 email="admin@bnb.co.il", role=UserRole.COMPANY_ADMIN),
            User(company_id=bnb.id, full_name="נציג בנב",
                 email="user@bnb.co.il", role=UserRole.COMPANY_USER),
        ])
        db.flush()

        # ---- Customers for DEMO ----
        demo_people = [
            ("משה כהן", "moshe@example.com", "050-1111111", "ליד", "אתר", 4),
            ("שרה לוי", "sara@example.com", "052-2222222", "פעיל", "הפניה", 5),
            ("דניאל פרץ", "daniel@example.com", "053-3333333", "פעיל", "קמפיין", 3),
            ("רחל מזרחי", "rachel@example.com", "054-4444444", "לא פעיל", "תערוכה", 2),
        ]
        demo_m: dict[str, CustomerCompany] = {}
        for idx, (name, email, phone, st, src, rate) in enumerate(demo_people, start=1):
            cust = _customer(db, name, email, phone, national_id=str(abs(hash(email)) % 10**9))
            cust.customer_number = f"1{idx:03d}"
            cust.nickname = name.split()[0]
            cust.role = "תושב"
            cust.city1 = "תל אביב"
            cust.street1 = f"רחוב הדגמה {idx}"
            cust.param1 = f"פרמטר 1 של {name}"
            cust.param2 = str(rate)
            m = _link(db, demo.id, cust.id)
            demo_m[name] = m
            _value(db, m.id, d_status.id, st)
            _value(db, m.id, d_source.id, src)
            _value(db, m.id, d_rating.id, str(rate))

        # Committee (ועד הבית) is itself a customer; residents link to it. The
        # committee pays on behalf of משה כהן, who does not pay himself.
        committee = _customer(db, "ועד הבית - רחוב הרצל 5", "vaad@example.com",
                              "03-5550000", national_id="500000005",
                              ctype=CustomerType.ORGANIZATION)
        committee.customer_number = "1005"
        committee.role = "ועד הבית"
        committee.company_name = "ועד הבית רחוב הרצל 5"
        committee.city1 = "תל אביב"
        committee.street1 = "הרצל 5"
        cm = _link(db, demo.id, committee.id)
        _value(db, cm.id, d_status.id, "פעיל")
        resident = demo_m["משה כהן"]
        resident.is_paying = False               # לא משלם בעצמו
        resident.paid_by_membership_id = cm.id   # הועד משלם במקומו
        # משה מקושר לועד הבית, בתפקיד "ועד בית"
        db.add(CustomerLink(membership_id=resident.id, linked_membership_id=cm.id, role="ועד בית"))

        # ---- Customers for BNB ----
        bnb_people = [
            ("אבי שטרן", "avi@example.com", "058-5555555"),
            ("מיכל ביטון", "michal@example.com", "050-6666666"),
            ("יעקב אברהמי", "yaakov@example.com", "052-7777777"),
        ]
        for idx, (name, email, phone) in enumerate(bnb_people, start=1):
            cust = _customer(db, name, email, phone, national_id=str(abs(hash(email)) % 10**9))
            cust.customer_number = f"2{idx:03d}"
            cust.nickname = name.split()[0]
            cust.city1 = "חיפה"
            cust.street1 = f"שדרות הנמל {idx}"
            _link(db, bnb.id, cust.id)

        # ---- SHARED customer: linked to BOTH companies, different classification ----
        shared = _customer(db, "נועה אדלר (לקוחה משותפת)", "noa@example.com",
                           "050-9999999", national_id="123456789",
                           ctype=CustomerType.ORGANIZATION)
        shared.customer_number = "9001"
        shared.company_name = "נועה אדלר בע\"מ"
        shared.nickname = "נועה"
        shared.city1 = "ירושלים"
        shared.street1 = "יפו 12"
        md = _link(db, demo.id, shared.id, source="manual")
        _value(db, md.id, d_status.id, "פעיל")
        _value(db, md.id, d_source.id, "הפניה")
        _value(db, md.id, d_rating.id, "5")
        _link(db, bnb.id, shared.id, source="import")

        db.commit()
        print("Seed complete.")
        print("Login emails (dev-login, no password):")
        print("  root@tact-crm.io      (super_admin)")
        print("  admin@demo.co.il      (company_admin - demo)")
        print("  user@demo.co.il       (company_user  - demo)")
        print("  admin@bnb.co.il       (company_admin - bnb)")
        print("  user@bnb.co.il        (company_user  - bnb)")
        print("Shared customer is linked to BOTH companies.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
