from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app import schemas
from app.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/chain", response_model=schemas.DashboardChainOut)
def get_chain(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Angka buat widget rantai Customer -> Sales -> Opportunity -> Pipeline -> Project -> Purchase -> Inventory
    di Dashboard. Sales cuma lihat lingkupnya sendiri, manager/admin lihat semua tim."""
    lead_q = db.query(models.Lead)
    deal_q = db.query(models.Deal)
    project_q = db.query(models.Project)
    purchase_q = db.query(models.Purchase)

    if current_user.role == models.RoleEnum.sales:
        lead_q = lead_q.filter(models.Lead.owner_id == current_user.id)
        deal_q = deal_q.filter(models.Deal.owner_id == current_user.id)
        project_q = project_q.filter(models.Project.owner_id == current_user.id)
        purchase_q = purchase_q.filter(models.Purchase.requested_by == current_user.id)
        sales_count = 1
    else:
        sales_count = db.query(models.User).filter(models.User.role == models.RoleEnum.sales).count()

    leads = lead_q.all()
    deals = deal_q.all()
    projects = project_q.all()
    purchases = purchase_q.all()

    customer_ids = {l.customer_id for l in leads if l.customer_id}
    opportunity_count = len(deals)
    pipeline_value = sum(float(d.value or 0) for d in deals if d.stage != models.DealStageEnum.closed_lost)
    auto_lead_count = sum(1 for l in leads if l.capture_method == models.LeadCaptureEnum.whatsapp)
    manual_lead_count = sum(1 for l in leads if l.capture_method == models.LeadCaptureEnum.manual)

    project_count = len(projects)
    project_ongoing_count = sum(1 for p in projects if p.status == models.ProjectStatusEnum.ongoing)
    # PR yang lagi nunggu approval manager — sales lihat punya sendiri, manager/admin lihat semua
    purchase_pending_count = sum(
        1 for p in purchases
        if p.type == models.PurchaseTypeEnum.request and p.status == models.PurchaseStatusEnum.submitted
    )
    inventory_low_stock_count = db.query(models.Product).filter(
        models.Product.stock_qty <= models.Product.reorder_level
    ).count()

    return schemas.DashboardChainOut(
        customer_count=len(customer_ids),
        sales_count=sales_count,
        opportunity_count=opportunity_count,
        pipeline_value=pipeline_value,
        auto_lead_count=auto_lead_count,
        manual_lead_count=manual_lead_count,
        project_count=project_count,
        project_ongoing_count=project_ongoing_count,
        purchase_pending_count=purchase_pending_count,
        inventory_low_stock_count=inventory_low_stock_count,
    )