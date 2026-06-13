"""Users (managers) management. Super admin sees all; company admin sees own tenant."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth.passwords import hash_password
from ..deps import get_db, require_company_admin
from ..models import Company, User, UserRole
from ..schemas.admin import UserIn, UserOut


router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


def _enforce_company_scope(
    actor: User, target_company_id: int | None, db: Session
) -> int | None:
    """Validate `actor` may operate on a user in `target_company_id`; return the
    company_id to persist."""
    if actor.role == UserRole.SUPER_ADMIN:
        if target_company_id is not None:
            if not db.query(Company).filter(Company.id == target_company_id).first():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Company not found"
                )
        return target_company_id
    if target_company_id is not None and target_company_id != actor.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot manage users in another company",
        )
    return actor.company_id


@router.get("", response_model=list[UserOut])
def list_users(
    company_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(require_company_admin),
):
    q = db.query(User)
    if actor.role == UserRole.SUPER_ADMIN:
        if company_id is not None:
            q = q.filter(User.company_id == company_id)
    else:
        q = q.filter(User.company_id == actor.company_id)
    return q.order_by(User.role, User.full_name).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_company_admin),
):
    if body.role == UserRole.SUPER_ADMIN and actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super admin can create another super admin",
        )
    target_company = (
        None
        if body.role == UserRole.SUPER_ADMIN
        else _enforce_company_scope(actor, body.company_id, db)
    )
    if body.role != UserRole.SUPER_ADMIN and target_company is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non-super-admin user must have a company_id",
        )

    user = User(
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        role=body.role,
        company_id=target_company,
        is_active=body.is_active,
        password_hash=hash_password(body.password) if body.password else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{body.email}' is already in use",
        )
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_company_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if actor.role != UserRole.SUPER_ADMIN and user.company_id != actor.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if body.role == UserRole.SUPER_ADMIN and actor.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super admin can promote to super admin",
        )

    user.full_name = body.full_name
    user.email = body.email
    user.phone = body.phone
    user.role = body.role
    user.company_id = (
        None
        if body.role == UserRole.SUPER_ADMIN
        else _enforce_company_scope(actor, body.company_id, db)
    )
    user.is_active = body.is_active
    if body.password:
        user.password_hash = hash_password(body.password)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email conflict")
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_company_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    if actor.role != UserRole.SUPER_ADMIN and user.company_id != actor.company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if user.id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate yourself"
        )
    user.is_active = False
    db.commit()
