from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import get_current_user

router = APIRouter(prefix="/customers", tags=["customers"])


def _to_customer_out(customer: models.Customer) -> schemas.CustomerOut:
    leads = customer.leads
    opp_count = sum(len(l.deals) for l in leads)
    last_interaction = None
    for l in leads:
        if l.last_activity_at and (last_interaction is None or l.last_activity_at > last_interaction):
            last_interaction = l.last_activity_at
    return schemas.CustomerOut(
        id=customer.id,
        name=customer.name,
        contact_name=customer.contact_name,
        phone=customer.phone,
        email=customer.email,
        channel=customer.channel,
        created_at=customer.created_at,
        leads_given=len(leads),
        opportunities_count=opp_count,
        is_repeat=len(leads) > 1,
        last_interaction_at=last_interaction,
    )


@router.get("", response_model=List[schemas.CustomerOut])
def list_customers(
    search: Optional[str] = None,
    repeat_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.Customer)

    # Sales cuma lihat customer yang pernah ngasih lead ke dia sendiri.
    if current_user.role == models.RoleEnum.sales:
        q = q.join(models.Lead, models.Lead.customer_id == models.Customer.id).filter(
            models.Lead.owner_id == current_user.id
        ).distinct()

    if search:
        like = f"%{search}%"
        q = q.filter((models.Customer.name.ilike(like)) | (models.Customer.contact_name.ilike(like)))

    customers = [_to_customer_out(c) for c in q.order_by(models.Customer.created_at.desc()).all()]
    if repeat_only:
        customers = [c for c in customers if c.is_repeat]
    return customers


@router.post("", response_model=schemas.CustomerOut)
def create_customer(
    payload: schemas.CustomerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    customer = models.Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return _to_customer_out(customer)


@router.get("/{customer_id}", response_model=schemas.CustomerOut)
def get_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer gak ditemukan.")
    return _to_customer_out(customer)
