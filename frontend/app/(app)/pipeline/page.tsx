"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

type Deal = {
  id: string;
  lead_id: string;
  title: string;
  value: number;
  stage: string;
  ai_probability: number | null;
  updated_at: string;
};

type Lead = { id: string; name: string; company: string };

const STAGES: { key: string; label: string; color: string; emoji: string }[] = [
  { key: "baru",        label: "Baru",        color: "var(--signal)",  emoji: "✦" },
  { key: "kualifikasi", label: "Kualifikasi", color: "var(--warning)", emoji: "◈" },
  { key: "proposal",    label: "Proposal",    color: "var(--ai-1)",    emoji: "◉" },
  { key: "negosiasi",   label: "Negosiasi",   color: "#FF8A4C",        emoji: "◐" },
  { key: "closed_won",  label: "Closed Won",  color: "var(--success)", emoji: "✓" },
  { key: "closed_lost", label: "Closed Lost", color: "var(--danger)",  emoji: "✕" },
];

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function probBadge(p: number | null) {
  if (p === null) return { bg: "var(--surface)", color: "var(--muted)", border: "var(--border2)" };
  if (p >= 75)    return { bg: "var(--success-soft)", color: "var(--success)", border: "transparent" };
  if (p >= 45)    return { bg: "var(--warning-soft)", color: "var(--warning)", border: "transparent" };
  return { bg: "var(--signal-soft)", color: "var(--signal)", border: "transparent" };
}

export default function PipelinePage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "calendar">("kanban");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [dealsData, leadsData] = await Promise.all([
        apiGet<Deal[]>("/deals"),
        apiGet<Lead[]>("/leads"),
      ]);
      setDeals(dealsData);
      setLeads(leadsData);
    } finally {
      setLoading(false);
    }
  }

  const leadMap = Object.fromEntries(leads.map((l) => [l.id, l]));

  async function moveStage(dealId: string, newStage: string) {
    const current = deals.find((d) => d.id === dealId);
    if (!current || current.stage === newStage) return;
    setMovingId(dealId);
    try {
      const updated = await apiPatch<Deal>(`/deals/${dealId}`, { stage: newStage });
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updated : d)));
      const stageLabel = STAGES.find((s) => s.key === newStage)?.label || newStage;
      toast(`Deal dipindah ke ${stageLabel} ✓`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal pindahin deal.", "error");
    } finally {
      setMovingId(null);
    }
  }

  function handleDrop(stageKey: string) {
    setDragOverStage(null);
    if (draggingId) moveStage(draggingId, stageKey);
    setDraggingId(null);
  }

  // Stats for header
  const totalValue = deals.reduce((s, d) => s + Number(d.value), 0);
  const wonDeals   = deals.filter((d) => d.stage === "closed_won");
  const wonValue   = wonDeals.reduce((s, d) => s + Number(d.value), 0);
  const activeDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage));

  return (
    <>
      <Topbar title="Pipeline" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">

        {/* Pipeline header stats — cuma relevan di Kanban, di Kalender bikin sesak & gak nyambung sama tampilan bulanan */}
        {view === "kanban" && (
          <div className="pipeline-stats-row">
            <div className="pipeline-stat">
              <div className="pipeline-stat-val">{activeDeals.length}</div>
              <div className="pipeline-stat-lbl">Deal aktif</div>
            </div>
            <div className="pipeline-stat-divider" />
            <div className="pipeline-stat">
              <div className="pipeline-stat-val">{wonDeals.length}</div>
              <div className="pipeline-stat-lbl">Closed won</div>
            </div>
            <div className="pipeline-stat-divider" />
            <div className="pipeline-stat">
              <div className="pipeline-stat-val" style={{ color: "var(--success)" }}>{formatRupiah(wonValue)}</div>
              <div className="pipeline-stat-lbl">Revenue closed</div>
            </div>
            <div className="pipeline-stat-divider" />
            <div className="pipeline-stat">
              <div className="pipeline-stat-val" style={{ color: "var(--signal)" }}>{formatRupiah(totalValue)}</div>
              <div className="pipeline-stat-lbl">Total pipeline</div>
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <div className="pipeline-view-toggle">
                <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")} title="Kanban">⬛ Kanban</button>
                <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")} title="Kalender">📅 Kalender</button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)} title="Bikin deal baru dan taruh di stage Baru">
                {showForm ? "✕ Tutup" : "+ Tambah deal"}
              </button>
            </div>
          </div>
        )}

        {/* Toolbar ringan buat Kalender — cuma switch view, gak ada tombol tambah deal (bikin deal baru gak relevan dari tampilan bulanan) */}
        {view === "calendar" && (
          <div className="pipeline-toolbar-lite">
            <div className="pipeline-view-toggle">
              <button className={view === "kanban" ? "on" : ""} onClick={() => setView("kanban")} title="Kanban">⬛ Kanban</button>
              <button className={view === "calendar" ? "on" : ""} onClick={() => setView("calendar")} title="Kalender">📅 Kalender</button>
            </div>
          </div>
        )}

        {showForm && (
          <NewDealForm
            leads={leads}
            onCreated={() => { setShowForm(false); load(); toast("Deal baru berhasil ditambahkan ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {!loading && deals.length === 0 && (
          <EmptyState
            icon="🗂️"
            title="Pipeline kamu masih kosong"
            subtitle={leads.length === 0
              ? "Tambahin lead dulu, baru bisa bikin deal dari lead itu."
              : "Bikin deal pertama dari salah satu lead yang udah ada."}
            action={{ label: "+ Tambah deal pertama", onClick: () => setShowForm(true) }}
          />
        )}

        {view === "calendar" && (
          <CalendarView
            deals={deals}
            leadMap={leadMap}
            month={calMonth}
            onPrev={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            onNext={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          />
        )}

        {view === "kanban" && (
          <div className="kanban">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage.key);
            const stageValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);
            const isClosed = stage.key === "closed_won" || stage.key === "closed_lost";

            return (
              <div
                className={`kcol ${dragOverStage === stage.key ? "drag-over" : ""} ${isClosed ? "kcol-closed" : ""}`}
                key={stage.key}
                style={stage.key === "closed_lost" ? { opacity: 0.8 } : undefined}
                onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.key); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(stage.key); }}
              >
                {/* Column header */}
                <div className="kcol-head">
                  <div className="kcol-name">
                    <span className="kcol-dot" style={{ background: stage.color }} />
                    <span style={{ flex: 1 }}>{stage.label}</span>
                    <span className="kcol-count">{stageDeals.length}</span>
                  </div>
                  {stageDeals.length > 0 && (
                    <div className="kcol-value">{formatRupiah(stageValue)}</div>
                  )}
                </div>

                {/* Drop zone hint */}
                {stageDeals.length === 0 && (
                  <div className="kcol-empty-hint">
                    <span>{stage.emoji}</span>
                    Belum ada deal
                  </div>
                )}

                {/* Deal cards */}
                {loading
                  ? <div className="deal-card-skeleton" />
                  : stageDeals.map((d) => {
                    const lead = leadMap[d.lead_id];
                    const pc = probBadge(d.ai_probability);
                    const isMoving = movingId === d.id;

                    return (
                      <div
                        className={`deal-card ${draggingId === d.id ? "dragging" : ""} ${isMoving ? "deal-moving" : ""}`}
                        key={d.id}
                        draggable
                        onDragStart={() => setDraggingId(d.id)}
                        onDragEnd={() => setDraggingId(null)}
                      >
                        <div className="deal-card-top">
                          {lead ? (
                            <Link href={`/leads/${lead.id}`} className="deal-co">{lead.company}</Link>
                          ) : (
                            <div className="deal-co">{d.title}</div>
                          )}
                          {lead && <div className="deal-contact">{lead.name}</div>}
                        </div>

                        <div className="deal-foot">
                          <span className="deal-val">{formatRupiah(Number(d.value))}</span>
                          {d.ai_probability !== null && (
                            <span className="prob-pill" style={{
                              background: pc.bg,
                              color: pc.color,
                              border: `1px solid ${pc.border}`,
                            }}>
                              🤖 {d.ai_probability}%
                            </span>
                          )}
                        </div>

                        {/* Stage mover - dropdown select */}
                        {!isClosed && (
                          <select
                            className="deal-stage-select"
                            value={stage.key}
                            onChange={(e) => moveStage(d.id, e.target.value)}
                            disabled={isMoving}
                          >
                            {STAGES.map((s) => (
                              <option key={s.key} value={s.key}>Pindah ke: {s.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
          </div>
        )}
      </div>
    </>
  );
}

const CAL_DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTH_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const DAY_FULL_ID = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

function CalendarView({ deals, leadMap, month, onPrev, onNext }: {
  deals: Deal[];
  leadMap: Record<string, Lead>;
  month: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Tutup panel hari tiap kali pindah bulan
  useEffect(() => { setSelectedDay(null); }, [month]);

  // build grid: 6 rows x 7 cols
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  // ISO week: Mon=0, so shift (0=Sun in JS)
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  // group deals by updated_at date (proxy for "closed date")
  const dealsByDay: Record<string, Deal[]> = {};
  for (const d of deals) {
    const date = new Date(d.updated_at ?? Date.now());
    if (date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()) {
      const key = date.getDate().toString();
      if (!dealsByDay[key]) dealsByDay[key] = [];
      dealsByDay[key].push(d);
    }
  }

  const todayDate = new Date();
  const isThisMonth = todayDate.getFullYear() === month.getFullYear() && todayDate.getMonth() === month.getMonth();
  const selectedDeals = selectedDay ? (dealsByDay[selectedDay.toString()] || []) : [];
  const selectedDate = selectedDay ? new Date(month.getFullYear(), month.getMonth(), selectedDay) : null;

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <button className="cal-nav" onClick={onPrev}>‹</button>
        <div className="cal-month-label">{MONTH_ID[month.getMonth()]} {month.getFullYear()}</div>
        <button className="cal-nav" onClick={onNext}>›</button>
      </div>
      <div className="cal-grid">
        {CAL_DAYS.map((d) => (
          <div className="cal-day-label" key={d}>{d}</div>
        ))}
        {cells.map((day, idx) => {
          const dayDeals = day ? (dealsByDay[day.toString()] || []) : [];
          const isToday = isThisMonth && day === todayDate.getDate();
          const isSelected = !!day && day === selectedDay;
          const visibleDeals = dayDeals.slice(0, 3);
          const hasOverflow = dayDeals.length > 3;

          return (
            <div
              className={`cal-cell ${!day ? "cal-cell-empty" : ""} ${isToday ? "cal-cell-today" : ""} ${isSelected ? "cal-cell-selected" : ""} ${day && dayDeals.length > 0 ? "cal-cell-clickable" : ""}`}
              key={idx}
              onClick={() => {
                if (!day || dayDeals.length === 0) return;
                setSelectedDay((cur) => (cur === day ? null : day));
              }}
            >
              {day && (
                <>
                  <div className="cal-date-row">
                    <div className={`cal-date-num ${isToday ? "cal-date-today" : ""}`}>{day}</div>
                    {dayDeals.length > 0 && <span className="cal-date-count">{dayDeals.length}</span>}
                  </div>
                  <div className="cal-deals">
                    {visibleDeals.map((d) => {
                      const stage = STAGES.find((s) => s.key === d.stage);
                      return (
                        <div
                          key={d.id}
                          className="cal-deal-pill"
                          style={{ borderLeftColor: stage?.color || "var(--muted)", background: `${stage?.color || "var(--muted)"}18` }}
                          title={d.title}
                        >
                          <span style={{ color: stage?.color || "var(--muted)", fontWeight: 700 }}>{stage?.emoji} </span>
                          {leadMap[d.lead_id]?.company || d.title}
                        </div>
                      );
                    })}
                    {hasOverflow && (
                      <div className="cal-deal-more">+{dayDeals.length - 3} lagi</div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Panel agenda hari terpilih — full width di bawah grid, gak bikin cell melar */}
      {selectedDate && (
        <div className="cal-day-panel">
          <div className="cal-day-panel-head">
            <div>
              <div className="cal-day-panel-title">{DAY_FULL_ID[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_ID[selectedDate.getMonth()]} {selectedDate.getFullYear()}</div>
              <div className="cal-day-panel-sub">{selectedDeals.length} deal pada tanggal ini</div>
            </div>
            <button className="cal-day-panel-close" onClick={() => setSelectedDay(null)} aria-label="Tutup">✕</button>
          </div>
          <div className="cal-agenda-list">
            {selectedDeals.map((d) => {
              const stage = STAGES.find((s) => s.key === d.stage);
              const lead = leadMap[d.lead_id];
              return (
                <div className="cal-agenda-item" key={d.id} style={{ borderLeftColor: stage?.color || "var(--muted)" }}>
                  <span className="cal-agenda-emoji" style={{ color: stage?.color || "var(--muted)" }}>{stage?.emoji}</span>
                  <div className="cal-agenda-body">
                    {lead ? (
                      <Link href={`/leads/${lead.id}`} className="cal-agenda-company">{lead.company}</Link>
                    ) : (
                      <div className="cal-agenda-company">{d.title}</div>
                    )}
                    <div className="cal-agenda-contact">
                      {lead?.name ? `${lead.name} · ` : ""}{d.title}
                    </div>
                  </div>
                  <span className="cal-agenda-stage-badge" style={{ background: `${stage?.color || "var(--muted)"}18`, color: stage?.color || "var(--muted)" }}>
                    {stage?.label || d.stage}
                  </span>
                  <span className="cal-agenda-value">{formatRupiah(Number(d.value))}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NewDealForm({ leads, onCreated, onError }: { leads: Lead[]; onCreated: () => void; onError: (msg: string) => void }) {
  const [leadId, setLeadId] = useState(leads[0]?.id || "");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!leadId) return;
    setSubmitting(true);
    try {
      await apiPost("/deals", { lead_id: leadId, title, value: Number(value) || 0 });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal nambah deal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 20 }} onSubmit={handleSubmit}>
      <div className="card-title">Deal baru</div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Lead</label>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.name} — {l.company}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Judul deal</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nilai (Rp)</label>
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} required />
        </div>
      </div>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} disabled={submitting}>
        {submitting ? "Nyimpen…" : "Simpan deal"}
      </button>
    </form>
  );
}