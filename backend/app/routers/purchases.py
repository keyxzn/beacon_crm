from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles

router = APIRouter(prefix="/purchases", tags=["purchases"])

# Sama kayak Project — Purchase (PR/PO/Return) itu fase implementasi, PIC-nya Manager/Ops.
# Sales gak boleh megang modul ini sama sekali, jadi seluruh router dikunci manager/admin.
require_manager = require_roles("admin", "manager")

TYPE_PREFIX = {
    models.PurchaseTypeEnum.request: "PR",
    models.PurchaseTypeEnum.order: "PO",
    models.PurchaseTypeEnum.return_: "RET",
}


def _to_purchase_out(p: models.Purchase) -> schemas.PurchaseOut:
    items = [
        schemas.PurchaseItemOut(
            id=it.id, product_id=it.product_id, product_name=it.product.name if it.product else None,
            unit=it.product.unit if it.product else None, qty=it.qty, unit_price=float(it.unit_price or 0),
            subtotal=float(it.qty) * float(it.unit_price or 0),
        )
        for it in p.items
    ]
    return schemas.PurchaseOut(
        id=p.id, number=p.number, type=p.type, status=p.status,
        project_id=p.project_id, project_name=p.project.name if p.project else None,
        vendor_name=p.vendor_name, notes=p.notes,
        requested_by=p.requested_by, requester_name=p.requester.name if p.requester else None,
        approved_by=p.approved_by, approver_name=p.approver.name if p.approver else None,
        source_purchase_id=p.source_purchase_id,
        total_value=sum(i.subtotal for i in items), items=items,
        created_at=p.created_at, updated_at=p.updated_at,
    )


def _next_number(db: Session, type_: models.PurchaseTypeEnum) -> str:
    count = db.query(models.Purchase).filter(models.Purchase.type == type_).count()
    return f"{TYPE_PREFIX[type_]}-{count + 1:04d}"


@router.get("", response_model=List[schemas.PurchaseOut])
def list_purchases(
    type: Optional[str] = None,  # "request" | "order" | "return"
    status: Optional[str] = None,
    project_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    q = db.query(models.Purchase)
    if type:
        q = q.filter(models.Purchase.type == type)
    if status:
        q = q.filter(models.Purchase.status == status)
    if project_id:
        q = q.filter(models.Purchase.project_id == project_id)
    return [_to_purchase_out(p) for p in q.order_by(models.Purchase.created_at.desc()).all()]


@router.post("", response_model=schemas.PurchaseOut)
def create_purchase(
    payload: schemas.PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    if payload.type == models.PurchaseTypeEnum.return_ and not payload.source_purchase_id:
        raise HTTPException(status_code=400, detail="Purchase Return harus nunjuk ke PO asalnya.")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Minimal 1 item barang.")

    purchase = models.Purchase(
        number=_next_number(db, payload.type), type=payload.type, status=models.PurchaseStatusEnum.draft,
        project_id=payload.project_id, vendor_name=payload.vendor_name, notes=payload.notes,
        requested_by=current_user.id, source_purchase_id=payload.source_purchase_id,
    )
    db.add(purchase)
    db.flush()

    for it in payload.items:
        product = db.query(models.Product).filter(models.Product.id == it.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Produk {it.product_id} gak ketemu.")
        db.add(models.PurchaseItem(
            purchase_id=purchase.id, product_id=product.id, qty=it.qty,
            unit_price=it.unit_price if it.unit_price is not None else product.unit_price,
        ))

    db.commit()
    db.refresh(purchase)
    return _to_purchase_out(purchase)


@router.get("/{purchase_id}", response_model=schemas.PurchaseOut)
def get_purchase(
    purchase_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    purchase = db.query(models.Purchase).filter(models.Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase gak ditemukan.")
    return _to_purchase_out(purchase)


@router.patch("/{purchase_id}/status", response_model=schemas.PurchaseOut)
def update_purchase_status(
    purchase_id: str,
    payload: schemas.PurchaseStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Ganti status PR/PO/Return. Efek samping otomatis ke stock:
    - PO -> 'received'  : stock produk NAMBAH (barang dateng dari vendor)
    - Return -> 'completed' : stock produk BERKURANG (barang dibalikin ke vendor)
    Efek ini cuma jalan sekali (dicek dari status sebelumnya) biar gak dobel keitung
    kalau status di-set ulang ke nilai yang sama."""
    purchase = db.query(models.Purchase).filter(models.Purchase.id == purchase_id).first()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase gak ditemukan.")

    prev_status = purchase.status
    new_status = payload.status

    if new_status == models.PurchaseStatusEnum.approved and prev_status != new_status:
        purchase.approved_by = current_user.id

    purchase.status = new_status

    if (
        purchase.type == models.PurchaseTypeEnum.order
        and new_status == models.PurchaseStatusEnum.received
        and prev_status != models.PurchaseStatusEnum.received
    ):
        for it in purchase.items:
            db.add(models.StockMovement(
                product_id=it.product_id, type=models.StockMovementTypeEnum.in_, qty=it.qty,
                reference=purchase.number, note=f"Barang diterima dari PO {purchase.number}",
                created_by=current_user.id,
            ))
            it.product.stock_qty += it.qty

    if (
        purchase.type == models.PurchaseTypeEnum.return_
        and new_status == models.PurchaseStatusEnum.completed
        and prev_status != models.PurchaseStatusEnum.completed
    ):
        for it in purchase.items:
            db.add(models.StockMovement(
                product_id=it.product_id, type=models.StockMovementTypeEnum.return_out, qty=it.qty,
                reference=purchase.number, note=f"Barang dibalikin ke vendor via {purchase.number}",
                created_by=current_user.id,
            ))
            it.product.stock_qty = max(0, it.product.stock_qty - it.qty)

    db.commit()
    db.refresh(purchase)
    return _to_purchase_out(purchase)