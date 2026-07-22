"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import InfoTip from "@/components/InfoTip";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

type Project = {
  id: string; deal_id: string; name: string; budget: number; status: string;
  owner_id: string | null; owner_name: string | null; deal_title: string | null;
  customer_name: string | null; created_at: string; spent: number; budget_used_pct: number;
};
type Deal = { id: string; title: string; stage: string };

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  planning: { label: "Planning", color: "var(--warning)" },
  ongoing: { label: "Ongoing", color: "var(--signal)" },
  completed: { label: "Completed", color: "var(--success)" },
  cancelled: { label: "Cancelled", color: "var(--danger)" },
};

export default function ProjectsPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMgr = user?.role === "manager" || user?.role === "admin";

  const [projects, setProjects] = useState<Project[]>([]);
  const [closedDeals, setClosedDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [projData, dealsData] = await Promise.all([
        apiGet<Project[]>("/projects"),
        apiGet<Deal[]>("/deals"),
      ]);
      setProjects(projData);
      const projDealIds = new Set(projData.map((p) => p.deal_id));
      setClosedDeals(dealsData.filter((d) => d.stage === "closed_won" && !projDealIds.has(d.id)));
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiPatch(`/projects/${id}`, { status });
      toast("Status project diupdate ✓");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal update status.", "error");
    }
  }

  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spent, 0);
  const ongoingCount = projects.filter((p) => p.status === "ongoing").length;

  return (
    <>
      <Topbar title="Project" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        <InfoTip label="Apa itu Project?">
          <b>Project</b> dibuat dari opportunity yang udah <b>Closed Won</b> — abis dimenangin, kerjaannya lanjut ke sini.
          Budget project ini yang jadi acuan buat <b>Purchase Request/Order</b> yang nempel ke project ini.
        </InfoTip>

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{projects.length}</div>
            <div className="dash-stat-lbl">Total project</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: "var(--signal)" }}>{ongoingCount}</div>
            <div className="dash-stat-lbl">Lagi berjalan</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{formatRupiah(totalBudget)}</div>
            <div className="dash-stat-lbl">Total budget</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: totalSpent > totalBudget ? "var(--danger)" : "var(--text)" }}>{formatRupiah(totalSpent)}</div>
            <div className="dash-stat-lbl">Total terpakai (PO received)</div>
          </div>
        </div>

        <div className="page-head">
          <div className="t-small">Project jalan dari opportunity yang menang</div>
          {closedDeals.length > 0 && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "✕ Tutup" : "+ Buat Project"}
            </button>
          )}
        </div>

        {showForm && (
          <NewProjectForm
            deals={closedDeals}
            onCreated={() => { setShowForm(false); load(); toast("Project dibuat ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {loading ? (
          <SkeletonTable rows={4} />
        ) : projects.length === 0 ? (
          <EmptyState icon="📁" title="Belum ada project" subtitle="Muncul begitu ada opportunity yang Closed Won terus dibikin project-nya." />
        ) : (
          <div className="project-grid">
            {projects.map((p) => {
              const status = STATUS_META[p.status] || { label: p.status, color: "var(--muted)" };
              const overBudget = p.budget > 0 && p.spent > p.budget;
              return (
                <div key={p.id} className="project-card">
                  <div className="project-card-top">
                    <span className="badge" style={{ background: `${status.color}22`, color: status.color }}>{status.label}</span>
                    {isMgr ? (
                      <select
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value)}
                        className="project-status-select"
                      >
                        {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                      </select>
                    ) : null}
                  </div>

                  <div className="project-card-name">{p.name}</div>
                  <div className="project-card-customer">{p.customer_name || p.deal_title}</div>

                  <div className="project-card-pic">
                    <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: colorForName(p.owner_name || "?") }}>
                      {initialsOf(p.owner_name || "?")}
                    </div>
                    <span>{p.owner_name || "Belum ada PIC"}</span>
                  </div>

                  <div className="project-card-budget">
                    <div className="project-card-budget-row">
                      <span>Budget terpakai</span>
                      <span style={{ color: overBudget ? "var(--danger)" : "var(--text)", fontWeight: 700 }}>
                        {formatRupiah(p.spent)} <span style={{ color: "var(--muted)", fontWeight: 500 }}>/ {formatRupiah(p.budget)}</span>
                      </span>
                    </div>
                    <div className="project-card-progress-track">
                      <div className="project-card-progress-fill" style={{
                        width: `${Math.min(100, p.budget_used_pct)}%`,
                        background: overBudget ? "var(--danger)" : "var(--signal)",
                      }} />
                    </div>
                    {overBudget && <div className="project-card-overbudget">⚠ Over-budget {(p.budget_used_pct - 100).toFixed(0)}%</div>}
                  </div>

                  <Link href={`/purchases?project=${p.id}`} className="project-card-purchase-link">
                    🧾 Lihat Purchase terkait →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function NewProjectForm({ deals, onCreated, onError }: { deals: Deal[]; onCreated: () => void; onError: (msg: string) => void }) {
  const [dealId, setDealId] = useState(deals[0]?.id || "");
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dealId || !name.trim() || !budget) { onError("Lengkapin dulu opportunity, nama project, dan budget-nya."); return; }
    setSaving(true);
    try {
      await apiPost("/projects", { deal_id: dealId, name, budget: Number(budget) });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal bikin project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={handleSubmit}>
      <div className="card-title">Project baru dari opportunity Closed Won</div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Opportunity</label>
          <select value={dealId} onChange={(e) => setDealId(e.target.value)}>
            {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama project</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cth: Implementasi Sistem — PT ABC" autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Budget (Rp)</label>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="50000000" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Nyimpen…" : "Buat Project"}
        </button>
      </div>
    </form>
  );
}