"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import InfoTip from "@/components/InfoTip";
import { useAuth } from "@/lib/auth";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet } from "@/lib/api";

type Deal = {
  id: string;
  lead_id: string;
  title: string;
  value: number;
  stage: string;
  ai_probability: number | null;
  owner_id: string | null;
  updated_at: string;
};

type Lead = { id: string; name: string; company: string; owner_name?: string | null };
type TeamMember = { id: string; name: string };

const STAGES: Record<string, { label: string; color: string }> = {
  baru:         { label: "Baru",        color: "var(--signal)" },
  kualifikasi:  { label: "Kualifikasi", color: "var(--warning)" },
  proposal:     { label: "Proposal",    color: "var(--ai-1)" },
  negosiasi:    { label: "Negosiasi",   color: "#FF8A4C" },
  closed_won:   { label: "Closed Won",  color: "var(--success)" },
  closed_lost:  { label: "Closed Lost", color: "var(--danger)" },
};

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function probBadge(p: number | null) {
  if (p === null) return { bg: "var(--surface)", color: "var(--muted)" };
  if (p >= 75) return { bg: "var(--success-soft)", color: "var(--success)" };
  if (p >= 45) return { bg: "var(--warning-soft)", color: "var(--warning)" };
  return { bg: "var(--signal-soft)", color: "var(--signal)" };
}

export default function OpportunitiesPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const isSales = user?.role === "sales";

  const [deals, setDeals] = useState<Deal[]>([]);
  const [leadMap, setLeadMap] = useState<Record<string, Lead>>({});
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [stageFilter, search]);

  async function load() {
    setLoading(true);
    try {
      const [dealsData, leadsData, teamData] = await Promise.all([
        apiGet<Deal[]>("/deals"),
        apiGet<Lead[]>("/leads"),
        !isSales ? apiGet<TeamMember[]>("/team") : Promise.resolve([] as TeamMember[]),
      ]);
      setDeals(dealsData);
      setLeadMap(Object.fromEntries(leadsData.map((l) => [l.id, l])));
      setTeamMap(Object.fromEntries(teamData.map((t) => [t.id, t.name])));
    } finally {
      setLoading(false);
    }
  }

  const filtered = deals.filter((d) => {
    if (stageFilter && d.stage !== stageFilter) return false;
    if (search) {
      const lead = leadMap[d.lead_id];
      const hay = `${d.title} ${lead?.company || ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const activeCount = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length;
  const wonValue = deals.filter((d) => d.stage === "closed_won").reduce((s, d) => s + Number(d.value), 0);
  const pipelineValue = deals.filter((d) => d.stage !== "closed_lost").reduce((s, d) => s + Number(d.value), 0);

  return (
    <>
      <Topbar
        title="Opportunity"
        onMenuClick={() => setSidebarOpen(true)}
        rightSlot={
          <div className="search-box">
            <span>⌕</span>
            <input placeholder="Cari opportunity…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      <div className="content">
        <InfoTip label="Apa itu Opportunity?">
          <b>Opportunity</b> adalah lead yang udah di-approve manager — statusnya naik dari "calon" jadi "kerjaan beneran".
          Progresnya digeser di <Link href="/pipeline" style={{ textDecoration: "underline" }}>Pipeline (Kanban) →</Link>
        </InfoTip>

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{deals.length}</div>
            <div className="dash-stat-lbl">Total opportunity</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: "var(--signal)" }}>{activeCount}</div>
            <div className="dash-stat-lbl">Masih aktif di pipeline</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: "var(--success)" }}>{formatRupiah(wonValue)}</div>
            <div className="dash-stat-lbl">Closed won</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{formatRupiah(pipelineValue)}</div>
            <div className="dash-stat-lbl">Total value pipeline</div>
          </div>
        </div>

        <div className="page-head">
          <div className="chip-row" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className={`chip ${stageFilter === "" ? "on" : ""}`} onClick={() => setStageFilter("")}>Semua</span>
            {Object.entries(STAGES).map(([key, s]) => (
              <span key={key} className={`chip ${stageFilter === key ? "on" : ""}`} onClick={() => setStageFilter(key)}>{s.label}</span>
            ))}
          </div>
          <Link href="/pipeline" className="btn btn-primary btn-sm">+ Tambah opportunity</Link>
        </div>

        {loading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="card" style={{ padding: paged.length === 0 ? 0 : "6px 20px 12px", background: paged.length === 0 ? "transparent" : undefined, border: paged.length === 0 ? "none" : undefined }}>
            {paged.length === 0 ? (
              <EmptyState
                icon="🎯"
                title={deals.length === 0 ? "Belum ada opportunity" : "Gak ada opportunity yang cocok"}
                subtitle={deals.length === 0 ? "Muncul otomatis begitu ada lead yang di-approve manager." : "Coba ubah filter stage atau kata pencarian di atas."}
              />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Opportunity</th>{!isSales && <th>Sales</th>}<th>Stage</th><th>Value</th><th>Probability</th><th>Update terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d) => {
                    const lead = leadMap[d.lead_id];
                    const stage = STAGES[d.stage] || { label: d.stage, color: "var(--muted)" };
                    const prob = probBadge(d.ai_probability);
                    const ownerName = d.owner_id ? teamMap[d.owner_id] : null;
                    return (
                      <tr key={d.id}>
                        <td className="cell-name">
                          <div className="avatar" style={{ background: colorForName(lead?.company || d.title) }}>
                            {initialsOf(lead?.company || d.title)}
                          </div>
                          <div>
                            <Link href={lead ? `/leads/${lead.id}` : "/pipeline"} style={{ textDecoration: "underline" }}><b>{d.title}</b></Link>
                            <span>{lead?.company || "—"}</span>
                          </div>
                        </td>
                        {!isSales && (
                          <td className="t-small">
                            {ownerName ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: colorForName(ownerName) }}>
                                  {initialsOf(ownerName)}
                                </div>
                                {ownerName}
                              </div>
                            ) : "—"}
                          </td>
                        )}
                        <td>
                          <span className="badge" style={{ background: `${stage.color}22`, color: stage.color }}>{stage.label}</span>
                        </td>
                        <td className="t-small" style={{ fontWeight: 700, color: "var(--text)" }}>{formatRupiah(Number(d.value))}</td>
                        <td>
                          {d.ai_probability !== null ? (
                            <span className="badge" style={{ background: prob.bg, color: prob.color }}>{d.ai_probability}%</span>
                          ) : "—"}
                        </td>
                        <td className="t-small">{timeAgo(d.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Menampilkan {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} dari {filtered.length} opportunity
            </div>
            <div className="pagination-controls">
              <button className="pagination-btn" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>‹ Sebelumnya</button>
              <span className="pagination-page">Hal {pageSafe} / {totalPages}</span>
              <button className="pagination-btn" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>Selanjutnya ›</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}