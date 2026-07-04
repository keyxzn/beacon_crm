from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user, require_roles
from app.security import hash_password

router = APIRouter(prefix="/team", tags=["team"])


@router.get("", response_model=List[schemas.UserOut])
def list_team(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "manager")),
):
    return db.query(models.User).order_by(models.User.role).all()


@router.post("", response_model=schemas.UserOut, status_code=201)
def create_team_member(
    payload: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """Cuma admin yang bisa bikin akun baru buat manager/sales (atau admin lain)."""
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email ini udah dipakai akun lain.")

    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def delete_team_member(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Gak bisa hapus akun sendiri.")
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User gak ditemukan.")

    db.delete(target)
    db.commit()


@router.patch("/me", response_model=schemas.UserOut)
def update_me(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/{user_id}/role", response_model=schemas.UserOut)
def update_role(
    user_id: str,
    payload: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin")),
):
    """Cuma admin yang bisa ganti role anggota tim (promote/demote)."""
    target = db.query(models.User).filter(models.User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User gak ditemukan.")
    if target.id == current_user.id:
        raise HTTPException(status_code=400, detail="Gak bisa ganti role akun sendiri.")

    target.role = payload.role
    db.commit()
    db.refresh(target)
    return target