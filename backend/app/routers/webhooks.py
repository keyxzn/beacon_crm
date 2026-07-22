from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas, ai_service
from app.config import settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/whatsapp", response_model=schemas.LeadOut)
def whatsapp_inbound(
    payload: schemas.WhatsAppInboundPayload,
    token: str = Query(..., description="Verify token dari WA gateway (Meta Cloud API / Twilio dsb)"),
    db: Session = Depends(get_db),
):
    """Endpoint yang dipanggil provider WA tiap ada chat masuk dari nomor baru/lama.
    Gak pakai login user biasa (yang chat itu customer, bukan user internal) — makanya
    proteksinya pakai verify token statis, pola sama kayak webhook WA/Meta pada umumnya.

    Alurnya: customer chat -> cari/bikin Customer by phone -> bikin Lead capture_method=whatsapp,
    langsung masuk in_review (skip draft) biar nongol di antrian "Menunggu Review" manager buat
    di-assign ke sales & diputusin, sesuai relasi Customer -> Sales -> Opportunity."""
    if token != settings.whatsapp_webhook_token:
        raise HTTPException(status_code=401, detail="Verify token gak valid.")

    now = datetime.now(timezone.utc)

    customer = db.query(models.Customer).filter(models.Customer.phone == payload.phone).first()
    if not customer:
        customer = models.Customer(
            name=payload.company or payload.customer_name or payload.phone,
            contact_name=payload.customer_name,
            phone=payload.phone,
            channel="WhatsApp",
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)

    lead = models.Lead(
        name=payload.customer_name or "Kontak WhatsApp",
        company=payload.company or customer.name,
        phone=payload.phone,
        source="WhatsApp",
        customer_id=customer.id,
        capture_method=models.LeadCaptureEnum.whatsapp,
        description=payload.message,
        approval_status=models.ApprovalStatusEnum.in_review,
        submitted_at=now,
        last_activity_at=now,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    if payload.message:
        db.add(models.Interaction(
            lead_id=lead.id,
            type=models.InteractionTypeEnum.note,
            note=f"Chat WA masuk otomatis: \u201c{payload.message}\u201d",
        ))
        db.commit()

    scored = ai_service.score_lead(
        {"status": lead.status.value, "source": lead.source, "company": lead.company}, []
    )
    lead.ai_score = scored["score"]
    lead.ai_score_reason = scored["reason"]
    db.commit()
    db.refresh(lead)

    data = {c.name: getattr(lead, c.name) for c in models.Lead.__table__.columns}
    data["owner_name"] = None
    data["reviewer_name"] = None
    data["customer_name"] = customer.name
    return schemas.LeadOut(**data)
