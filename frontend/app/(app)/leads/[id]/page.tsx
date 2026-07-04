"use client";

import { useEffect, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAppShell } from "../../layout";
import Topbar from "@/components/Topbar";
import AIPanel from "@/components/AIPanel";
import EmptyState from "@/components/EmptyState";
import { AIBadge, StatusBadge } from "@/components/Badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type LeadDetail = {
  id: string;
  name: string;
  company: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  vendor_name: string | null;
  description: string | null;
  budget: number | null;
  timeline: string | null;
  approval_status: "draft" | "in_review" | "approved" | "rejected";
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewer_name: string | null;
  review_note: string | null;
  owner_id: string | null;
  owner_name: string | null;
  ai_score: number | null;
  ai_summary: string | null;
  ai_next_best_action: string | null;
};

type Interaction = {
  id: string;
  type: "call" | "email" | "meeting" | "note";
  note: string;
  created_at: string;
};

type DealDocument = {
  id: string;
  deal_id: string;
  stage: string;
  doc_type: string;
  label: string;
  url: string;
  note: string | null;
  created_at: string;
};

type Deal = {
  id: string;
  title: string;
  value: number;
  stage: string;
  ai_probability: number | null;
  documents: DealDocument[];
};

const TYPE_ICON: Record<string, string> = { call: "📞", email: "✉️", meeting: "📅", note: "📝" };

const STAGE_LABEL: Record<string, string> = {
  baru: "Baru", kualifikasi: "Kualifikasi", proposal: "Proposal",
  negosiasi: "Negosiasi", closed_won: "Closed Won", closed_lost: "Closed Lost",
};

// Tiap stage punya "output" yang relevan sendiri — bukan cuma stage Proposal.
// Dipakai buat kasih label default, placeholder, dan pesan reminder yang sesuai konteks stage-nya.
const STAGE_OUTPUT_META: Record<string, { docType: string; label: string; reminder: string } | null> = {
  baru: null, // stage paling awal, belum perlu output dokumen
  kualifikasi: { docType: "qualification_notes", label: "Catatan Kebutuhan", reminder: "lampirin catatan kebutuhan/hasil diskusi biar gampang lanjut ke proposal." },
  proposal: { docType: "proposal", label: "Dokumen Proposal", reminder: "lampirin link proposal biar manager bisa pertimbangkan." },
  negosiasi: { docType: "negotiation_terms", label: "Revisi Penawaran", reminder: "lampirin term sheet/revisi penawaran terakhir." },
  closed_won: { docType: "contract", label: "Kontrak Final", reminder: "lampirin kontrak final yang udah ditandatangani." },
  closed_lost: null,
};

const APPROVAL_META: Record<string, { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "badge-unqualified" },
  in_review: { label: "In Review", badge: "badge-contacted" },
  approved: { label: "Approved", badge: "badge-qualified" },
  rejected: { label: "Rejected", badge: "badge-overdue" },
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "unqualified"];

function formatRupiah(n: number | null) {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.id as string;
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<LeadDetail>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isReviewer = user?.role === "admin" || user?.role === "manager";
  const isOwner = lead?.owner_id === user?.id;
  const canEditBusiness = lead?.approval_status === "draft" || lead?.approval_status === "rejected";

  useEffect(() => {
    load();
  }, [leadId]);

  async function load() {
    setLoading(true);
    try {
      const [leadData, interactionsData, dealsData] = await Promise.all([
        apiGet<LeadDetail>(`/leads/${leadId}`),
        apiGet<Interaction[]>(`/leads/${leadId}/interactions`),
        apiGet<Deal[]>(`/deals?lead_id=${leadId}`),
      ]);
      setLead(leadData);
      setForm(leadData);
      setInteractions(interactionsData);
      setDeals(dealsData);
    } finally {
      setLoading(false);
    }
  }

  function startEdit() {
    setForm(lead || {});
    setEditing(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiPatch<LeadDetail>(`/leads/${leadId}`, {
        name: form.name, company: form.company, role_title: form.role_title,
        email: form.email, phone: form.phone, status: form.status,
        vendor_name: form.vendor_name, description: form.description,
        budget: form.budget, timeline: form.timeline,
      });
      setLead((prev) => (prev ? { ...prev, ...updated } : updated));
      setEditing(false);
      toast("Perubahan lead disimpan ✓");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal nyimpen perubahan.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    try {
      const updated = await apiPost<LeadDetail>(`/leads/${leadId}/submit`);
      setLead((prev) => (prev ? { ...prev, ...updated } : updated));
      toast("Lead disubmit buat review manager ✓");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal submit lead.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete(`/leads/${leadId}`);
      toast("Lead dihapus ✓");
      router.push("/leads");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal hapus lead.", "error");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const approvalMeta = lead ? APPROVAL_META[lead.approval_status] : null;

  return (
    <>
      <Topbar
        title={lead ? `Leads / ${lead.name}` : "Detail Kontak"}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <div className="content">
        {loading || !lead ? (
          <div className="grid-3">
            <div className="card span-2">
              <div style={{ display: "flex", gap: 14, marginBottom: 18 }}>
                <Skeleton width={54} height={54} radius={100} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="40%" height={18} style={{ marginBottom: 8 }} />
                  <Skeleton width="60%" height={12} />
                </div>
              </div>
              <Skeleton height={90} style={{ marginBottom: 18 }} />
              <Skeleton width="30%" height={13} style={{ marginBottom: 14 }} />
              <Skeleton height={50} style={{ marginBottom: 10 }} />
              <Skeleton height={50} />
            </div>
            <Skeleton height={220} />
          </div>
        ) : (
          <div className="grid-3">
            <div className="card span-2">
              {!editing ? (
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
                  <div className="avatar" style={{ width: 54, height: 54, fontSize: 18, background: colorForName(lead.name) }}>
                    {initialsOf(lead.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="t-h2">{lead.name}</div>
                    <div className="t-small">{lead.role_title || "—"} · {lead.company}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                      {approvalMeta && <span className={`badge ${approvalMeta.badge}`}>{approvalMeta.label}</span>}
                      <StatusBadge status={lead.status} />
                      {lead.ai_score !== null && <AIBadge>Skor {lead.ai_score}</AIBadge>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={startEdit}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>🗑</button>
                  </div>
                </div>
              ) : (
                <form className="card" style={{ background: "var(--surface2)", marginBottom: 18 }} onSubmit={saveEdit}>
                  <div className="card-title">Edit lead</div>
                  <div className="grid-2">
                    <div className="field"><label>Nama</label><input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
                    <div className="field"><label>Perusahaan</label><input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} required /></div>
                    <div className="field"><label>Jabatan</label><input value={form.role_title || ""} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
                    <div className="field">
                      <label>Status</label>
                      <select value={form.status || "new"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Email</label><input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div className="field"><label>No. telepon</label><input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>

                  <div className="card-title" style={{ marginTop: 14 }}>Detail bisnis</div>
                  <div className="grid-2">
                    <div className="field"><label>Nama vendor</label><input value={form.vendor_name || ""} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} /></div>
                    <div className="field"><label>Budget (Rp)</label><input type="number" value={form.budget ?? ""} onChange={(e) => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : null })} /></div>
                    <div className="field"><label>Timeline</label><input value={form.timeline || ""} onChange={(e) => setForm({ ...form, timeline: e.target.value })} /></div>
                    <div className="field"><label>Lead-nya tentang apa</label><input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                    <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Nyimpen…" : "Simpan"}</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Batal</button>
                  </div>
                </form>
              )}

              {/* ---- Approval workflow panel ---- */}
              {lead.approval_status !== "approved" && (
                <div className="card" style={{ background: "var(--surface2)", marginBottom: 18 }}>
                  <div className="card-title">Status approval</div>
                  <div className="grid-2" style={{ marginBottom: 10 }}>
                    <div className="t-small"><b style={{ color: "var(--text)" }}>Vendor:</b> {lead.vendor_name || "—"}</div>
                    <div className="t-small"><b style={{ color: "var(--text)" }}>Budget:</b> {formatRupiah(lead.budget)}</div>
                    <div className="t-small"><b style={{ color: "var(--text)" }}>Timeline:</b> {lead.timeline || "—"}</div>
                    <div className="t-small"><b style={{ color: "var(--text)" }}>Diajukan:</b> {timeAgo(lead.submitted_at)}</div>
                  </div>
                  <p className="t-body" style={{ marginBottom: 10 }}>{lead.description || "Belum ada deskripsi."}</p>

                  {lead.approval_status === "rejected" && lead.review_note && (
                    <div className="t-small" style={{ color: "var(--danger)", marginBottom: 10 }}>
                      Ditolak oleh <b>{lead.reviewer_name}</b>: {lead.review_note}
                    </div>
                  )}

                  {(lead.approval_status === "draft" || lead.approval_status === "rejected") && isOwner && (
                    <button className="btn btn-primary btn-sm" onClick={handleSubmitForReview} disabled={submitting}>
                      {submitting ? "Mengirim…" : lead.approval_status === "rejected" ? "Submit ulang buat review" : "Submit buat review"}
                    </button>
                  )}
                  {lead.approval_status === "in_review" && (
                    <div className="t-small">⏳ Nunggu review manager.</div>
                  )}
                </div>
              )}

              {isReviewer && lead.approval_status === "in_review" && (
                <ReviewInline lead={lead} onDecided={load} />
              )}

              <AIPanel title="AI Summary">
                <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.6, marginBottom: 10 }}>
                  {lead.ai_summary}
                </p>
                {lead.ai_next_best_action && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <div
                      className="grad-text"
                      style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}
                    >
                      🎯 Next Best Action
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-soft)", lineHeight: 1.6 }}>{lead.ai_next_best_action}</p>
                  </div>
                )}
              </AIPanel>

              <div className="card-title" style={{ marginTop: 18 }}>Timeline interaksi</div>
              {interactions.length === 0 ? (
                <EmptyState icon="🕓" title="Belum ada interaksi" subtitle="Catat call/email/meeting pertama lewat form di bawah." compact />
              ) : (
                interactions.map((i) => (
                  <div className="tl-item" key={i.id}>
                    <div className="tl-ic">{TYPE_ICON[i.type]}</div>
                    <div>
                      <div className="tl-title">{i.note}</div>
                      <div className="tl-meta">{timeAgo(i.created_at)}</div>
                    </div>
                  </div>
                ))
              )}

              <NewInteractionForm leadId={leadId} onAdded={load} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="card">
                <div className="card-title">Info kontak</div>
                <div className="t-small" style={{ marginBottom: 8 }}>📧 {lead.email || "—"}</div>
                <div className="t-small" style={{ marginBottom: 8 }}>📞 {lead.phone || "—"}</div>
                <div className="t-small" style={{ marginBottom: 8 }}>🏢 {lead.company}</div>
                {lead.owner_name && <div className="t-small">👤 PIC: {lead.owner_name}</div>}
              </div>

              <div className="card">
                <div className="card-title">Deal terkait</div>
                {deals.length === 0 ? (
                  <div className="t-small">Belum ada deal buat lead ini.</div>
                ) : (
                  deals.map((d) => (
                    <DealMiniCard key={d.id} deal={d} canEdit={isOwner || isReviewer} onUpdated={load} />
                  ))
                )}
                <Link href="/pipeline" className="t-small" style={{ textDecoration: "underline" }}>
                  Lihat di Pipeline →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Hapus lead ini?"
        message={`"${lead?.name}" beserta semua deal, aktivitas, dan interaksi terkait bakal terhapus permanen. Gak bisa dibatalin.`}
        confirmLabel="Hapus permanen"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

function DealMiniCard({ deal, canEdit, onUpdated }: { deal: Deal; canEdit: boolean; onUpdated: () => void }) {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [docNote, setDocNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const outputMeta = STAGE_OUTPUT_META[deal.stage];
  // dokumen yang relevan sama stage deal saat ini ditampilin paling atas; sisanya tetep keliatan sebagai histori
  const currentStageDocs = deal.documents.filter((d) => d.stage === deal.stage);
  const otherDocs = deal.documents.filter((d) => d.stage !== deal.stage);

  async function saveDocument(e: FormEvent) {
    e.preventDefault();
    if (!docUrl.trim()) {
      toast("Masukin link dokumennya dulu ya.", "error");
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/deals/${deal.id}/documents`, {
        doc_type: outputMeta?.docType || "other",
        label: outputMeta?.label || "Dokumen",
        url: docUrl,
        note: docNote || undefined,
      });
      toast(`${outputMeta?.label || "Dokumen"} disimpan ✓`);
      setShowForm(false);
      setDocUrl("");
      setDocNote("");
      onUpdated();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal nyimpen dokumen.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(docId: string) {
    setDeletingId(docId);
    try {
      await apiDelete(`/deals/${deal.id}/documents/${docId}`);
      onUpdated();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal hapus dokumen.", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="deal-mini-card">
      <div className="deal-co">{deal.title}</div>
      <div className="t-small" style={{ margin: "4px 0 8px" }}>Stage: {STAGE_LABEL[deal.stage]}</div>
      <div className="deal-foot">
        <span className="deal-val">{formatRupiah(Number(deal.value))}</span>
        {deal.ai_probability !== null && (
          <span className="prob-pill" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
            🤖 {deal.ai_probability}%
          </span>
        )}
      </div>

      {/* Output dokumen — relevan di tiap stage, bukan cuma Proposal */}
      {outputMeta && (
        <div className="proposal-box">
          {currentStageDocs.length > 0 ? (
            currentStageDocs.map((doc) => (
              <div key={doc.id} style={{ marginBottom: 10 }}>
                <div className="proposal-box-head">
                  <span className="proposal-icon">📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="proposal-label">{doc.label}</div>
                    <div className="proposal-uploaded">Diunggah {timeAgo(doc.created_at)}</div>
                  </div>
                  {canEdit && (
                    <button
                      className="proposal-edit-btn"
                      onClick={() => deleteDocument(doc.id)}
                      disabled={deletingId === doc.id}
                      title="Hapus"
                    >
                      {deletingId === doc.id ? "…" : "🗑"}
                    </button>
                  )}
                </div>
                {doc.note && <div className="proposal-note">{doc.note}</div>}
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="proposal-link-btn">
                  Buka dokumen ↗
                </a>
              </div>
            ))
          ) : canEdit ? (
            <div className="proposal-missing">
              <span className="proposal-missing-icon">⚠️</span>
              <div>
                <div className="proposal-missing-title">Belum ada {outputMeta.label.toLowerCase()}</div>
                <div className="proposal-missing-sub">Deal udah masuk stage {STAGE_LABEL[deal.stage]} — {outputMeta.reminder}</div>
              </div>
            </div>
          ) : (
            <div className="proposal-missing">
              <span className="proposal-missing-icon">⚠️</span>
              <div className="proposal-missing-title">Sales belum lampirin {outputMeta.label.toLowerCase()}.</div>
            </div>
          )}

          {canEdit && !showForm && (
            <button className="proposal-edit-btn" onClick={() => setShowForm(true)} style={{ marginTop: 4 }}>
              {currentStageDocs.length > 0 ? `+ Tambah ${outputMeta.label.toLowerCase()} lain` : `Lampirin ${outputMeta.label.toLowerCase()}`}
            </button>
          )}

          {canEdit && showForm && (
            <form onSubmit={saveDocument} className="proposal-form">
              <input
                placeholder="Link dokumen (Google Drive, dsb)"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
              />
              <input
                placeholder="Catatan singkat (opsional)"
                value={docNote}
                onChange={(e) => setDocNote(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? "Nyimpen…" : "Simpan"}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Histori dokumen dari stage-stage sebelumnya */}
      {otherDocs.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary className="t-small" style={{ cursor: "pointer" }}>
            Histori dokumen stage lain ({otherDocs.length})
          </summary>
          {otherDocs.map((doc) => (
            <div key={doc.id} className="tl-item" style={{ marginTop: 8 }}>
              <div className="tl-ic">📄</div>
              <div>
                <div className="tl-title">{doc.label} — {STAGE_LABEL[doc.stage]}</div>
                <div className="tl-meta">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">Buka dokumen ↗</a> · {timeAgo(doc.created_at)}
                </div>
              </div>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function ReviewInline({ lead, onDecided }: { lead: LeadDetail; onDecided: () => void }) {
  const { toast } = useToast();
  const [budget, setBudget] = useState(lead.budget !== null ? String(lead.budget) : "");
  const [timeline, setTimeline] = useState(lead.timeline || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);

  async function decide(decision: "approved" | "rejected") {
    if (decision === "rejected" && !note.trim()) {
      toast("Kasih alasan reject dulu ya.", "error");
      return;
    }
    setSubmitting(decision);
    try {
      await apiPost(`/leads/${lead.id}/review`, {
        decision, note: note || undefined,
        budget: budget ? Number(budget) : undefined,
        timeline: timeline || undefined,
      });
      toast(decision === "approved" ? "Lead disetujui ✓" : "Lead ditolak ✓");
      onDecided();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal proses review.", "error");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="ai-panel" style={{ marginBottom: 18, background: "var(--surface2)" }}>
      <div className="card-title">🧑‍⚖️ Review kamu diperlukan</div>
      <div className="grid-2" style={{ marginBottom: 10 }}>
        <div className="field" style={{ marginBottom: 0 }}><label>Budget (revisi)</label><input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
        <div className="field" style={{ marginBottom: 0 }}><label>Timeline (revisi)</label><input value={timeline} onChange={(e) => setTimeline(e.target.value)} /></div>
      </div>
      <div className="field"><label>Catatan (wajib kalau reject)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan approve/reject…" /></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={() => decide("approved")} disabled={!!submitting}>
          {submitting === "approved" ? "Memproses…" : "✅ Approve"}
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => decide("rejected")} disabled={!!submitting}>
          {submitting === "rejected" ? "Memproses…" : "❌ Reject"}
        </button>
      </div>
    </div>
  );
}

function NewInteractionForm({ leadId, onAdded }: { leadId: string; onAdded: () => void }) {
  const [type, setType] = useState("call");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await apiPost(`/leads/${leadId}/interactions`, { type, note });
      setNote("");
      onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", gap: 8 }}>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ background: "var(--surface2)", border: "1.5px solid var(--border2)", borderRadius: 10, color: "var(--text)", padding: "0 10px", fontSize: 13 }}
      >
        <option value="call">Call</option>
        <option value="email">Email</option>
        <option value="meeting">Meeting</option>
        <option value="note">Note</option>
      </select>
      <input
        placeholder="Catat interaksi baru…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ flex: 1, background: "var(--surface2)", border: "1.5px solid var(--border2)", borderRadius: 10, color: "var(--text)", padding: "10px 13px", fontSize: 13 }}
      />
      <button className="btn btn-primary btn-sm" disabled={submitting}>
        {submitting ? "…" : "Tambah"}
      </button>
    </form>
  );
}