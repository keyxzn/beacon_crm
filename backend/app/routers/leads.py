from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, ai_service
from app.deps import get_current_user, require_roles

router = APIRouter(prefix="/leads", tags=["leads"])

REQUIRED_SUBMIT_FIELDS = ["name", "company", "vendor_name", "description", "budget", "timeline"]


def _lead_to_dict(lead: models.Lead) -> dict:
    return {
        "id": lead.id, "name": lead.name, "company": lead.company,
        "status": lead.status.value if lead.status else None,
        "source": lead.source, "ai_score": lead.ai_score,
    }


def _interactions_to_list(interactions) -> List[dict]:
    return [{"type": i.type.value, "note": i.note} for i in interactions]


def _to_lead_out(lead: models.Lead) -> schemas.LeadOut:
    data = {c.name: getattr(lead, c.name) for c in models.Lead.__table__.columns}
    data["owner_name"] = lead.owner.name if lead.owner else None
    data["reviewer_name"] = lead.reviewer.name if lead.reviewer else None
    data["customer_name"] = lead.customer.name if lead.customer else None
    return schemas.LeadOut(**data)


@router.get("", response_model=List[schemas.LeadOut])
def list_leads(
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "priority",  # "priority" | "recent" | "name"
    dir: Optional[str] = None,  # "asc" | "desc" — override arah default tiap sort
    source: Optional[str] = None,
    approval_status: Optional[str] = "approved",  # "draft" | "in_review" | "approved" | "rejected" | "all"
    owner_id: Optional[str] = None,  # cuma admin/manager yang efektif bisa pakai ini
    customer_id: Optional[str] = None,
    capture_method: Optional[str] = None,  # "manual" | "whatsapp"
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Lead)

    if current_user.role == models.RoleEnum.sales:
        q = q.filter(models.Lead.owner_id == current_user.id)
    elif owner_id:
        q = q.filter(models.Lead.owner_id == owner_id)

    if approval_status and approval_status != "all":
        q = q.filter(models.Lead.approval_status == approval_status)
    if status:
        q = q.filter(models.Lead.status == status)
    if source:
        q = q.filter(models.Lead.source == source)
    if customer_id:
        q = q.filter(models.Lead.customer_id == customer_id)
    if capture_method:
        q = q.filter(models.Lead.capture_method == capture_method)
    if search:
        like = f"%{search}%"
        q = q.filter((models.Lead.name.ilike(like)) | (models.Lead.company.ilike(like)))

    if sort == "name":
        q = q.order_by(models.Lead.name.desc() if dir == "desc" else models.Lead.name.asc())
    elif sort == "recent":
        q = q.order_by(models.Lead.last_activity_at.asc() if dir == "asc" else models.Lead.last_activity_at.desc())
    else:  # "priority" (default) — skor AI tertinggi duluan, lead yang belum di-score taruh paling belakang
        if dir == "asc":
            q = q.order_by(models.Lead.ai_score.is_(None), models.Lead.ai_score.asc())
        else:
            q = q.order_by(models.Lead.ai_score.is_(None), models.Lead.ai_score.desc())

    return [_to_lead_out(l) for l in q.all()]


@router.post("", response_model=schemas.LeadOut)
def create_lead(
    payload: schemas.LeadCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    data = payload.model_dump()
    # sales cuma bisa bikin lead buat dirinya sendiri, gak bisa nge-assign ke orang lain
    if current_user.role == models.RoleEnum.sales:
        data["owner_id"] = current_user.id

    # lead yang dibikin sales wajib lewat review manager dulu (draft).
    # lead yang dibikin admin/manager langsung aktif, gak perlu approval ke diri sendiri.
    data["approval_status"] = (
        models.ApprovalStatusEnum.draft
        if current_user.role == models.RoleEnum.sales
        else models.ApprovalStatusEnum.approved
    )

    lead = models.Lead(**data)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    # langsung kasih skor AI awal
    scored = ai_service.score_lead(_lead_to_dict(lead), [])
    lead.ai_score = scored["score"]
    lead.ai_score_reason = scored["reason"]
    db.commit()
    db.refresh(lead)
    return _to_lead_out(lead)


@router.get("/{lead_id}", response_model=schemas.LeadDetailOut)
def get_lead_detail(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke lead ini.")

    interactions = _interactions_to_list(lead.interactions)
    summary = ai_service.summarize_lead(_lead_to_dict(lead), interactions)
    nba = ai_service.next_best_action(_lead_to_dict(lead), interactions)

    data = _to_lead_out(lead).model_dump()
    return schemas.LeadDetailOut(**data, ai_summary=summary, ai_next_best_action=nba)


@router.patch("/{lead_id}", response_model=schemas.LeadOut)
def update_lead(
    lead_id: str,
    payload: schemas.LeadUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke lead ini.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    lead.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return _to_lead_out(lead)


@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke lead ini.")

    db.delete(lead)  # cascade otomatis hapus deal, aktivitas, & interaksi terkait
    db.commit()


@router.post("/{lead_id}/submit", response_model=schemas.LeadOut)
def submit_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Sales submit lead draft (atau resubmit yang sebelumnya ditolak) buat direview manager."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and lead.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke lead ini.")
    if lead.approval_status not in (models.ApprovalStatusEnum.draft, models.ApprovalStatusEnum.rejected):
        raise HTTPException(status_code=400, detail="Lead ini udah disubmit / udah disetujui.")

    missing = [f for f in REQUIRED_SUBMIT_FIELDS if not getattr(lead, f)]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Lengkapin dulu: {', '.join(missing)} sebelum submit buat review.",
        )

    lead.approval_status = models.ApprovalStatusEnum.in_review
    lead.submitted_at = datetime.now(timezone.utc)
    lead.reviewed_at = None
    lead.reviewed_by = None
    lead.review_note = None
    db.commit()
    db.refresh(lead)
    return _to_lead_out(lead)


@router.post("/{lead_id}/review", response_model=schemas.LeadOut)
def review_lead(
    lead_id: str,
    payload: schemas.LeadReviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("admin", "manager")),
):
    """Manager/admin approve atau reject lead yang lagi in_review. Bisa sambil revisi budget/timeline."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")
    if lead.approval_status != models.ApprovalStatusEnum.in_review:
        raise HTTPException(status_code=400, detail="Lead ini gak lagi nunggu review.")

    if payload.budget is not None:
        lead.budget = payload.budget
    if payload.timeline is not None:
        lead.timeline = payload.timeline

    lead.approval_status = (
        models.ApprovalStatusEnum.approved if payload.decision == "approved"
        else models.ApprovalStatusEnum.rejected
    )
    lead.reviewed_at = datetime.now(timezone.utc)
    lead.reviewed_by = current_user.id
    lead.review_note = payload.note
    lead.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(lead)
    return _to_lead_out(lead)


@router.post("/{lead_id}/rescore", response_model=schemas.LeadOut)
def rescore_lead(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Hitung ulang AI score — dipanggil tiap kali ada interaksi baru."""
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")

    interactions = _interactions_to_list(lead.interactions)
    scored = ai_service.score_lead(_lead_to_dict(lead), interactions)
    lead.ai_score = scored["score"]
    lead.ai_score_reason = scored["reason"]
    db.commit()
    db.refresh(lead)
    return _to_lead_out(lead)


@router.get("/{lead_id}/interactions", response_model=List[schemas.InteractionOut])
def list_interactions(
    lead_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Interaction)
        .filter(models.Interaction.lead_id == lead_id)
        .order_by(models.Interaction.created_at.desc())
        .all()
    )


@router.post("/{lead_id}/interactions", response_model=schemas.InteractionOut)
def add_interaction(
    lead_id: str,
    payload: schemas.InteractionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")

    interaction = models.Interaction(
        lead_id=lead_id,
        created_by=payload.created_by or current_user.id,
        type=payload.type,
        note=payload.note,
    )
    db.add(interaction)
    lead.last_activity_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(interaction)

    # auto rescore tiap ada interaksi baru
    interactions = _interactions_to_list(lead.interactions)
    scored = ai_service.score_lead(_lead_to_dict(lead), interactions)
    lead.ai_score = scored["score"]
    lead.ai_score_reason = scored["reason"]
    db.commit()

    return interaction