"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import TaskRow, { Activity } from "@/components/TaskRow";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiGet, apiPost, ApiError } from "@/lib/api";

type Lead = { id: string; name: string; company: string };
type TeamMember = { id: string; name: string; role: string };

const TYPE_META: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  call:     { icon: "📞", label: "Call",     color: "#00E5FF", bg: "rgba(0,229,255,.12)" },
  email:    { icon: "✉️",  label: "Email",    color: "#8B5CF6", bg: "rgba(139,92,246,.12)" },
  meeting:  { icon: "🤝", label: "Meeting",  color: "#FFB23D", bg: "rgba(255,178,61,.12)" },
  internal: { icon: "📋", label: "Internal", color: "#7C879B", bg: "rgba(124,135,155,.12)" },
};

const FILTERS = [
  { key: "",        label: "Semua" },
  { key: "today",   label: "☀ Hari ini" },
  { key: "week",    label: "📅 Minggu ini" },
  { key: "overdue", label: "⚠ Lewat tempo" },
];

export default function ActivitiesPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMgr = user?.role === "manager" || user?.role === "admin";

  const [activities, setActivities] = useState<Activity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [salesTeam, setSalesTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // form state
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState("call");
  const [fLeadId, setFLeadId] = useState("");
  const [fDue, setFDue] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 24);
    return d.toISOString().slice(0, 16);
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
    apiGet<Lead[]>("/leads").then(setLeads).catch(() => {});
    if (isMgr) apiGet<TeamMember[]>("/team").then((t) => setSalesTeam(t.filter((m) => m.role === "sales"))).catch(() => {});
  }, [filter, ownerFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("filter", filter);
      if (isMgr && ownerFilter) params.set("owner_id", ownerFilter);
      const q = params.toString() ? `?${params.toString()}` : "";
      setActivities(await apiGet<Activity[]>(`/activities${q}`));
    } finally { setLoading(false); }
  }

  async function handleAddTask(e: FormEvent) {
    e.preventDefault();
    if (!fTitle.trim()) { toast("Isi judul tugas dulu.", "error"); return; }
    setSaving(true);
    try {
      await apiPost("/activities", {
        title: fTitle, type: fType,
        lead_id: fLeadId || null,
        due_at: new Date(fDue).toISOString(),
      });
      toast("Tugas ditambahkan ✓");
      setFTitle(""); setShowForm(false); load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal tambah tugas.", "error");
    } finally { setSaving(false); }
  }

  function updateOne(updated: Activity) {
    setActivities((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  }

  const now = new Date();
  const overdue = activities.filter((a) => !a.completed_at && new Date(a.due_at) < now).length;

  const byType = Object.entries(TYPE_META)
    .map(([k, m]) => ({ ...m, key: k, count: activities.filter((a) => a.type === k).length }))
    .filter((t) => t.count > 0);

  const visibleActivities = typeFilter ? activities.filter((a) => a.type === typeFilter) : activities;

  return (
    <>
      <Topbar title="Aktivitas" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">

        {/* ── Toolbar simpel: semua filter jadi satu baris, gak ada angka statistik gede2an ── */}
        <div className="act-toolbar-row">
          <div className="act-toolbar-left">
            {FILTERS.map((f) => (
              <span key={f.key}
                className={`chip ${filter === f.key ? "on" : ""} ${f.key === "overdue" ? "chip-danger" : ""}`}
                onClick={() => setFilter(f.key)}>
                {f.label}
                {f.key === "overdue" && overdue > 0 && (
                  <span className="act-overdue-dot">{overdue}</span>
                )}
              </span>
            ))}
            <span className="act-toolbar-divider" />
            {byType.map((t) => (
              <span key={t.key}
                className={`act-type-chip ${typeFilter === t.key ? "act-type-chip-on" : ""}`}
                style={{ color: t.color, background: typeFilter === t.key ? t.color : t.bg, borderColor: `${t.color}30` }}
                onClick={() => setTypeFilter((cur) => (cur === t.key ? "" : t.key))}>
                {t.icon} {t.count} {t.label}
              </span>
            ))}
            {isMgr && (
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="act-team-select"
                title="Filter berdasarkan sales"
              >
                <option value="">👥 Semua anggota tim</option>
                {salesTeam.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "✕ Tutup" : "+ Tambah tugas"}
          </button>
        </div>

        {/* ── Inline add form ── */}
        {showForm && (
          <form className="card act-add-form" onSubmit={handleAddTask}>
            <div className="card-title">Tambah tugas baru</div>
            <div className="act-add-form-fields">
              <div className="field" style={{ flex: 3 }}>
                <label>Judul tugas</label>
                <input placeholder="Cth: Follow-up Andi Wijaya soal kontrak"
                  value={fTitle} onChange={(e) => setFTitle(e.target.value)} autoFocus />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Tipe</label>
                <select value={fType} onChange={(e) => setFType(e.target.value)}>
                  {Object.entries(TYPE_META).map(([k, m]) => (
                    <option key={k} value={k}>{m.icon} {m.label}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Terkait lead (opsional)</label>
                <select value={fLeadId} onChange={(e) => setFLeadId(e.target.value)}>
                  <option value="">— Gak terkait lead —</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.company}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 2 }}>
                <label>Deadline</label>
                <input type="datetime-local" value={fDue} onChange={(e) => setFDue(e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "Nyimpen…" : "Simpan tugas"}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>
                Batal
              </button>
            </div>
          </form>
        )}

        {/* ── Feed checklist simpel — bukan tabel data, biar gak berasa report ── */}
        {loading ? (
          <SkeletonTable rows={5} />
        ) : visibleActivities.length === 0 ? (
          <EmptyState
            icon="✅"
            title={filter || typeFilter ? "Gak ada tugas di filter ini" : "Belum ada tugas"}
            subtitle={filter || typeFilter ? "Coba pilih filter lain di atas." : "Tambah tugas pertama — follow-up call, kirim proposal, atau reminder internal."}
            action={!filter && !typeFilter ? { label: "+ Tambah tugas", onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="act-feed">
            {visibleActivities.map((a) => (
              <TaskRow key={a.id} activity={a} onToggled={updateOne} showAssignee={isMgr} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}