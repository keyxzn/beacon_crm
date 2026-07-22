"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import InfoTip from "@/components/InfoTip";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPatch, ApiError } from "@/lib/api";

type SalesRep = { id: string; name: string; email: string; role: string };
type Lead = { id: string; name: string; company: string; status: string; owner_id: string | null; approval_status: string };
type Deal = { id: string; lead_id: string; title: string; value: number; stage: string; owner_id: string | null };

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const STAGE_LABEL: Record<string, string> = {
  baru: "Baru", kualifikasi: "Kualifikasi", proposal: "Proposal",
  negosiasi: "Negosiasi", closed_won: "Closed Won", closed_lost: "Closed Lost",
};

export default function TeamPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TeamPage />
    </Suspense>
  );
}

function TeamPage() {
  const { setSidebarOpen } = useAppShell();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const repParam = searchParams.get("rep") || "";

  const [reps, setReps] = useState<SalesRep[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [reassigning, setReassigning] = useState<string>(""); // id item yang lagi diproses

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setSelectedId(repParam); // repParam kosong = "Semua Sales"
  }, [repParam]);

  async function load() {
    setLoading(true);
    try {
      const [teamData, leadsData, dealsData] = await Promise.all([
        apiGet<SalesRep[]>("/team"),
        apiGet<Lead[]>("/leads?approval_status=all"),
        apiGet<Deal[]>("/deals"),
      ]);
      const salesOnly = teamData.filter((t) => t.role === "sales");
      setReps(salesOnly);
      setLeads(leadsData);
      setDeals(dealsData);
    } finally {
      setLoading(false);
    }
  }

  const statsByRep = useMemo(() => {
    const map: Record<string, { leads: number; opps: number; pipeline: number }> = {};
    for (const r of reps) map[r.id] = { leads: 0, opps: 0, pipeline: 0 };
    for (const l of leads) if (l.owner_id && map[l.owner_id]) map[l.owner_id].leads++;
    for (const d of deals) {
      if (d.owner_id && map[d.owner_id]) {
        map[d.owner_id].opps++;
        if (d.stage !== "closed_lost") map[d.owner_id].pipeline += Number(d.value);
      }
    }
    return map;
  }, [reps, leads, deals]);

  const totalPipeline = Object.values(statsByRep).reduce((s, v) => s + v.pipeline, 0);
  const totalLeads = leads.filter((l) => l.owner_id).length;
  const totalOpps = deals.length;

  const isAllView = selectedId === "";
  const selectedRep = reps.find((r) => r.id === selectedId);
  const repMap = Object.fromEntries(reps.map((r) => [r.id, r]));

  // "Semua Sales" -> semua lead/deal yang udah ke-assign ke sales manapun.
  // Pilih 1 sales -> cuma punya dia.
  const viewLeads = isAllView ? leads.filter((l) => l.owner_id) : leads.filter((l) => l.owner_id === selectedId);
  const viewDeals = isAllView ? deals.filter((d) => d.owner_id) : deals.filter((d) => d.owner_id === selectedId);

  function selectRep(id: string) {
    setSelectedId(id);
    router.replace(id ? `/team?rep=${id}` : "/team");
  }

  async function reassignLead(leadId: string, newOwnerId: string) {
    setReassigning(leadId);
    try {
      await apiPatch(`/leads/${leadId}`, { owner_id: newOwnerId });
      toast("Lead dipindahkan ✓");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal mindahin lead.", "error");
    } finally {
      setReassigning("");
    }
  }

  async function reassignDeal(dealId: string, newOwnerId: string) {
    setReassigning(dealId);
    try {
      await apiPatch(`/deals/${dealId}`, { owner_id: newOwnerId });
      toast("Opportunity dipindahkan ✓");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal mindahin opportunity.", "error");
    } finally {
      setReassigning("");
    }
  }

  return (
    <>
      <Topbar title="Sales" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        <InfoTip label="Apa itu menu Sales?">
          Lihat beban kerja tiap sales — berapa <b>lead</b> & <b>opportunity</b> yang lagi dia pegang, dan berapa total value pipeline-nya.
          Kamu juga bisa <b>pindahin lead/opportunity ke sales lain</b> langsung dari sini, misalnya pas ada yang cuti atau resign.
        </InfoTip>

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{reps.length}</div>
            <div className="dash-stat-lbl">Sales aktif</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{totalLeads}</div>
            <div className="dash-stat-lbl">Total lead ke-assign</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{totalOpps}</div>
            <div className="dash-stat-lbl">Total opportunity</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{formatRupiah(totalPipeline)}</div>
            <div className="dash-stat-lbl">Total pipeline tim</div>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : reps.length === 0 ? (
          <EmptyState icon="👥" title="Belum ada sales di tim" subtitle="Tambahin akun sales lewat Settings > Tim." />
        ) : (
          <>
            {isAllView ? (
              /* ── Mode "Semua Sales": grid semua kartu ── */
              <div className="sales-rep-grid">
                {reps.map((r) => {
                  const s = statsByRep[r.id] || { leads: 0, opps: 0, pipeline: 0 };
                  return (
                    <button key={r.id} className="sales-rep-card" onClick={() => selectRep(r.id)}>
                      <div className="avatar" style={{ background: colorForName(r.name) }}>{initialsOf(r.name)}</div>
                      <div className="sales-rep-card-name">{r.name}</div>
                      <div className="sales-rep-card-email">{r.email}</div>
                      <div className="sales-rep-card-stats">
                        <span><b>{s.leads}</b> lead</span>
                        <span><b>{s.opps}</b> opportunity</span>
                      </div>
                      <div className="sales-rep-card-pipeline">{formatRupiah(s.pipeline)}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* ── Mode 1 sales: cuma dia doang yang kelihatan, gak ada rep lain ── */
              selectedRep && (
                <div className="sales-rep-focus">
                  <button className="sales-rep-focus-back" onClick={() => selectRep("")}>← Semua Sales</button>
                  <div className="sales-rep-focus-head">
                    <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, background: colorForName(selectedRep.name) }}>
                      {initialsOf(selectedRep.name)}
                    </div>
                    <div>
                      <div className="sales-rep-focus-name">{selectedRep.name}</div>
                      <div className="sales-rep-focus-email">{selectedRep.email}</div>
                    </div>
                    <div className="sales-rep-focus-stats">
                      <span><b>{statsByRep[selectedRep.id]?.leads ?? 0}</b> lead</span>
                      <span><b>{statsByRep[selectedRep.id]?.opps ?? 0}</b> opportunity</span>
                      <span className="sales-rep-focus-pipeline">{formatRupiah(statsByRep[selectedRep.id]?.pipeline ?? 0)}</span>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* ── Detail: leads + opportunities, bisa direassign ── */}
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-title">
                Beban kerja — {isAllView ? "Semua Sales" : selectedRep?.name}
              </div>

              <div className="t-small" style={{ marginBottom: 8, fontWeight: 700, color: "var(--text)" }}>Leads ({viewLeads.length})</div>
              {viewLeads.length === 0 ? (
                <div className="t-small" style={{ marginBottom: 16 }}>Belum ada lead yang di-assign.</div>
              ) : (
                <table className="tbl" style={{ marginBottom: 20 }}>
                  <thead><tr><th>Lead</th>{isAllView && <th>Sales</th>}<th>Status</th><th>Pindahkan ke</th></tr></thead>
                  <tbody>
                    {viewLeads.map((l) => {
                      const owner = l.owner_id ? repMap[l.owner_id] : null;
                      return (
                        <tr key={l.id}>
                          <td className="cell-name">
                            <div className="avatar" style={{ width: 26, height: 26, fontSize: 10.5, background: colorForName(l.company) }}>{initialsOf(l.company)}</div>
                            <div><Link href={`/leads/${l.id}`} style={{ textDecoration: "underline" }}><b>{l.name}</b></Link><span>{l.company}</span></div>
                          </td>
                          {isAllView && (
                            <td className="t-small">
                              {owner ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: colorForName(owner.name) }}>{initialsOf(owner.name)}</div>
                                  {owner.name}
                                </span>
                              ) : "—"}
                            </td>
                          )}
                          <td className="t-small">{l.approval_status === "approved" ? l.status : l.approval_status}</td>
                          <td>
                            <select
                              className="act-filter-select"
                              disabled={reassigning === l.id}
                              value=""
                              onChange={(e) => e.target.value && reassignLead(l.id, e.target.value)}
                            >
                              <option value="">— Pilih sales —</option>
                              {reps.filter((r) => r.id !== l.owner_id).map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              <div className="t-small" style={{ marginBottom: 8, fontWeight: 700, color: "var(--text)" }}>Opportunity ({viewDeals.length})</div>
              {viewDeals.length === 0 ? (
                <div className="t-small">Belum ada opportunity yang di-assign.</div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Opportunity</th>{isAllView && <th>Sales</th>}<th>Stage</th><th>Value</th><th>Pindahkan ke</th></tr></thead>
                  <tbody>
                    {viewDeals.map((d) => {
                      const owner = d.owner_id ? repMap[d.owner_id] : null;
                      return (
                        <tr key={d.id}>
                          <td className="cell-name"><b>{d.title}</b></td>
                          {isAllView && (
                            <td className="t-small">
                              {owner ? (
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div className="avatar" style={{ width: 20, height: 20, fontSize: 9, background: colorForName(owner.name) }}>{initialsOf(owner.name)}</div>
                                  {owner.name}
                                </span>
                              ) : "—"}
                            </td>
                          )}
                          <td className="t-small">{STAGE_LABEL[d.stage] || d.stage}</td>
                          <td className="t-small" style={{ fontWeight: 700, color: "var(--text)" }}>{formatRupiah(Number(d.value))}</td>
                          <td>
                            <select
                              className="act-filter-select"
                              disabled={reassigning === d.id}
                              value=""
                              onChange={(e) => e.target.value && reassignDeal(d.id, e.target.value)}
                            >
                              <option value="">— Pilih sales —</option>
                              {reps.filter((r) => r.id !== d.owner_id).map((r) => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}