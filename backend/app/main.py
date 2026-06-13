from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .api import (
    api_keys,
    auth,
    companies,
    customers,
    dashboard,
    display_columns,
    field_defs,
    flag_labels,
    health,
    list_fields,
    number_labels,
    param_labels,
    priority,
    project_field_labels,
    projects,
    public_api,
    role_options,
    users,
)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    def _init_db():
        # Zero-config schema for local dev only. In production the schema is owned
        # by Alembic / the deploy-time bootstrap (app.bootstrap), so we never let
        # every Lambda cold start hammer RDS with a create_all.
        if not settings.is_dev:
            return
        # Import models so they are registered on Base.metadata before create_all.
        from . import models  # noqa: F401

        Base.metadata.create_all(bind=engine)

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(dashboard.router)
    app.include_router(companies.router)
    app.include_router(users.router)
    app.include_router(field_defs.router)
    app.include_router(role_options.router)
    app.include_router(param_labels.router)
    app.include_router(number_labels.router)
    app.include_router(flag_labels.router)
    app.include_router(list_fields.router)
    app.include_router(display_columns.router)
    app.include_router(projects.router)
    app.include_router(project_field_labels.router)
    app.include_router(customers.router)
    app.include_router(api_keys.router)
    app.include_router(public_api.router)
    app.include_router(priority.router)
    return app


app = create_app()
