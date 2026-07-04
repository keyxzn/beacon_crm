"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import RevenueChart from "@/components/RevenueChart";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import AIPanel from "@/components/AIPanel";
import { SkeletonCard } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiDownload, ApiError } from "@/lib/api";

type ReportsData = {
  granularity: "daily" | "monthly";
  range_from: string;
  range_to: string;
  revenue_by_month: { month: string; total: number }[];
  funnel: { stage: string; count: number }[];
  leaderboard: { user_id: string; name: string; deals_closed: number; win_rate: number; revenue: number }[];
  churn_risk: { lead_id: string; company: string; reason: string; recommendation: string }[];
  deals: { id: string; lead_id: string; title: string; company: string; stage: string; value: number; owner_name: string | null; updated_at: string }[];
};

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const STAGE_LABEL: Record<string, string> = {
  baru: "Baru",
  kualifikasi: "Kualifikasi",
  proposal: "Proposal",
  negosiasi: "Negosiasi",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const MEDALS = ["🥇", "🥈", "🥉"];

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return n === 0 ? "Rp 0" : `Rp ${n.toLocaleString("id-ID")}`;
}

export default function ReportsPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const router = useRouter();
  const isMgr = user?.role === "manager" || user?.role === "admin";
  const { toast } = useToast();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<"daily" | "monthly">("monthly");
  const [fromDate, setFromDate] = useState(isoDaysAgo(180));
  const [toDate, setToDate] = useState(todayIso());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    load();
  }, [granularity, fromDate, toDate]);

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ granularity, from_date: fromDate, to_date: toDate });
    apiGet<ReportsData>(`/reports?${params}`).then(setData).finally(() => setLoading(false));
  }

  function applyPreset(preset: "7d" | "30d" | "month" | "6m") {
    const to = todayIso();
    if (preset === "7d") { setGranularity("daily"); setFromDate(isoDaysAgo(6)); setToDate(to); }
    if (preset === "30d") { setGranularity("daily"); setFromDate(isoDaysAgo(29)); setToDate(to); }
    if (preset === "month") { setGranularity("monthly"); setFromDate(isoDaysAgo(180)); setToDate(to); }
    if (preset === "6m") { setGranularity("monthly"); setFromDate(isoDaysAgo(180)); setToDate(to); }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
      await apiDownload(`/reports/export?${params}`, `beacon-report-${fromDate}_${toDate}.pdf`);
      toast("Laporan PDF berhasil di-export ✓");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal export report.", "error");
    } finally {
      setExporting(false);
    }
  }

  const totalRev = data ? data.revenue_by_month.reduce((s, r) => s + r.total, 0) : 0;
  const topEarner = data?.leaderboard[0];
  const closedWonCount = data?.funnel.find((f) => f.stage === "closed_won")?.count ?? 0;
  const totalFunnelCount = data ? data.funnel.reduce((s, f) => s + f.count, 0) : 0;
  const avgDeal = closedWonCount > 0 ? totalRev / closedWonCount : 0;
  const maxFunnel = data ? Math.max(1, ...data.funnel.map((f) => f.count)) : 1;

  return (
    <>
      <Topbar title="Reports" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">

        {/* Toolbar: range tanggal, granularity, export */}
        <div className="reports-toolbar">
          <div className="reports-toolbar-presets">
            <button className="chip" onClick={() => applyPreset("7d")}>7 hari</button>
            <button className="chip" onClick={() => applyPreset("30d")}>30 hari</button>
            <button className="chip" onClick={() => applyPreset("6m")}>6 bulan</button>
          </div>
          <div className="reports-toolbar-dates">
            <input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} />
            <span className="t-small">s/d</span>
            <input type="date" value={toDate} min={fromDate} max={todayIso()} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="reports-toolbar-granularity">
            <button className={`chip ${granularity === "daily" ? "on" : ""}`} onClick={() => setGranularity("daily")}>Harian</button>
            <button className={`chip ${granularity === "monthly" ? "on" : ""}`} onClick={() => setGranularity("monthly")}>Bulanan</button>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={handleExport} disabled={exporting}>
            {exporting ? "Nyiapin…" : "⬇ Export PDF"}
          </button>
        </div>

        {data && (
          <div className="t-small" style={{ marginBottom: 14 }}>
            Menampilkan data {new Date(data.range_from).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            {" — "}
            {new Date(data.range_to).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}

        {loading || !data ? (
          <div className="grid-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : (
          <>
            {/* ── KPI row — angka-angka utama, flat, gak ada gradient/hero ── */}
            <div className="grid-4" style={{ marginBottom: 14 }}>
              <StatCard label={`Total Revenue${!isMgr ? " (Kamu)" : ""}`} value={formatRupiah(totalRev)} sub={`dari ${closedWonCount} deal closed won`} />
              <StatCard label="Deal di funnel" value={totalFunnelCount} sub="semua stage aktif" />
              <StatCard label="Rata-rata deal" value={avgDeal > 0 ? formatRupiah(avgDeal) : "—"} sub="per deal closed won" />
              {isMgr ? (
                <StatCard label="Top performer" value={topEarner ? topEarner.name.split(" ")[0] : "—"} sub={topEarner ? `${formatRupiah(topEarner.revenue)} revenue` : "belum ada data"} />
              ) : (
                <StatCard label="Churn risk" value={data.churn_risk.length} sub="customer butuh perhatian" color={data.churn_risk.length > 0 ? "var(--danger)" : undefined} />
              )}
            </div>

            {/* ── Row 1: Revenue trend + Stage breakdown ── */}
            <div className="grid-2" style={{ marginBottom: 16 }}>

              <div className="card">
                <div className="card-title">
                  Revenue {granularity === "daily" ? "per hari" : "per bulan"}
                  <span className="t-small" style={{ color: "var(--signal)", fontWeight: 700 }}>
                    {formatRupiah(totalRev)} total
                  </span>
                </div>
                {data.revenue_by_month.length === 0 ? (
                  <EmptyState icon="📈" title="Belum ada revenue" subtitle="Muncul begitu ada deal yang closed won." compact />
                ) : (
                  <RevenueChart data={data.revenue_by_month} formatValue={formatRupiah} />
                )}
              </div>

              <div className="card">
                <div className="card-title">
                  Deal per stage
                  <span className="t-small">{totalFunnelCount} deal total</span>
                </div>
                {data.funnel.every((f) => f.count === 0) ? (
                  <EmptyState icon="📊" title="Belum ada deal" subtitle="Bakal keisi begitu ada lead di pipeline." compact />
                ) : (
                  <div className="stage-bars">
                    {data.funnel.map((f) => {
                      const label = STAGE_LABEL[f.stage] || f.stage;
                      const pct = Math.round((f.count / maxFunnel) * 100);
                      const share = totalFunnelCount > 0 ? Math.round((f.count / totalFunnelCount) * 100) : 0;
                      const isWon = f.stage === "closed_won";
                      return (
                        <div className="stage-bar-row" key={f.stage}>
                          <div className="stage-bar-label">{label}</div>
                          <div className="stage-bar-track">
                            <div
                              className="stage-bar-fill"
                              style={{ width: `${Math.max(pct, f.count > 0 ? 4 : 0)}%`, background: isWon ? "var(--success)" : "var(--signal)" }}
                            />
                          </div>
                          <div className="stage-bar-count">{f.count} <span className="t-small">({share}%)</span></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 2: Leaderboard + Churn Risk ── */}
            <div className="grid-2">

              <div className="card">
                <div className="card-title">
                  {isMgr ? "Leaderboard" : "Performa Kamu"}
                  <span className="t-small">{isMgr ? "ranking berdasarkan revenue" : "revenue & win rate kamu"}</span>
                </div>
                {data.leaderboard.length === 0 ? (
                  <EmptyState icon="🏆" title="Leaderboard kosong" subtitle="Muncul begitu ada deal yang closed." compact />
                ) : (
                  <div className="leaderboard-list">
                    {data.leaderboard.map((row, idx) => (
                      <Link
                        href={`/leads?owner=${row.user_id}`}
                        className={`leaderboard-row leaderboard-row--clickable ${isMgr && idx === 0 ? "leaderboard-first" : ""}`}
                        key={row.user_id}
                      >
                        {isMgr && (
                          <div className="leaderboard-rank">
                            {idx < 3 ? MEDALS[idx] : <span className="leaderboard-num">{idx + 1}</span>}
                          </div>
                        )}
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 11, background: colorForName(row.name) }}>
                          {initialsOf(row.name)}
                        </div>
                        <div className="leaderboard-info">
                          <div className="leaderboard-name">{row.name}</div>
                          <div className="leaderboard-sub">{row.deals_closed} deal · Win rate {row.win_rate}%</div>
                        </div>
                        <div className="leaderboard-revenue">
                          {formatRupiah(row.revenue)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <AIPanel icon="🤖" title="AI Churn Risk Detection">
                <div className="t-small" style={{ marginBottom: 12, marginTop: -4 }}>Customer yang udah closed won tapi mulai sepi interaksi</div>
                {data.churn_risk.length === 0 ? (
                  <EmptyState icon="✅" title="Semua customer aman" subtitle="Gak ada sinyal churn signifikan minggu ini." compact />
                ) : (
                  <div className="churn-risk-list">
                    {data.churn_risk.map((c) => (
                      <Link href={`/leads/${c.lead_id}`} className="churn-risk-item churn-risk-item--clickable" key={c.lead_id}>
                        <div className="churn-risk-company">
                          <span className="churn-dot">⚠</span>
                          {c.company}
                          <span className="churn-risk-arrow">→</span>
                        </div>
                        <div className="churn-risk-reason">{c.reason}</div>
                        <div className="churn-risk-rec">{c.recommendation}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </AIPanel>
            </div>

            {/* ── Detail Deal — data mentahnya, biar report ini beneran bisa dicek per baris ── */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">
                Detail Deal
                <span className="t-small">{data.deals.length} deal di rentang ini</span>
              </div>
              {data.deals.length === 0 ? (
                <EmptyState icon="📋" title="Belum ada deal" subtitle="Deal yang di-update di rentang tanggal ini bakal muncul di sini." compact />
              ) : (
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  <table className="tbl">
                    <thead style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
                      <tr>
                        <th>Deal</th>
                        <th>Perusahaan</th>
                        {isMgr && <th>Sales</th>}
                        <th>Stage</th>
                        <th>Nilai</th>
                        <th>Terakhir update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.deals.map((d) => {
                        const isWon = d.stage === "closed_won";
                        const isLost = d.stage === "closed_lost";
                        const label = STAGE_LABEL[d.stage] || (isLost ? "Closed Lost" : d.stage);
                        return (
                          <tr key={d.id} className="tbl-row--clickable" onClick={() => router.push(`/leads/${d.lead_id}`)}>
                            <td className="cell-name"><b>{d.title}</b></td>
                            <td>{d.company}</td>
                            {isMgr && <td className="t-small">{d.owner_name || "—"}</td>}
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: isWon ? "var(--success-soft)" : isLost ? "var(--danger-soft)" : "var(--signal-soft)",
                                  color: isWon ? "var(--success)" : isLost ? "var(--danger)" : "var(--signal)",
                                }}
                              >
                                {label}
                              </span>
                            </td>
                            <td><b>{formatRupiah(d.value)}</b></td>
                            <td className="t-small">
                              {new Date(d.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}