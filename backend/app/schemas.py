from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, EmailStr, ConfigDict

from app.models import (
    RoleEnum, LeadStatusEnum, ApprovalStatusEnum, DealStageEnum, DealDocTypeEnum,
    ActivityTypeEnum, InteractionTypeEnum,
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