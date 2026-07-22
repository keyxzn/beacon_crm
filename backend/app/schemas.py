from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import (
    RoleEnum, LeadStatusEnum, ApprovalStatusEnum, DealStageEnum, DealDocTypeEnum,
    ActivityTypeEnum, InteractionTypeEnum, LeadCaptureEnum,
    ProjectStatusEnum, PurchaseTypeEnum, PurchaseStatusEnum, StockMovementTypeEnum,
)


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ---------- User ----------
class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    role: RoleEnum


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.sales


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class RoleUpdate(BaseModel):
    role: RoleEnum


class PasswordReset(BaseModel):
    password: str


# ---------- Customer ----------
class CustomerCreate(BaseModel):
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: Optional[str] = None


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    channel: Optional[str] = None
    created_at: datetime
    # computed
    leads_given: int = 0
    opportunities_count: int = 0
    is_repeat: bool = False
    last_interaction_at: Optional[datetime] = None


# ---------- Lead ----------
class LeadCreate(BaseModel):
    name: str
    company: str
    role_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    source: Optional[str] = None
    owner_id: Optional[str] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    timeline: Optional[str] = None
    customer_id: Optional[str] = None
    capture_method: LeadCaptureEnum = LeadCaptureEnum.manual


class LeadUpdate(BaseModel):
    status: Optional[LeadStatusEnum] = None
    name: Optional[str] = None
    company: Optional[str] = None
    role_title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    owner_id: Optional[str] = None
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    budget: Optional[float] = None
    timeline: Optional[str] = None
    customer_id: Optional[str] = None


class LeadReviewRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    note: Optional[str] = None
    budget: Optional[float] = None      # manager bisa revisi sebelum approve
    timeline: Optional[str] = None      # manager bisa revisi sebelum approve


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    company: str
    role_title: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    status: LeadStatusEnum
    source: Optional[str]
    vendor_name: Optional[str]
    description: Optional[str]
    budget: Optional[float]
    timeline: Optional[str]
    approval_status: ApprovalStatusEnum
    submitted_at: Optional[datetime]
    reviewed_at: Optional[datetime]
    reviewed_by: Optional[str]
    review_note: Optional[str]
    ai_score: Optional[int]
    ai_score_reason: Optional[str]
    owner_id: Optional[str]
    owner_name: Optional[str] = None
    reviewer_name: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    capture_method: LeadCaptureEnum
    created_at: datetime
    last_activity_at: datetime


class LeadDetailOut(LeadOut):
    ai_summary: Optional[str] = None
    ai_next_best_action: Optional[str] = None


# ---------- Deal documents (output per stage) ----------
class DealDocumentCreate(BaseModel):
    stage: Optional[DealStageEnum] = None  # default: stage deal saat ini
    doc_type: DealDocTypeEnum = DealDocTypeEnum.other
    label: str
    url: str
    note: Optional[str] = None


class DealDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    deal_id: str
    stage: DealStageEnum
    doc_type: DealDocTypeEnum
    label: str
    url: str
    note: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime


# ---------- Deal ----------
class DealCreate(BaseModel):
    lead_id: str
    title: str
    value: float = 0
    stage: DealStageEnum = DealStageEnum.baru
    owner_id: Optional[str] = None


class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[float] = None
    stage: Optional[DealStageEnum] = None
    owner_id: Optional[str] = None


class DealOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    title: str
    value: float
    stage: DealStageEnum
    ai_probability: Optional[int]
    documents: List[DealDocumentOut] = []
    owner_id: Optional[str]
    created_at: datetime
    updated_at: datetime


# ---------- Activity ----------
class ActivityCreate(BaseModel):
    lead_id: Optional[str] = None
    deal_id: Optional[str] = None
    owner_id: Optional[str] = None
    type: ActivityTypeEnum = ActivityTypeEnum.call
    title: str
    due_at: datetime


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: Optional[str]
    deal_id: Optional[str]
    owner_id: Optional[str]
    type: ActivityTypeEnum
    title: str
    due_at: datetime
    completed_at: Optional[datetime]
    created_at: datetime
    lead_name: Optional[str] = None       # nama company lead terkait (computed)
    assigned_to_name: Optional[str] = None  # nama sales yang punya tugas ini (computed)


# ---------- Interaction ----------
class InteractionCreate(BaseModel):
    lead_id: Optional[str] = None
    created_by: Optional[str] = None
    type: InteractionTypeEnum = InteractionTypeEnum.note
    note: str


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    lead_id: str
    created_by: Optional[str]
    type: InteractionTypeEnum
    note: str
    created_at: datetime


class WhatsAppInboundPayload(BaseModel):
    """Payload minimal dari WA gateway pas ada chat masuk dari nomor baru/lama.
    Di real-world ini nyambung ke provider kayak Meta Cloud API / Twilio,
    tapi struktur intinya tetep: siapa yang chat + isi pesannya apa."""
    phone: str
    customer_name: Optional[str] = None      # nama dari profil WA, kalau ada
    company: Optional[str] = None
    message: Optional[str] = None            # isi chat pertama, dipakai jadi deskripsi awal


# ---------- Dashboard ----------
class DashboardChainOut(BaseModel):
    customer_count: int
    sales_count: int
    opportunity_count: int
    pipeline_value: float
    auto_lead_count: int
    manual_lead_count: int
    # lanjutan chain: Project -> Purchase -> Inventory
    project_count: int = 0
    project_ongoing_count: int = 0
    purchase_pending_count: int = 0   # PR yang lagi nunggu approval manager
    inventory_low_stock_count: int = 0


# ---------- Reports ----------
class RevenueByMonth(BaseModel):
    month: str   # label periode: "Jun" buat bulanan, "30 Jun" buat harian
    total: float


class FunnelStage(BaseModel):
    stage: str
    count: int


class LeaderboardRow(BaseModel):
    user_id: str
    name: str
    deals_closed: int
    win_rate: float
    revenue: float


class ChurnRiskRow(BaseModel):
    lead_id: str
    company: str
    reason: str
    recommendation: str


class DealDetailRow(BaseModel):
    id: str
    lead_id: str
    title: str
    company: str
    stage: str
    value: float
    owner_name: Optional[str] = None
    updated_at: str


class ReportsOut(BaseModel):
    granularity: str  # "daily" | "monthly"
    range_from: Optional[str] = None
    range_to: Optional[str] = None
    revenue_by_month: List[RevenueByMonth]
    funnel: List[FunnelStage]
    leaderboard: List[LeaderboardRow]
    churn_risk: List[ChurnRiskRow]
    deals: List[DealDetailRow] = []


# ══════════════════════════════════════════════════════════════════════
# Lanjutan chain: Project -> Purchase -> Inventory
# ══════════════════════════════════════════════════════════════════════

# ---------- Project ----------
class ProjectCreate(BaseModel):
    deal_id: str
    name: str
    budget: float = 0
    owner_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    budget: Optional[float] = None
    status: Optional[ProjectStatusEnum] = None
    owner_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    deal_id: str
    name: str
    budget: float
    status: ProjectStatusEnum
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    deal_title: Optional[str] = None
    customer_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    # computed
    spent: float = 0            # total value PO yang udah "received" buat project ini
    budget_used_pct: float = 0


# ---------- Product ----------
class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    unit: str = "pcs"
    category: Optional[str] = None
    unit_price: float = 0
    reorder_level: int = 0


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    sku: Optional[str] = None
    name: str
    unit: str
    category: Optional[str] = None
    unit_price: float
    reorder_level: int
    stock_qty: int
    is_low_stock: bool = False


# ---------- Purchase (PR / PO / Return) ----------
class PurchaseItemIn(BaseModel):
    product_id: str
    qty: int
    unit_price: Optional[float] = None  # kalau kosong, dipakai harga default produk


class PurchaseItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    product_name: Optional[str] = None
    unit: Optional[str] = None
    qty: int
    unit_price: float
    subtotal: float = 0


class PurchaseCreate(BaseModel):
    type: PurchaseTypeEnum
    project_id: Optional[str] = None
    vendor_name: Optional[str] = None
    notes: Optional[str] = None
    source_purchase_id: Optional[str] = None  # wajib diisi kalau type == return
    items: List[PurchaseItemIn] = []


class PurchaseStatusUpdate(BaseModel):
    status: PurchaseStatusEnum


class PurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    number: str
    type: PurchaseTypeEnum
    status: PurchaseStatusEnum
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    vendor_name: Optional[str] = None
    notes: Optional[str] = None
    requested_by: Optional[str] = None
    requester_name: Optional[str] = None
    approved_by: Optional[str] = None
    approver_name: Optional[str] = None
    source_purchase_id: Optional[str] = None
    total_value: float = 0
    items: List[PurchaseItemOut] = []
    created_at: datetime
    updated_at: datetime


# ---------- Inventory / Stock ----------
class StockAdjustment(BaseModel):
    product_id: str
    type: StockMovementTypeEnum
    qty: int
    note: Optional[str] = None


class StockMovementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    product_id: str
    product_name: Optional[str] = None
    type: StockMovementTypeEnum
    qty: int
    reference: Optional[str] = None
    note: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime