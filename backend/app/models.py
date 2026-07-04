import enum
import uuid

from sqlalchemy import (
    Column, String, Integer, Numeric, DateTime, ForeignKey, Enum, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    sales = "sales"


class LeadStatusEnum(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    unqualified = "unqualified"


class ApprovalStatusEnum(str, enum.Enum):
    draft = "draft"          # lagi diisi sales, belum disubmit
    in_review = "in_review"  # udah disubmit, nunggu keputusan manager
    approved = "approved"    # manager setuju -> jadi lead aktif beneran
    rejected = "rejected"    # manager nolak (kemungkinan lead bodong)


class DealStageEnum(str, enum.Enum):
    baru = "baru"
    kualifikasi = "kualifikasi"
    proposal = "proposal"
    negosiasi = "negosiasi"
    closed_won = "closed_won"
    closed_lost = "closed_lost"


class ActivityTypeEnum(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    internal = "internal"


class InteractionTypeEnum(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    note = "note"


class DealDocTypeEnum(str, enum.Enum):
    """Tipe output yang biasanya muncul di tiap stage pipeline.
    Bukan dipaksa 1-1 sama stage dan sales bisa nambahin tipe apapun di stage manapun,
    ini cuma dipakai buat kasih label/ikon default yang relevan di UI."""
    qualification_notes = "qualification_notes"  # catatan kebutuhan/kualifikasi
    proposal = "proposal"                         # dokumen proposal
    negotiation_terms = "negotiation_terms"        # revisi penawaran / term sheet
    contract = "contract"                          # kontrak final
    invoice = "invoice"                            # invoice/PO
    other = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.sales, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leads = relationship("Lead", back_populates="owner", foreign_keys="Lead.owner_id")
    deals = relationship("Deal", back_populates="owner")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    role_title = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    status = Column(Enum(LeadStatusEnum), default=LeadStatusEnum.new, nullable=False)
    source = Column(String, nullable=True)  # Website / Referral / Event / Cold outreach

    # ---- detail bisnis yang diisi sales pas submit lead ----
    vendor_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)   # lead-nya tentang apa
    budget = Column(Numeric(14, 2), nullable=True)
    timeline = Column(String, nullable=True)     # contoh: "Q3 2026" / "2 bulan"

    # ---- approval workflow (gate sebelum jadi lead resmi) ----
    approval_status = Column(Enum(ApprovalStatusEnum), default=ApprovalStatusEnum.draft, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    review_note = Column(Text, nullable=True)

    ai_score = Column(Integer, nullable=True)
    ai_score_reason = Column(Text, nullable=True)

    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="leads", foreign_keys=[owner_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    deals = relationship("Deal", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="lead", cascade="all, delete-orphan")
    interactions = relationship(
        "Interaction", back_populates="lead", cascade="all, delete-orphan",
        order_by="desc(Interaction.created_at)",
    )


class Deal(Base):
    __tablename__ = "deals"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    lead_id = Column(UUID(as_uuid=False), ForeignKey("leads.id"), nullable=False)
    title = Column(String, nullable=False)
    value = Column(Numeric(14, 2), default=0)
    stage = Column(Enum(DealStageEnum), default=DealStageEnum.baru, nullable=False)

    ai_probability = Column(Integer, nullable=True)  # 0-100, win probability

    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lead = relationship("Lead", back_populates="deals")
    owner = relationship("User", back_populates="deals")
    activities = relationship("Activity", back_populates="deal", cascade="all, delete-orphan")
    documents = relationship(
        "DealDocument", back_populates="deal", cascade="all, delete-orphan",
        order_by="desc(DealDocument.created_at)",
    )


class DealDocument(Base):
    """Output/dokumen yang dihasilkan di sepanjang alur kerja deal dan gak cuma proposal.
    Tiap stage (kualifikasi, proposal, negosiasi, closed_won, dst) bisa punya output sendiri."""
    __tablename__ = "deal_documents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    deal_id = Column(UUID(as_uuid=False), ForeignKey("deals.id"), nullable=False)
    stage = Column(Enum(DealStageEnum), nullable=False)  # stage deal pas dokumen ini dibuat
    doc_type = Column(Enum(DealDocTypeEnum), default=DealDocTypeEnum.other, nullable=False)
    label = Column(String, nullable=False)   # contoh: "Dokumen Proposal", "Kontrak Final"
    url = Column(String, nullable=False)
    note = Column(Text, nullable=True)

    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    deal = relationship("Deal", back_populates="documents")


class Activity(Base):
    __tablename__ = "activities"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    lead_id = Column(UUID(as_uuid=False), ForeignKey("leads.id"), nullable=True)
    deal_id = Column(UUID(as_uuid=False), ForeignKey("deals.id"), nullable=True)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    type = Column(Enum(ActivityTypeEnum), default=ActivityTypeEnum.call, nullable=False)
    title = Column(String, nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="activities")
    deal = relationship("Deal", back_populates="activities")


class Interaction(Base):
    __tablename__ = "interactions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    lead_id = Column(UUID(as_uuid=False), ForeignKey("leads.id"), nullable=False)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    type = Column(Enum(InteractionTypeEnum), default=InteractionTypeEnum.note, nullable=False)
    note = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    lead = relationship("Lead", back_populates="interactions")