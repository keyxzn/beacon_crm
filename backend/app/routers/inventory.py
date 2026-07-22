from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.deps import require_roles

router = APIRouter(prefix="/inventory", tags=["inventory"])

# Sama kayak Project & Purchase — Inventory itu fase implementasi, PIC-nya Manager/Ops.
# Bahkan buat sekedar LIHAT stock aja Sales gak dikasih, konsisten sama keputusan bahwa
# Sales gak megang modul ini sama sekali (bukan cuma gak boleh ubah-ubah doang).
require_manager = require_roles("admin", "manager")


def _to_product_out(p: models.Product) -> schemas.ProductOut:
    return schemas.ProductOut(
        id=p.id, sku=p.sku, name=p.name, unit=p.unit, category=p.category,
        unit_price=float(p.unit_price or 0), reorder_level=p.reorder_level, stock_qty=p.stock_qty,
        is_low_stock=p.stock_qty <= p.reorder_level,
    )


@router.get("/products", response_model=List[schemas.ProductOut])
def list_products(
    low_stock_only: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    products = db.query(models.Product).order_by(models.Product.name.asc()).all()
    out = [_to_product_out(p) for p in products]
    if low_stock_only:
        out = [p for p in out if p.is_low_stock]
    return out


@router.post("/products", response_model=schemas.ProductOut)
def create_product(
    payload: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    product = models.Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return _to_product_out(product)


@router.get("/movements", response_model=List[schemas.StockMovementOut])
def list_movements(
    product_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    q = db.query(models.StockMovement)
    if product_id:
        q = q.filter(models.StockMovement.product_id == product_id)
    movements = q.order_by(models.StockMovement.created_at.desc()).all()
    return [
        schemas.StockMovementOut(
            id=m.id, product_id=m.product_id, product_name=m.product.name if m.product else None,
            type=m.type, qty=m.qty, reference=m.reference, note=m.note,
            created_by_name=m.created_by and db.query(models.User).filter(models.User.id == m.created_by).first().name,
            created_at=m.created_at,
        )
        for m in movements
    ]


@router.post("/adjust", response_model=schemas.StockMovementOut)
def adjust_stock(
    payload: schemas.StockAdjustment,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_manager),
):
    """Buat koreksi stock manual (stock opname, kehilangan/kerusakan, dll) — di luar alur PO/Return."""
    product = db.query(models.Product).filter(models.Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produk gak ditemukan.")

    movement = models.StockMovement(
        product_id=product.id, type=payload.type, qty=payload.qty,
        reference="Manual", note=payload.note, created_by=current_user.id,
    )
    db.add(movement)

    if payload.type in (models.StockMovementTypeEnum.in_, models.StockMovementTypeEnum.adjustment):
        product.stock_qty += payload.qty
    else:
        product.stock_qty = max(0, product.stock_qty - payload.qty)

    db.commit()
    db.refresh(movement)
    return schemas.StockMovementOut(
        id=movement.id, product_id=product.id, product_name=product.name,
        type=movement.type, qty=movement.qty, reference=movement.reference, note=movement.note,
        created_by_name=current_user.name, created_at=movement.created_at,
    )