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


class LeadCaptureEnum(str, enum.Enum):
    """Cara lead ini kecapture pertama kali.
    manual   -> sales ngisi sendiri lewat form Tambah Lead.
    whatsapp -> customer chat duluan ke WA bisnis, auto ke-capture lewat webhook."""
    manual = "manual"
    whatsapp = "whatsapp"


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


# ---------- Project -> Purchase -> Inventory (lanjutan chain dari Closed Won) ----------
class ProjectStatusEnum(str, enum.Enum):
    planning = "planning"
    ongoing = "ongoing"
    completed = "completed"
    cancelled = "cancelled"


class PurchaseTypeEnum(str, enum.Enum):
    request = "request"   # Purchase Request (PR) — permintaan internal, belum ke vendor
    order = "order"        # Purchase Order (PO) — udah jadi pesenan resmi ke vendor
    return_ = "return"     # Purchase Return — barang dibalikin ke vendor (rusak/kelebihan/salah kirim)


class PurchaseStatusEnum(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"     # PR: nunggu approval manager
    approved = "approved"       # PR disetujui -> siap dijadiin PO
    rejected = "rejected"
    ordered = "ordered"         # PO udah dikirim ke vendor, nunggu barang dateng
    received = "received"       # PO: barang udah dateng -> otomatis nambah stock
    completed = "completed"     # Return: udah selesai diproses vendor


class StockMovementTypeEnum(str, enum.Enum):
    in_ = "in"                  # nambah stock (dari PO yang received)
    out = "out"                 # stock keluar (dipakai buat project)
    adjustment = "adjustment"   # koreksi manual (stock opname dll)
    return_out = "return_out"   # stock keluar karena dibalikin ke vendor (Purchase Return)


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


class Customer(Base):
    """Pihak yang NGASIH lead — beda dari Lead itu sendiri.
    Dipisah dari Lead soalnya 1 customer bisa ngasih beberapa lead dari waktu ke
    waktu (repeat inquiry), jadi histori & kontaknya kekumpul di 1 profil,
    gak kepencar per-lead."""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)            # nama perusahaan/individu
    contact_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    channel = Column(String, nullable=True)           # WhatsApp / Website / Referral / Event / dll

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    leads = relationship("Lead", back_populates="customer")


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

    customer_id = Column(UUID(as_uuid=False), ForeignKey("customers.id"), nullable=True)
    capture_method = Column(Enum(LeadCaptureEnum), default=LeadCaptureEnum.manual, nullable=False)

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
    customer = relationship("Customer", back_populates="leads")
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


# ══════════════════════════════════════════════════════════════════════
# Lanjutan chain: Deal (Closed Won) -> Project -> Purchase -> Inventory
# ══════════════════════════════════════════════════════════════════════

class Project(Base):
    """Dibuat begitu sebuah Deal closed won — 'kerjaan beneran' abis opportunity dimenangin.
    Budget di sini yang jadi acuan buat Purchase Request/Order yang nempel ke project ini."""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    deal_id = Column(UUID(as_uuid=False), ForeignKey("deals.id"), nullable=False)
    name = Column(String, nullable=False)
    budget = Column(Numeric(14, 2), default=0)
    status = Column(Enum(ProjectStatusEnum), default=ProjectStatusEnum.planning, nullable=False)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)  # PM / sales penanggung jawab

    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    deal = relationship("Deal", backref="projects")
    owner = relationship("User", foreign_keys=[owner_id])
    purchases = relationship("Purchase", back_populates="project")


class Product(Base):
    """Katalog barang/jasa yang dibeli lewat Purchase dan disimpen di Inventory."""
    __tablename__ = "products"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    sku = Column(String, nullable=True)
    name = Column(String, nullable=False)
    unit = Column(String, default="pcs")            # satuan: pcs, unit, box, meter, dll
    category = Column(String, nullable=True)
    unit_price = Column(Numeric(14, 2), default=0)
    reorder_level = Column(Integer, default=0)       # ambang batas "stock menipis"
    stock_qty = Column(Integer, default=0)           # running total, di-update tiap ada StockMovement

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    movements = relationship("StockMovement", back_populates="product")


class Purchase(Base):
    """Satu tabel buat 3 tipe dokumen pembelian: Purchase Request (PR), Purchase Order (PO),
    dan Purchase Return — dibedain lewat kolom `type`, alurnya nyambung:
    PR diajuin -> di-approve manager -> jadi PO -> vendor kirim barang -> diterima -> stock nambah.
    Purchase Return dipakai kalau barang yang uda diterima ternyata rusak/kelebihan, dibalikin ke vendor."""
    __tablename__ = "purchases"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    number = Column(String, nullable=False)  # nomor dokumen, cth PR-0001 / PO-0001 / RET-0001
    type = Column(Enum(PurchaseTypeEnum), nullable=False)
    status = Column(Enum(PurchaseStatusEnum), default=PurchaseStatusEnum.draft, nullable=False)

    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=True)
    vendor_name = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    requested_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    approved_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    # kalau ini Purchase Return, ini nunjuk ke PO asal barang yang dibalikin
    source_purchase_id = Column(UUID(as_uuid=False), ForeignKey("purchases.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="purchases")
    requester = relationship("User", foreign_keys=[requested_by])
    approver = relationship("User", foreign_keys=[approved_by])
    source_purchase = relationship("Purchase", remote_side=[id])
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    purchase_id = Column(UUID(as_uuid=False), ForeignKey("purchases.id"), nullable=False)
    product_id = Column(UUID(as_uuid=False), ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(14, 2), default=0)

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")


class StockMovement(Base):
    """Ledger tiap kali stock produk berubah, biar ada jejak audit — bukan cuma angka
    stock_qty doang yang keubah diem-diem."""
    __tablename__ = "stock_movements"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    product_id = Column(UUID(as_uuid=False), ForeignKey("products.id"), nullable=False)
    type = Column(Enum(StockMovementTypeEnum), nullable=False)
    qty = Column(Integer, nullable=False)  # selalu positif, arah ditentuin dari `type`
    reference = Column(String, nullable=True)  # cth nomor PO/PR yang jadi sumber pergerakan ini
    note = Column(Text, nullable=True)

    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="movements")