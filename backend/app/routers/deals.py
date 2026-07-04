from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, ai_service
from app.deps import get_current_user

router = APIRouter(prefix="/deals", tags=["deals"])


def _recalc_probability(db: Session, deal: models.Deal):
    lead = deal.lead
    deal_dict = {"stage": deal.stage.value, "value": float(deal.value or 0)}
    lead_dict = {"status": lead.status.value if lead else None, "ai_score": lead.ai_score if lead else None}
    result = ai_service.predict_win_probability(deal_dict, lead_dict)
    deal.ai_probability = result["probability"]


@router.get("", response_model=List[schemas.DealOut])
def list_deals(
    stage: Optional[str] = None,
    lead_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Deal)
    if current_user.role == models.RoleEnum.sales:
        q = q.filter(models.Deal.owner_id == current_user.id)
    if stage:
        q = q.filter(models.Deal.stage == stage)
    if lead_id:
        q = q.filter(models.Deal.lead_id == lead_id)
    return q.order_by(models.Deal.created_at.desc()).all()


@router.post("", response_model=schemas.DealOut)
def create_deal(
    payload: schemas.DealCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = db.query(models.Lead).filter(models.Lead.id == payload.lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead gak ditemukan.")

    data = payload.model_dump()
    # sales cuma bisa bikin deal buat dirinya sendiri, gak bisa nge-assign ke orang lain
    if current_user.role == models.RoleEnum.sales:
        data["owner_id"] = current_user.id

    deal = models.Deal(**data)
    db.add(deal)
    db.commit()
    db.refresh(deal)

    _recalc_probability(db, deal)
    db.commit()
    db.refresh(deal)
    return deal


@router.patch("/{deal_id}", response_model=schemas.DealOut)
def update_deal(
    deal_id: str,
    payload: schemas.DealUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and deal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke deal ini.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deal, field, value)

    # stage pindah -> hitung ulang win probability
    if payload.stage is not None:
        _recalc_probability(db, deal)

    db.commit()
    db.refresh(deal)
    return deal


@router.post("/{deal_id}/documents", response_model=schemas.DealDocumentOut)
def add_deal_document(
    deal_id: str,
    payload: schemas.DealDocumentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Catat output/dokumen buat deal ini dan bisa dipakai di stage manapun
    (catatan kualifikasi, proposal, term sheet negosiasi, kontrak final, dll)."""
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal gak ditemukan.")
    if current_user.role == models.RoleEnum.sales and deal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke deal ini.")

    doc = models.DealDocument(
        deal_id=deal.id,
        stage=payload.stage or deal.stage,
        doc_type=payload.doc_type,
        label=payload.label,
        url=payload.url,
        note=payload.note,
        created_by=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{deal_id}/documents/{document_id}", status_code=204)
def delete_deal_document(
    deal_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    doc = db.query(models.DealDocument).filter(
        models.DealDocument.id == document_id, models.DealDocument.deal_id == deal_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Dokumen gak ditemukan.")
    deal = doc.deal
    if current_user.role == models.RoleEnum.sales and deal.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Kamu gak punya akses ke deal ini.")
    db.delete(doc)
    db.commit()