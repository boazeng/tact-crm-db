# TACT-CRM

Multi-tenant CRM. Each **company** (tenant) manages its own customers and sees only its
own data. A **customer** is a *global* identity that can belong to more than one company;
each company classifies the customer with its own **custom fields** on top of the regular
contact details. Managers-only (no end-customer login). Hebrew RTL UI. Local-first dev,
deployed to AWS (Postgres RDS + S3 + App Runner planned). Programmatic access via per-company
API keys.

## Project rules

### 1. File size limit
Every source file MUST stay **under 500–600 lines** (`*.py`, `*.ts`, `*.tsx`, `*.css`).
Split by responsibility before the limit. Exempt: DB dumps, migrations, lock files.

### 2. Layered architecture (backend)
Imports flow **downward only**.
```
api/         ← HTTP controllers. Thin. Validate → call services.
schemas/     ← Pydantic DTOs (request/response shapes).
deps.py      ← FastAPI dependencies (auth, db session, tenant resolution).
services/    ← Business logic (customer_service, field_service).
models/      ← SQLAlchemy ORM. Pure data shape, no business logic.
auth/        ← JWT (tokens.py) + API-key gen/hash (keys.py).
database.py  ← Engine + SessionLocal.  config.py ← Settings from env.
```
`models/` import nothing higher. `api/` never does business logic directly — it goes through
`services/`.

## Data model — the core idea
- **`customers`** — GLOBAL identity (full_name, email, phone, national_id, type, notes). NOT
  company-scoped. De-duped by national_id/email.
- **`customer_companies`** — the M:N **membership**, and the tenant-scoped row. Carries
  `company_id, customer_id (UNIQUE together), status, source, external_ref`. A company can
  only ever reach a customer through its own membership.
- **`field_definitions`** — per-company custom fields. A *classification* is just a field of
  type `select`/`multiselect`. `UNIQUE(company_id, key)`.
- **`customer_field_values`** — the value of one field for one membership. Hangs off the
  membership, so the same customer carries different classifications in each company.
- **`api_keys`** — per-company; only sha256 hash + prefix stored.

## Multi-tenancy
Shared DB. Tenant is resolved by FastAPI dependencies, **never** from a client-supplied
company_id:
- JWT (admin UI): `resolve_company_id` / `get_current_company`. `super_admin` must pass
  `?company_id=`; everyone else is locked to their own company.
- X-API-Key (programmatic): `get_api_company` resolves the tenant from the key hash.

## Roles
| Role | company_id | Capability |
|---|---|---|
| `super_admin` | NULL | All companies; must pass ?company_id for tenant-scoped calls |
| `company_admin` | set | Manage users, fields, API keys, customers in own company |
| `company_user` | set | Manage customers in own company |

## API surfaces
- **Admin UI** (JWT): `/api/auth`, `/api/admin/companies`, `/api/admin/users`,
  `/api/field-definitions`, `/api/customers`, `/api/api-keys`, `/api/dashboard`.
- **Programmatic** (X-API-Key): `/api/v1/customers` (list/get/create/update). Same business
  logic as the admin customer API, different auth. OpenAPI docs at `/docs`.

## Tech stack
FastAPI + SQLAlchemy 2.0 + Pydantic 2 · SQLite local / Postgres (RDS) · React 18 + Vite + TS
+ Tailwind 3 + TACT design system · JWT + X-API-Key · dev-login.

## Dev setup (PowerShell)
```powershell
# Backend (from tact-crm/ root)
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
.\backend\.venv\Scripts\python.exe database\seed.py          # seed (creates database/tactcrm.db)
cd backend
..\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --port 8010

# Frontend
cd frontend
npm install
npm run dev    # http://localhost:5200 (proxies /api → :8010)
```
Dedicated ports (vite `strictPort`): **frontend 5200, backend 8010** — chosen so TACT-CRM
doesn't clash with other local projects.
Dev login (no password): `root@tact-crm.io` (super), `admin@demo.co.il`, `user@demo.co.il`,
`admin@bnb.co.il`, `user@bnb.co.il`. The seed creates one customer linked to BOTH demo and
bnb with different classification values in each.

> **All DB artifacts live in `database/`** (at the repo root): the SQLite file
> `database/tactcrm.db`, `database/schema.sql` (DDL snapshot), and `database/seed.py`. The
> SQLite path is **absolute** (computed in `config.py`), so CWD no longer matters. The ORM
> models stay in `backend/app/models/` (they are the app's data layer).
>
> **Schema changes use Alembic** (`database/alembic.ini` + `database/migrations/`), so they
> apply **without dropping data** — even on SQLite (`render_as_batch`). Workflow: edit a model →
> `python -m alembic revision --autogenerate -m "..."` → `alembic upgrade head` (run from
> `database/`). Full instructions in `database/README.md`. `create_all` still runs at app
> startup for zero-config dev (creates missing tables only); Alembic is authoritative for
> evolving an existing DB.

## Out of scope (next phases)
External-system sync connectors (the `source`/`external_ref` columns + an `integrations/`
folder are the plug-in points), Google OAuth, granular per-customer access, AWS deployment.
