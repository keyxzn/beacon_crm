from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user

router = APIRouter(prefix="/activities", tags=["activities"])


def _enrich(activity: models.Activity) -> dict:
    """Tambah computed fields lead_name dan assigned_to_name ke activity."""
    d = {
        "id": activity.id,
        "lead_id": activity.lead_id,
        "deal_id": activity.deal_id,
        "owner_id": activity.owner_id,
        "type": activity.type,
        "title": activity.title,
        "due_at": activity.due_at,
        "completed_at": activity.completed_at,
        "created_at": activity.created_at,
        "lead_name": activity.lead.company if activity.lead else None,
        "assigned_to_name": activity.lead.owner.name if activity.lead and activity.lead.owner else None,
    }
    return d


@router.get("", response_model=List[schemas.ActivityOut])
def list_activities(
    filter: Optional[str] = None,  # "today" | "overdue" | "week" | "due_today" | None (semua)
    owner_id: Optional[str] = None,  # cuma efektif buat manager/admin — filter tugas milik 1 sales tertentu
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Activity)
    if current_user.role == models.RoleEnum.sales:
        q = q.filter(models.Activity.owner_id == current_user.id)
    elif owner_id:
        q = q.filter(models.Activity.owner_id == owner_id)

    now = datetime.now(timezone.utc)

    if filter == "overdue":
        q = q.filter(models.Activity.due_at < now, models.Activity.completed_at.is_(None))
    elif filter == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start.replace(hour=23, minute=59, second=59)
        q = q.filter(models.Activity.due_at.between(start, end))
    elif filter == "due_today":
        # Buat widget "Tugas hari ini" itu gabung overdue + due hari ini,
        # biar gak ada tugas telat yang "ketutup" dan kelihatan aman padahal enggak.
        end = now.replace(hour=23, minute=59, second=59)
        q = q.filter(models.Activity.due_at <= end, models.Activity.completed_at.is_(None))
    elif filter == "week":
        from datetime import timedelta
        q = q.filter(models.Activity.due_at.between(now, now + timedelta(days=7)))

    activities = q.order_by(models.Activity.due_at.asc()).all()
    return [_enrich(a) for a in activities]


@router.post("", response_model=schemas.ActivityOut)
def create_activity(
    payload: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump()
    if current_user.role == models.RoleEnum.sales:
        data["owner_id"] = current_user.id

    activity = models.Activity(**data)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return _enrich(activity)


@router.post("/{activity_id}/toggle", response_model=schemas.ActivityOut)
def toggle_activity(
    activity_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    activity = db.query(models.Activity).filter(models.Activity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Aktivitas gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and activity.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke tugas ini.")

    activity.completed_at = None if activity.completed_at else datetime.now(timezone.utc)
    db.commit()
    db.refresh(activity)
    return _enrich(activity)