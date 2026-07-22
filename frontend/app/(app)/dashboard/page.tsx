"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import { SkeletonCard } from "@/components/Skeleton";
import AIPanel, { AIBullet } from "@/components/AIPanel";
import EmptyState from "@/components/EmptyState";
import TaskRow, { Activity } from "@/components/TaskRow";
import { StatusBadge } from "@/components/Badge";
import { useAuth } from "@/lib/auth";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet } from "@/lib/api";

type Lead = {
  id: string;
  name: string;
  company: string;
  status: string;
  source: string | null;
  ai_score: number | null;
  created_at: string;
};

type Deal = {
  id: string;
  lead_id: string;
  stage: string;
  value: number;
  created_at: string;
  updated_at: string;
};

type Chain = {
  customer_count: number;
  sales_count: number;
  opportunity_count: number;
  pipeline_value: number;
  auto_lead_count: number;
  manual_lead_count: number;
  project_count: number;
  project_ongoing_count: number;
  purchase_pending_count: number;
  inventory_low_stock_count: number;
};

const REVENUE_TARGET = 900_000_000;

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export default function DashboardPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Activity[]>([]);
  const [chain, setChain] = useState<Chain | null>(null);
  const [nextBestAction, setNextBestAction] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [leadsData, dealsData, tasksData, chainData] = await Promise.all([
        apiGet<Lead[]>("/leads"),
        apiGet<Deal[]>("/deals"),
        apiGet<Activity[]>("/activities?filter=due_today"),
        apiGet<Chain>("/dashboard/chain"),
      ]);
      setLeads(leadsData);
      setDeals(dealsData);
      setTasks(tasksData);
      setChain(chainData);

      const candidate = [...leadsData]
        .filter((l) => l.status !== "qualified" && l.status !== "unqualified")
        .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0];
      if (candidate) {
        const detail = await apiGet<{ ai_next_best_action: string }>(`/leads/${candidate.id}`);
        setNextBestAction(detail.ai_next_best_action);
      }
    } finally {
      setLoading(false);
    }
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const leadsThisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;
  const activeDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length;
  const won = deals.filter((d) => d.stage === "closed_won");
  const lost = deals.filter((d) => d.stage === "closed_lost");
  const winRate = won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
  const revenue = won.reduce((sum, d) => sum + Number(d.value), 0);
  const revenuePct = Math.min(100, Math.round((revenue / REVENUE_TARGET) * 100));

  const staleDeals = deals.filter((d) => {
    const days = (Date.now() - new Date(d.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 5 && !["closed_won", "closed_lost"].includes(d.stage);
  });
  // Lead yang deal-nya udah closed (won/lost) udah gak butuh "perhatian" lagi — beres atau udah gugur
  const closedLeadIds = new Set(
    deals.filter((d) => d.stage === "closed_won" || d.stage === "closed_lost").map((d) => d.lead_id)
  );
  const hotLeads = leads.filter((l) => (l.ai_score ?? 0) >= 70 && l.status !== "qualified" && !closedLeadIds.has(l.id));
  const openLeads = leads.filter((l) => !closedLeadIds.has(l.id));

  const recentLeads = [...openLeads]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Leads yang butuh perhatian: skor tinggi tapi belum qualified duluan, sisanya diisi lead terbaru — dealnya masih aktif (belum closed)
  const priorityIds = new Set(hotLeads.map((l) => l.id));
  const attentionLeads = [
    ...hotLeads.slice(0, 5),
    ...recentLeads.filter((l) => !priorityIds.has(l.id)),
  ].slice(0, 5);

  return (
    <>
      <Topbar title="Dashboard" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        {loading ? (
          <div className="grid-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : (
          <>
            <div className="role-greeting-banner" data-role={user?.role}>
              <div className="role-greeting-main">
                <div className="role-greeting-icon">
                  {user?.role === "manager" ? "🎯" : "⚡"}
                </div>
                <div>
                  <div className="role-greeting-title">
                    {user?.role === "manager"
                      ? `Dashboard Tim — ${user.name.split(" ")[0]}`
                      : `Halo, ${user.name.split(" ")[0]}!`}
                  </div>
                  <div className="role-greeting-sub">
                    {user?.role === "manager"
                      ? "Pantau performa tim, approve submission sales, dan monitor semua pipeline dari sini."
                      : "Ini ringkasan lead & deal kamu hari ini — ikutin rekomendasi AI biar gak ada yang kelewat."}
                  </div>
                </div>
              </div>
              <div className="dash-hero-revenue">
                <div className="dash-hero-revenue-label">{user?.role === "manager" ? "Revenue tim" : "Revenue kamu"}</div>
                <div className="dash-hero-revenue-value">{formatRupiah(revenue)}</div>
                <div className="dash-hero-progress-track">
                  <div className="dash-hero-progress-fill" style={{ width: `${revenuePct}%` }} />
                </div>
                <div className="dash-hero-revenue-sub">{revenuePct}% dari target {formatRupiah(REVENUE_TARGET)}</div>
              </div>
            </div>

            {/* ── Chain flow: Customer → Sales → Opportunity → Pipeline → Project → Purchase → Inventory ──
                 Manager-only: kebanyakan node-nya nunjuk ke halaman yang emang di luar akses Sales
                 (Customer/Opportunity/Project/Purchase/Inventory), jadi daripada nunjukin link yang keblokir,
                 mending gak usah ditampilin buat Sales. Sales udah kecukupan sama pulse-row di atas. */}
            {chain && user?.role === "manager" && (
              <div className="chain-card">
                <div className="chain-head">
                  <div>
                    <div className="t-h3">{user?.role === "manager" ? "Alur kerja tim" : "Alur kerja kamu"}</div>
                    <div className="t-small">
                      {user?.role === "manager"
                        ? "Customer kasih lead → Sales kerjain → di-approve jadi Opportunity → lanjut ke Pipeline-nya sendiri"
                        : "Customer kasih lead ke kamu → kamu kerjain → di-approve manager jadi Opportunity → lanjut ke Pipeline"}
                    </div>
                  </div>
                  <div className="chain-input-tags">
                    <span className="chain-input-tag">🤖 <b>{chain.auto_lead_count}</b> lead otomatis (WA)</span>
                    <span className="chain-input-tag">✍ <b>{chain.manual_lead_count}</b> lead manual</span>
                  </div>
                </div>
                <div className="chain-flow">
                  <Link href="/customers" className="chain-node">
                    <div className="chain-node-icon">🏢</div>
                    <div className="chain-node-label">Customer</div>
                    <div className="chain-node-value">{chain.customer_count}</div>
                    <div className="chain-node-desc">{user?.role === "sales" ? "Yang kasih lead ke kamu" : "Pihak yang ngasih lead ke tim"}</div>
                  </Link>
                  <div className="chain-arrow"><span>→</span></div>
                  <Link href="/leads?tab=active" className="chain-node">
                    <div className="chain-node-icon">👤</div>
                    <div className="chain-node-label">Sales</div>
                    <div className="chain-node-value">{user?.role === "sales" ? "Kamu" : chain.sales_count}</div>
                    <div className="chain-node-desc">{user?.role === "sales" ? user.name : "Yang lagi ngerjain lead"}</div>
                  </Link>
                  <div className="chain-arrow"><span>→</span></div>
                  <Link href="/opportunities" className="chain-node is-opportunity">
                    <div className="chain-node-icon">🎯</div>
                    <div className="chain-node-label">Opportunity</div>
                    <div className="chain-node-value">{chain.opportunity_count}</div>
                    <div className="chain-node-desc">Lead yang udah di-approve manager</div>
                  </Link>
                  <div className="chain-arrow"><span>→</span></div>
                  <Link href="/pipeline" className="chain-node is-opportunity">
                    <div className="chain-node-icon">◧</div>
                    <div className="chain-node-label">Pipeline</div>
                    <div className="chain-node-value">{formatRupiah(chain.pipeline_value)}</div>
                    <div className="chain-node-desc">Total value di Kanban, lanjutan Opportunity</div>
                  </Link>
                </div>

                <div className="chain-divider">
                  <span>Closed Won</span>
                </div>

                <div className="chain-flow">
                  <Link href="/projects" className="chain-node is-ops">
                    <div className="chain-node-icon">📁</div>
                    <div className="chain-node-label">Project</div>
                    <div className="chain-node-value">{chain.project_count}</div>
                    <div className="chain-node-desc">{chain.project_ongoing_count} lagi berjalan</div>
                  </Link>
                  <div className="chain-arrow"><span>→</span></div>
                  <Link href="/purchases" className="chain-node is-ops">
                    <div className="chain-node-icon">🧾</div>
                    <div className="chain-node-label">Purchase</div>
                    <div className="chain-node-value">{chain.purchase_pending_count}</div>
                    <div className="chain-node-desc">{chain.purchase_pending_count > 0 ? "PR nunggu approval" : "Gak ada yang nunggu"}</div>
                  </Link>
                  <div className="chain-arrow"><span>→</span></div>
                  <Link href="/inventory" className="chain-node is-ops">
                    <div className="chain-node-icon">🏬</div>
                    <div className="chain-node-label">Inventory</div>
                    <div className="chain-node-value" style={{ color: chain.inventory_low_stock_count > 0 ? "var(--danger)" : undefined }}>
                      {chain.inventory_low_stock_count}
                    </div>
                    <div className="chain-node-desc">{chain.inventory_low_stock_count > 0 ? "produk stock menipis" : "stock aman semua"}</div>
                  </Link>
                </div>
              </div>
            )}

            <div className="dash-grid">
              {/* ── Kolom utama: yang butuh AKSI dari kamu hari ini ── */}
              <div className="dash-col-main">
                <div className="card">
                  <div className="card-title">Tugas hari ini <span className="t-small">{tasks.length} item</span></div>
                  {tasks.length === 0 ? (
                    <EmptyState icon="🎉" title="Bersih hari ini" subtitle="Gak ada tugas yang nge-pending buat hari ini." compact />
                  ) : (
                    tasks.map((t) => (
                      <TaskRow
                        key={t.id}
                        activity={t}
                        onToggled={(updated) => setTasks((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                      />
                    ))
                  )}
                </div>

                <div className="card">
                  <div className="card-title">
                    Leads butuh perhatian
                    <Link href="/leads?tab=active" className="t-small" style={{ textDecoration: "underline" }}>Lihat semua →</Link>
                  </div>
                  {attentionLeads.length === 0 ? (
                    <EmptyState
                      icon="📭"
                      title="Belum ada lead"
                      subtitle="Lead yang butuh follow-up bakal nongol di sini."
                      compact
                    />
                  ) : (
                    <div className="attention-feed">
                      {attentionLeads.map((l) => (
                        <Link href={`/leads/${l.id}`} key={l.id} className="attention-row">
                          <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: colorForName(l.name) }}>
                            {initialsOf(l.name)}
                          </div>
                          <div className="attention-info">
                            <div className="attention-name">{l.name}</div>
                            <div className="attention-sub">{l.company}</div>
                          </div>
                          {(l.ai_score ?? 0) >= 70 && l.status !== "qualified" && (
                            <span className="attention-flag">🔥 Skor {l.ai_score}</span>
                          )}
                          <StatusBadge status={l.status} />
                          <span className="attention-arrow">→</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Kolom samping: sekilas angka + rekomendasi AI, bukan buat dianalisa (itu tugas Reports) ── */}
              <div className="dash-col-side">
                <div className="dash-pulse-row">
                  <div className="dash-pulse-card">
                    <span className="dash-pulse-label">Lead baru</span>
                    <div className="dash-pulse-value">{leadsThisWeek}</div>
                    <div className="t-small">7 hari terakhir{user?.role !== "manager" ? " · punya kamu" : ""}</div>
                  </div>
                  <div className="dash-pulse-card">
                    <span className="dash-pulse-label">Deal aktif</span>
                    <div className="dash-pulse-value">{activeDeals}</div>
                    <div className="t-small">{user?.role === "manager" ? "di pipeline tim" : "di pipeline kamu"}</div>
                  </div>
                  <div className="dash-pulse-card">
                    <span className="dash-pulse-label">Win rate</span>
                    <div className="dash-pulse-value" style={{ color: winRate > 0 ? "var(--success)" : undefined }}>{winRate}%</div>
                    <div className="t-small">dari deal diputuskan</div>
                  </div>
                </div>

                <AIPanel calm title="AI Insight">
                  {hotLeads.length > 0 && (
                    <AIBullet><strong>{hotLeads.length} lead</strong> skor tinggi belum di-follow up — prioritaskan hari ini.</AIBullet>
                  )}
                  {staleDeals.length > 0 ? (
                    staleDeals.slice(0, 2).map((d) => (
                      <AIBullet key={d.id}>Deal senilai <strong>{formatRupiah(Number(d.value))}</strong> berisiko mundur, gak ada update 5+ hari.</AIBullet>
                    ))
                  ) : (
                    hotLeads.length === 0 && <AIBullet>Belum ada sinyal risiko — begitu ada lead/deal aktif, AI bakal mulai kasih insight di sini.</AIBullet>
                  )}
                </AIPanel>

                <AIPanel calm icon="🎯" title="Next Best Action">
                  <AIBullet>{nextBestAction || "Tambahin lead pertama kamu buat mulai dapet rekomendasi aksi dari AI."}</AIBullet>
                </AIPanel>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}