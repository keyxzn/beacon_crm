"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import ScoreBar from "@/components/ScoreBar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

type Lead = {
  id: string;
  name: string;
  company: string;
  status: string;
  source: string | null;
  ai_score: number | null;
  last_activity_at: string;
  owner_id: string | null;
  owner_name: string | null;
  vendor_name: string | null;
  description: string | null;
  budget: number | null;
  timeline: string | null;
  approval_status: "draft" | "in_review" | "approved" | "rejected";
  submitted_at: string | null;
  reviewer_name: string | null;
  review_note: string | null;
};

const FILTERS = [
  { key: "", label: "Semua" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "unqualified", label: "Unqualified" },
];

const SORTS = [
  { key: "priority", label: "Prioritas (skor AI)" },
  { key: "recent", label: "Aktivitas terbaru" },
  { key: "name", label: "Nama A-Z" },
];

const STATUS_OPTIONS = ["new", "contacted", "qualified", "unqualified"];

const APPROVAL_META: Record<string, { label: string; badge: string }> = {
  draft: { label: "Draft", badge: "badge-unqualified" },
  in_review: { label: "In Review", badge: "badge-contacted" },
  approved: { label: "Approved", badge: "badge-qualified" },
  rejected: { label: "Rejected", badge: "badge-overdue" },
};

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

export default function LeadsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LeadsPage />
    </Suspense>
  );
}

function LeadsPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ownerParam = searchParams.get("owner");
  const tabParam = searchParams.get("tab") as "active" | "submissions" | "review" | null;

  const isSales = user?.role === "sales";
  const isManager = user?.role === "manager";
  const [tab, setTab] = useState<"active" | "submissions" | "review">(tabParam || "active");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  const [mySubmissions, setMySubmissions] = useState<Lead[]>([]);
  const [pendingReview, setPendingReview] = useState<Lead[]>([]);

  // Sinkron tab kalau user klik link sidebar (?tab=...) sambil udah ada di halaman ini
  useEffect(() => {
    if (tabParam && tabParam !== tab) setTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (tab === "active") loadActive();
    else if (tab === "submissions") loadSubmissions();
    else if (tab === "review") loadReview();
  }, [tab, filter, sort, sortDir, sourceFilter, ownerParam]);

  useEffect(() => { setPage(1); }, [filter, sort, sortDir, sourceFilter, search, pageSize, tab]);

  async function loadActive() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);
      params.set("sort", sort);
      params.set("dir", sortDir);
      if (sourceFilter) params.set("source", sourceFilter);
      params.set("approval_status", "approved");
      if (!isSales && ownerParam) params.set("owner_id", ownerParam);
      setLeads(await apiGet<Lead[]>(`/leads?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmissions() {
    setLoading(true);
    try {
      setMySubmissions(await apiGet<Lead[]>("/leads?approval_status=all&sort=recent"));
    } finally {
      setLoading(false);
    }
  }

  async function loadReview() {
    setLoading(true);
    try {
      setPendingReview(await apiGet<Lead[]>("/leads?approval_status=in_review&sort=recent"));
    } finally {
      setLoading(false);
    }
  }

  function reloadCurrentTab() {
    if (tab === "active") loadActive();
    else if (tab === "submissions") loadSubmissions();
    else loadReview();
  }

  async function quickChangeStatus(leadId: string, status: string) {
    setStatusSavingId(leadId);
    try {
      const updated = await apiPatch<Lead>(`/leads/${leadId}`, { status });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: updated.status } : l)));
      toast("Status lead diperbarui ✓");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal update status.", "error");
    } finally {
      setStatusSavingId(null);
    }
  }

  async function submitForReview(leadId: string) {
    try {
      await apiPost(`/leads/${leadId}/submit`);
      toast("Lead disubmit buat review manager ✓");
      loadSubmissions();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal submit.", "error");
    }
  }

  const filtered = search
    ? leads.filter(
        (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.company.toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const SOURCE_OPTIONS = Array.from(new Set(leads.map((l) => l.source).filter(Boolean))) as string[];

  return (
    <>
      <Topbar
        title="Leads"
        onMenuClick={() => setSidebarOpen(true)}
        rightSlot={
          tab === "active" ? (
            <div className="search-box">
              <span>⌕</span>
              <input placeholder="Cari lead…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          ) : undefined
        }
      />
      <div className="content">

        {/* Leads tab navigation - styled as segmented control */}
        <div className="leads-tab-nav">
          <button
            className={`leads-tab-btn ${tab === "active" ? "leads-tab-active" : ""}`}
            onClick={() => { setTab("active"); router.replace("/leads?tab=active"); }}
          >
            <span>◎</span>
            Lead Aktif
            <span className="leads-tab-count">{leads.length}</span>
          </button>
          {isSales && (
            <button
              className={`leads-tab-btn ${tab === "submissions" ? "leads-tab-active" : ""}`}
              onClick={() => { setTab("submissions"); router.replace("/leads?tab=submissions"); }}
            >
              <span>📋</span>
              Submission Saya
            </button>
          )}
          {isManager && (
            <button
              className={`leads-tab-btn leads-tab-review ${tab === "review" ? "leads-tab-active" : ""}`}
              onClick={() => { setTab("review"); router.replace("/leads?tab=review"); }}
            >
              <span>⏳</span>
              Menunggu Review
              {pendingReview.length > 0 && (
                <span className="leads-tab-badge">{pendingReview.length}</span>
              )}
            </button>
          )}
          <div className="leads-tab-desc">
            {tab === "active" && "Lead yang udah disetujui & siap masuk pipeline."}
            {tab === "submissions" && "Draft & riwayat submission kamu ke manager."}
            {tab === "review" && "Submission sales yang butuh keputusan kamu."}
          </div>
        </div>

        {tab === "active" && (
          <>
            {!isSales && ownerParam && (
              <div className="status-legend" style={{ marginBottom: 10 }}>
                Lagi nampilin lead milik 1 sales tertentu — <Link href="/leads" style={{ textDecoration: "underline" }}>reset filter</Link>
              </div>
            )}
            <div className="page-head">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div className="chip-row" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {FILTERS.map((f) => (
                    <span key={f.key} className={`chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>
                      {f.label}
                    </span>
                  ))}
                </div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  style={{ background: "var(--surface)", border: "1.5px solid var(--border2)", borderRadius: 100, color: "var(--muted)", fontSize: 12.5, fontWeight: 600, padding: "7px 13px" }}
                >
                  <option value="">Semua sumber</option>
                  {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  style={{ background: "var(--surface)", border: "1.5px solid var(--border2)", borderRadius: 100, color: "var(--muted)", fontSize: 12.5, fontWeight: 600, padding: "7px 13px" }}
                >
                  {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button
                  className="btn-icon-toggle"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  title={sortDir === "asc" ? "Ascending — klik buat descending" : "Descending — klik buat ascending"}
                >
                  {sortDir === "asc" ? "↑" : "↓"}
                </button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>+ Tambah lead</button>
            </div>

            {showForm && (
              <NewLeadForm
                isSales={isSales}
                onCreated={(submitted) => {
                  setShowForm(false);
                  loadActive();
                  toast(submitted ? "Lead dibuat & disubmit buat review ✓" : isSales ? "Lead disimpan sebagai draft — lengkapi di tab Submission Saya ✓" : "Lead baru berhasil ditambahkan ✓");
                }}
                onError={(msg) => toast(msg, "error")}
              />
            )}

            {loading ? (
              <SkeletonTable rows={5} />
            ) : (
              <div className="card" style={{ padding: filtered.length === 0 ? 0 : "6px 20px 12px", background: filtered.length === 0 ? "transparent" : undefined, border: filtered.length === 0 ? "none" : undefined }}>
                {filtered.length === 0 ? (
                  <EmptyState
                    icon="🧭"
                    title={leads.length === 0 ? "Belum ada lead aktif" : "Gak ada lead yang cocok"}
                    subtitle={leads.length === 0 ? "Mulai dengan nambahin lead pertama kamu." : "Coba ubah filter status atau kata pencarian di atas."}
                    action={leads.length === 0 ? { label: "+ Tambah lead pertama", onClick: () => setShowForm(true) } : undefined}
                  />
                ) : (
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Lead</th><th>Status</th>
                        {!isSales && <th>Sales</th>}
                        <th>Sumber</th><th>Skor AI</th><th>Aktivitas terakhir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((l) => (
                        <tr key={l.id}>
                          <td className="cell-name">
                            <div className="avatar" style={{ background: colorForName(l.name) }}>{initialsOf(l.name)}</div>
                            <div>
                              <Link href={`/leads/${l.id}`} style={{ textDecoration: "underline" }}><b>{l.name}</b></Link>
                              <span>{l.company}</span>
                              {(l.ai_score ?? 0) >= 80 && <div className="priority-flag">🔥 Prioritas tinggi</div>}
                            </div>
                          </td>
                          <td>
                            <select
                              className={`badge badge-${l.status}`}
                              style={{ border: "none", appearance: "none", cursor: "pointer", paddingRight: 18 }}
                              value={l.status}
                              disabled={statusSavingId === l.id}
                              title="Klik buat ubah status lead ini"
                              onChange={(e) => quickChangeStatus(l.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s} style={{ background: "var(--surface)", color: "var(--text)" }}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </select>
                          </td>
                          {!isSales && (
                            <td className="t-small">
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: colorForName(l.owner_name || "?") }}>
                                  {initialsOf(l.owner_name || "?")}
                                </div>
                                {l.owner_name || "—"}
                              </div>
                            </td>
                          )}
                          <td className="t-small">{l.source || "—"}</td>
                          <td><ScoreBar score={l.ai_score} /></td>
                          <td className="t-small">{timeAgo(l.last_activity_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="pagination-bar">
                <div className="pagination-info">
                  Menampilkan {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} dari {filtered.length} lead
                </div>
                <div className="pagination-controls">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="pagination-size-select"
                  >
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / halaman</option>)}
                  </select>
                  <button className="pagination-btn" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>‹ Sebelumnya</button>
                  <span className="pagination-page">Hal {pageSafe} / {totalPages}</span>
                  <button className="pagination-btn" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>Selanjutnya ›</button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "submissions" && (
          <>
            {loading ? (
              <SkeletonTable rows={3} />
            ) : mySubmissions.length === 0 ? (
              <EmptyState icon="📝" title="Belum ada submission" subtitle="Bikin lead baru dari tab Lead Aktif buat mulai." compact />
            ) : (
              <div className="submission-list">
                {mySubmissions.map((l) => (
                  <SubmissionCard key={l.id} lead={l} onSubmit={() => submitForReview(l.id)} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "review" && (
          <>
            {loading ? (
              <SkeletonTable rows={2} />
            ) : pendingReview.length === 0 ? (
              <EmptyState icon="✅" title="Gak ada yang nunggu review" subtitle="Semua submission sales udah diproses. Mantap." compact />
            ) : (
              <div className="review-list">
                {pendingReview.map((l) => (
                  <ReviewCard key={l.id} lead={l} onDecided={reloadCurrentTab} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const meta = APPROVAL_META[status] || { label: status, badge: "badge-unqualified" };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function SubmissionCard({ lead, onSubmit }: { lead: Lead; onSubmit: () => void }) {
  const canEdit = lead.approval_status === "draft" || lead.approval_status === "rejected";
  return (
    <div className={`submission-card submission-${lead.approval_status}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div>
          <Link href={`/leads/${lead.id}`} style={{ textDecoration: "underline" }}>
            <b style={{ fontSize: 14 }}>{lead.name}</b>
          </Link>
          <div className="t-small">{lead.company} {lead.budget ? `· ${formatRupiah(lead.budget)}` : ""} {lead.timeline ? `· ${lead.timeline}` : ""}</div>
        </div>
        <ApprovalBadge status={lead.approval_status} />
      </div>
      {lead.approval_status === "in_review" && (
        <div className="t-small">Disubmit {timeAgo(lead.submitted_at)} — nunggu review manager.</div>
      )}
      {lead.approval_status === "rejected" && lead.review_note && (
        <div className="t-small" style={{ color: "var(--danger)", marginBottom: 8 }}>
          Alasan ditolak ({lead.reviewer_name}): {lead.review_note}
        </div>
      )}
      {canEdit && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Link href={`/leads/${lead.id}`} className="btn btn-secondary btn-sm">✏️ Lengkapi / Edit</Link>
          <button className="btn btn-primary btn-sm" onClick={onSubmit}>
            {lead.approval_status === "rejected" ? "Submit ulang" : "Submit buat review"}
          </button>
        </div>
      )}
    </div>
  );
}

type ReviewInteraction = { id: string; type: string; note: string; created_at: string };

const REVIEW_TYPE_ICON: Record<string, string> = { call: "📞", email: "✉️", meeting: "📅", note: "📝" };

function ReviewCard({ lead, onDecided }: { lead: Lead; onDecided: () => void }) {
  const { toast } = useToast();
  const [budget, setBudget] = useState(lead.budget !== null ? String(lead.budget) : "");
  const [timeline, setTimeline] = useState(lead.timeline || "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);
  const [interactions, setInteractions] = useState<ReviewInteraction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    apiGet<ReviewInteraction[]>(`/leads/${lead.id}/interactions`)
      .then(setInteractions)
      .finally(() => setLoadingHistory(false));
  }, [lead.id]);

  async function decide(decision: "approved" | "rejected") {
    if (decision === "rejected" && !note.trim()) {
      toast("Kasih alasan reject dulu ya.", "error");
      return;
    }
    setSubmitting(decision);
    try {
      await apiPost(`/leads/${lead.id}/review`, {
        decision,
        note: note || undefined,
        budget: budget ? Number(budget) : undefined,
        timeline: timeline || undefined,
      });
      toast(decision === "approved" ? "Lead disetujui, masuk ke daftar aktif ✓" : "Lead ditolak ✓");
      onDecided();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal proses review.", "error");
    } finally {
      setSubmitting(null);
    }
  }

  const scoreTone = lead.ai_score === null ? "neutral" : lead.ai_score >= 70 ? "high" : lead.ai_score >= 40 ? "mid" : "low";
  const recentInteractions = interactions.slice(0, 3);

  return (
    <div className="review-card">
      {/* Top accent strip */}
      <div className="review-card-accent" />

      <div className="review-card-body">
        {/* Header */}
        <div className="review-card-head">
          <div className="review-card-head-main">
            <div className="review-card-company">{lead.vendor_name || lead.company}</div>
            <div className="review-card-meta">
              <span className="review-meta-avatar">
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 8, background: colorForName(lead.owner_name || "?") }}>
                  {initialsOf(lead.owner_name || "?")}
                </span>
                Diajukan <b>{lead.owner_name}</b>
              </span>
              <span className="review-meta-dot">·</span>
              <span>{timeAgo(lead.submitted_at)}</span>
              <span className="review-meta-dot">·</span>
              <span>Kontak: <b>{lead.name}</b></span>
            </div>
          </div>
          {lead.ai_score !== null && (
            <div className={`review-score-badge review-score-${scoreTone}`}>
              <span className="review-score-icon">🤖</span>
              <div>
                <div className="review-score-num">{lead.ai_score}</div>
                <div className="review-score-lbl">Skor AI</div>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="review-card-desc">
          {lead.description || "Gak ada deskripsi tambahan dari sales."}
        </div>

        {/* Pertimbangan: riwayat interaksi sales sebelum minta approval */}
        <div className="review-history">
          <div className="review-history-head">
            <span>🕓</span> Riwayat komunikasi dengan lead ini
          </div>
          {loadingHistory ? (
            <div className="t-small" style={{ color: "var(--muted)" }}>Memuat riwayat…</div>
          ) : recentInteractions.length === 0 ? (
            <div className="review-history-empty">
              ⚠️ Belum ada interaksi tercatat — sales mungkin submit lead ini tanpa kontak awal. Pertimbangkan tanya dulu sebelum approve.
            </div>
          ) : (
            <div className="review-history-list">
              {recentInteractions.map((i) => (
                <div className="review-history-item" key={i.id}>
                  <span className="review-history-icon">{REVIEW_TYPE_ICON[i.type] || "📝"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="review-history-note">{i.note}</div>
                    <div className="review-history-time">{timeAgo(i.created_at)}</div>
                  </div>
                </div>
              ))}
              {interactions.length > 3 && (
                <Link href={`/leads/${lead.id}`} className="review-history-more">
                  +{interactions.length - 3} interaksi lainnya — lihat detail lead →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Editable fields */}
        <div className="review-card-fields">
          <div className="review-field">
            <label>💰 Budget (Rp) <span>— bisa direvisi</span></label>
            <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" />
          </div>
          <div className="review-field">
            <label>📅 Timeline <span>— bisa direvisi</span></label>
            <input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="Cth: Q1 2027" />
          </div>
        </div>

        <div className="review-field" style={{ marginBottom: 16 }}>
          <label>📝 Catatan <span>— wajib kalau reject</span></label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kenapa di-approve / ditolak…" />
        </div>

        {/* Actions */}
        <div className="review-card-actions">
          <button className="review-btn review-btn-approve" onClick={() => decide("approved")} disabled={!!submitting}>
            {submitting === "approved" ? "Memproses…" : "✓ Approve Lead"}
          </button>
          <button className="review-btn review-btn-reject" onClick={() => decide("rejected")} disabled={!!submitting}>
            {submitting === "rejected" ? "Memproses…" : "✕ Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewLeadForm({
  isSales, onCreated, onError,
}: { isSales: boolean; onCreated: (submitted: boolean) => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Website");
  const [vendorName, setVendorName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState("");
  const [submitting, setSubmitting] = useState<"draft" | "submit" | null>(null);

  const canSubmitDirectly = name && company && vendorName && description && budget && timeline;

  async function handleSave(thenSubmit: boolean) {
    setSubmitting(thenSubmit ? "submit" : "draft");
    try {
      const created = await apiPost<{ id: string }>("/leads", {
        name, company, role_title: roleTitle || null, email: email || null, phone: phone || null, source,
        vendor_name: vendorName || null, description: description || null,
        budget: budget ? Number(budget) : null, timeline: timeline || null,
      });
      if (thenSubmit) {
        await apiPost(`/leads/${created.id}/submit`);
      }
      onCreated(thenSubmit);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal nambah lead.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={(e) => e.preventDefault()}>
      <div className="card-title">Lead baru</div>
      {isSales && (
        <div className="status-legend" style={{ marginBottom: 14 }}>
          Lead yang kamu bikin perlu disetujui manager dulu sebelum masuk daftar Lead Aktif. Lengkapin vendor/budget/timeline kalau mau langsung submit, atau simpan draft dulu buat dilengkapi nanti.
        </div>
      )}
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama kontak</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Perusahaan</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Jabatan</label>
          <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>No. telepon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Sumber</label>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option>Website</option><option>Referral</option><option>Event</option><option>Cold outreach</option>
          </select>
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 18 }}>Detail bisnis</div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama vendor</label>
          <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder={isSales ? "Wajib buat submit" : "Opsional"} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Budget (Rp)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder={isSales ? "Wajib buat submit" : "Opsional"} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Timeline</label>
          <input value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder='cth: "Q3 2026"' />
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label>Lead-nya tentang apa</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat kebutuhan/opportunity-nya" />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        {isSales ? (
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSave(false)} disabled={!!submitting}>
              {submitting === "draft" ? "Nyimpen…" : "Simpan sebagai draft"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleSave(true)}
              disabled={!!submitting || !canSubmitDirectly}
              title={!canSubmitDirectly ? "Lengkapi vendor, budget, timeline & deskripsi dulu" : ""}
            >
              {submitting === "submit" ? "Nyimpen…" : "Simpan & submit buat review"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSave(false)} disabled={!!submitting}>
            {submitting ? "Nyimpen…" : "Simpan lead"}
          </button>
        )}
      </div>
    </form>
  );
}