from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles

router = APIRouter(prefix="/projects", tags=["projects"])

# Project itu fase implementasi, PIC-nya Manager/Ops — BUKAN Sales (Sales cuma PIC di fase
# akuisisi: Lead & Pipeline). Makanya seluruh router ini dikunci manager/admin doang, gak ada
# view sales-scoped kayak Leads, karena Sales emang gak boleh megang modul ini sama sekali.
require_manager = require_roles("admin", "manager")


def _to_project_out(p: models.Project) -> schemas.ProjectOut:
    # spent = total value PO (Purchase Order) yang statusnya udah "received" buat project ini
    spent = 0.0
    for pur in p.purchases:
        if pur.type == models.PurchaseTypeEnum.order and pur.status == models.PurchaseStatusEnum.received:
            spent += sum(float(it.qty) * float(it.unit_price) for it in pur.items)
    budget = float(p.budget or 0)
    pct = round((spent / budget) * 100, 1) if budget > 0 else 0.0

    return schemas.ProjectOut(
        id=p.id, deal_id=p.deal_id, name=p.name, budget=budget, status=p.status,
        owner_id=p.owner_id, owner_name=p.owner.name if p.owner else None,
        deal_title=p.deal.title if p.deal else None,
        customer_name=(p.deal.lead.customer.name if p.deal and p.deal.lead and p.deal.lead.customer else None),
        start_date=p.start_date, end_date=p.end_date, notes=p.notes, created_at=p.created_at,
        spent=spent, budget_used_pct=pct,
    )


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    projects = db.query(models.Project).order_by(models.Project.created_at.desc()).all()
    return [_to_project_out(p) for p in projects]


@router.post("", response_model=schemas.ProjectOut)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    deal = db.query(models.Deal).filter(models.Deal.id == payload.deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Opportunity gak ditemukan.")
    if deal.stage != models.DealStageEnum.closed_won:
        raise HTTPException(status_code=400, detail="Project cuma bisa dibuat dari opportunity yang udah Closed Won.")

    existing = db.query(models.Project).filter(models.Project.deal_id == deal.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Opportunity ini udah punya project.")

    project = models.Project(
        deal_id=deal.id, name=payload.name, budget=payload.budget,
        owner_id=payload.owner_id or current_user.id,
        start_date=payload.start_date, end_date=payload.end_date, notes=payload.notes,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _to_project_out(project)


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project gak ditemukan.")
    return _to_project_out(project)


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
def update_project(
    project_id: str,
    payload: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project gak ditemukan.")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(project, k, v)
    db.commit()
    db.refresh(project)
    return _to_project_out(project)