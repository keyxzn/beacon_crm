"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import InfoTip from "@/components/InfoTip";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

type Purchase = {
  id: string; number: string; type: "request" | "order" | "return"; status: string;
  project_id: string | null; project_name: string | null; vendor_name: string | null;
  notes: string | null; requester_name: string | null; approver_name: string | null;
  source_purchase_id: string | null; total_value: number;
  items: { id: string; product_id: string; product_name: string | null; unit: string | null; qty: number; unit_price: number; subtotal: number }[];
  created_at: string;
};
type Project = { id: string; name: string };
type Product = { id: string; name: string; unit: string; unit_price: number };

function formatRupiah(n: number) {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`;
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const TYPE_META: Record<string, { label: string; desc: string; icon: string }> = {
  request: { label: "Purchase Request", desc: "PR — permintaan internal, belum ke vendor", icon: "📝" },
  order: { label: "Purchase Order", desc: "PO — pesenan resmi yang udah dikirim ke vendor", icon: "📦" },
  return: { label: "Purchase Return", desc: "Barang dibalikin ke vendor (rusak/kelebihan/salah kirim)", icon: "↩️" },
};

const STATUS_COLOR: Record<string, string> = {
  draft: "var(--muted)", submitted: "var(--warning)", approved: "var(--signal)",
  rejected: "var(--danger)", ordered: "var(--ai-1)", received: "var(--success)", completed: "var(--success)",
};

const STATUS_META: Record<string, { label: string; icon: string }> = {
  draft: { label: "Draft", icon: "✏️" },
  submitted: { label: "Menunggu approval", icon: "⏳" },
  approved: { label: "Disetujui", icon: "✅" },
  rejected: { label: "Ditolak", icon: "✕" },
  ordered: { label: "Dikirim ke vendor", icon: "🚚" },
  received: { label: "Diterima", icon: "📥" },
  completed: { label: "Selesai", icon: "✅" },
};

// urutan status berikutnya yang valid per tipe, dipakai buat nentuin tombol aksi yang muncul
const NEXT_STATUS: Record<string, Record<string, { next: string; label: string }[]>> = {
  request: {
    draft: [{ next: "submitted", label: "Submit" }],
    submitted: [{ next: "approved", label: "Approve" }, { next: "rejected", label: "Tolak" }],
  },
  order: {
    draft: [{ next: "ordered", label: "Kirim ke Vendor" }],
    ordered: [{ next: "received", label: "Tandai Diterima" }],
  },
  return: {
    draft: [{ next: "submitted", label: "Submit" }],
    submitted: [{ next: "completed", label: "Tandai Selesai" }],
  },
};

export default function PurchasesPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PurchasesPage />
    </Suspense>
  );
}

function PurchasesPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectFilter = searchParams.get("project") || "";
  const typeParam = searchParams.get("type") as "request" | "order" | "return" | null;
  const statusFilter = searchParams.get("status") || "";
  const isMgr = user?.role === "manager" || user?.role === "admin";

  const [type, setType] = useState<"request" | "order" | "return">(typeParam || "request");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Purchase | null>(null);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => { load(); }, [type, statusFilter]);
  useEffect(() => {
    if (typeParam) setType(typeParam);
  }, [typeParam]);
  useEffect(() => {
    apiGet<Project[]>("/projects").then(setProjects).catch(() => {});
    apiGet<Product[]>("/inventory/products").then(setProducts).catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (projectFilter) params.set("project_id", projectFilter);
      if (statusFilter) params.set("status", statusFilter);
      setPurchases(await apiGet<Purchase[]>(`/purchases?${params.toString()}`));
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      await apiPatch(`/purchases/${id}/status`, { status });
      toast("Status diupdate ✓");
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal update status.", "error");
    }
  }

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await apiPatch(`/purchases/${rejectTarget.id}/status`, { status: "rejected" });
      toast(`${rejectTarget.number} ditolak`);
      setRejectTarget(null);
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal nolak.", "error");
    } finally {
      setRejecting(false);
    }
  }

  const meta = TYPE_META[type];
  const totalValue = purchases.reduce((s, p) => s + p.total_value, 0);

  return (
    <>
      <Topbar title="Purchase" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        <InfoTip label="Apa itu Purchase?">
          Alurnya nyambung: <b>Purchase Request</b> (PR) diajuin dulu → di-approve manager → jadi <b>Purchase Order</b> (PO) yang dikirim ke vendor →
          barang dateng, stock otomatis nambah di <b>Inventory</b>. Kalau ada barang rusak/kelebihan, dibalikin lewat <b>Purchase Return</b> — stock otomatis berkurang lagi.
        </InfoTip>

        <div className="page-head">
          <div className="chip-row" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {Object.entries(TYPE_META).map(([k, m]) => (
              <span key={k} className={`chip ${type === k ? "on" : ""}`} onClick={() => { setType(k as any); router.replace("/purchases"); }}>{m.icon} {m.label}</span>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "✕ Tutup" : `+ Buat ${meta.label}`}
          </button>
        </div>
        <div className="t-small" style={{ marginTop: -10, marginBottom: 14 }}>{meta.desc}</div>

        {statusFilter && (
          <div className="callout-warn" style={{ marginBottom: 14 }}>
            ⏳ Nampilin yang statusnya <b>{statusFilter}</b> aja.{" "}
            <button className="link-btn" onClick={() => router.replace("/purchases")}>Lihat semua →</button>
          </div>
        )}

        {showForm && (
          <NewPurchaseForm
            type={type} projects={projects} products={products}
            purchasesForReturn={type === "return" ? purchases : []}
            onCreated={() => { setShowForm(false); load(); toast(`${meta.label} dibuat ✓`); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{purchases.length}</div>
            <div className="dash-stat-lbl">Total {meta.label}</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{formatRupiah(totalValue)}</div>
            <div className="dash-stat-lbl">Total nilai</div>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={4} />
        ) : purchases.length === 0 ? (
          <EmptyState icon={meta.icon} title={`Belum ada ${meta.label}`} subtitle="Bikin dari tombol di atas." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {purchases.map((p) => {
              const actions = NEXT_STATUS[type]?.[p.status] || [];
              const isPending = p.status === "submitted" && type === "request";
              const statusMeta = STATUS_META[p.status] || { label: p.status, icon: "•" };
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderColor: isPending ? "rgba(255,178,61,.4)" : undefined,
                    background: isPending ? "rgba(255,178,61,.03)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontFamily: "'Sora',sans-serif", fontSize: 14.5 }}>{p.number}</span>
                        <span className="badge" style={{ background: `${STATUS_COLOR[p.status]}22`, color: STATUS_COLOR[p.status] }}>
                          {statusMeta.icon} {statusMeta.label}
                        </span>
                      </div>
                      <div className="t-small" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {p.project_name && <span>📁 {p.project_name}</span>}
                        {p.vendor_name && <span>🏢 {p.vendor_name}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontFamily: "'Sora',sans-serif", fontSize: 16 }}>{formatRupiah(p.total_value)}</div>
                      <div className="t-small">{p.items.length} item</div>
                    </div>
                  </div>

                  <table className="tbl" style={{ marginBottom: 10 }}>
                    <thead><tr><th>Item</th><th>Qty</th><th>Harga satuan</th><th>Subtotal</th></tr></thead>
                    <tbody>
                      {p.items.map((it) => (
                        <tr key={it.id}>
                          <td className="t-small">{it.product_name}</td>
                          <td className="t-small">{it.qty} {it.unit}</td>
                          <td className="t-small">{formatRupiah(it.unit_price)}</td>
                          <td className="t-small" style={{ fontWeight: 700, color: "var(--text)" }}>{formatRupiah(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="avatar" style={{ width: 26, height: 26, fontSize: 10.5, background: colorForName(p.requester_name || "?") }}>
                        {initialsOf(p.requester_name || "?")}
                      </div>
                      <div className="t-small">
                        <div>Diajuin oleh <b style={{ color: "var(--text)" }}>{p.requester_name}</b>{p.approver_name && <> · disetujui <b style={{ color: "var(--text)" }}>{p.approver_name}</b></>}</div>
                        {p.notes && <div style={{ marginTop: 1 }}>{p.notes}</div>}
                      </div>
                    </div>
                    {actions.length > 0 && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {actions.map((a) => {
                          // approve/reject PR & PO cuma boleh manager
                          if ((a.next === "approved" || a.next === "rejected") && !isMgr) return null;
                          if (a.next === "rejected") {
                            return (
                              <button key={a.next} className="btn btn-secondary btn-sm" onClick={() => setRejectTarget(p)}>
                                {a.label}
                              </button>
                            );
                          }
                          return (
                            <button
                              key={a.next}
                              className={`btn btn-sm ${a.next === "approved" ? "btn-primary" : "btn-secondary"}`}
                              onClick={() => changeStatus(p.id, a.next)}
                            >
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <ConfirmDialog
          open={!!rejectTarget}
          title={`Tolak ${rejectTarget?.number ?? ""}?`}
          message={`PR ini bakal ditandain "ditolak" dan berhenti di situ. ${rejectTarget?.requester_name || "Yang ngajuin"} bisa ajuin PR baru kalau perlu direvisi.`}
          confirmLabel="Ya, Tolak"
          danger
          loading={rejecting}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      </div>
    </>
  );
}

function NewPurchaseForm({
  type, projects, products, purchasesForReturn, onCreated, onError,
}: {
  type: "request" | "order" | "return"; projects: Project[]; products: Product[];
  purchasesForReturn: Purchase[];
  onCreated: () => void; onError: (msg: string) => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [sourcePurchaseId, setSourcePurchaseId] = useState(purchasesForReturn[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ product_id: string; qty: number }[]>([{ product_id: products[0]?.id || "", qty: 1 }]);
  const [saving, setSaving] = useState(false);

  function addItem() { setItems((prev) => [...prev, { product_id: products[0]?.id || "", qty: 1 }]); }
  function removeItem(idx: number) { setItems((prev) => prev.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, field: "product_id" | "qty", value: string) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: field === "qty" ? Number(value) : value } : it));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (type === "return" && !sourcePurchaseId) { onError("Pilih PO asal barang yang mau dibalikin."); return; }
    if (items.some((it) => !it.product_id || it.qty < 1)) { onError("Lengkapin semua item barangnya."); return; }
    setSaving(true);
    try {
      await apiPost("/purchases", {
        type, project_id: projectId || null, vendor_name: vendorName || null,
        source_purchase_id: type === "return" ? sourcePurchaseId : null,
        notes: notes || null, items,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal bikin purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={handleSubmit}>
      <div className="card-title">{TYPE_META[type].label} baru</div>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Project (opsional)</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— Gak terkait project —</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {type !== "request" && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Vendor</label>
            <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Nama vendor" />
          </div>
        )}
        {type === "return" && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>PO asal</label>
            <select value={sourcePurchaseId} onChange={(e) => setSourcePurchaseId(e.target.value)}>
              {purchasesForReturn.map((p) => <option key={p.id} value={p.id}>{p.number}</option>)}
            </select>
          </div>
        )}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Catatan</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
        </div>
      </div>

      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, display: "block" }}>Item barang</label>
      {items.map((it, idx) => (
        <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
          <select value={it.product_id} onChange={(e) => updateItem(idx, "product_id", e.target.value)} style={{ flex: 3 }}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
          <input type="number" min={1} value={it.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)} style={{ flex: 1 }} />
          {items.length > 1 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeItem(idx)}>✕</button>
          )}
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginBottom: 14 }}>+ Tambah item</button>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Nyimpen…" : `Buat ${TYPE_META[type].label}`}
        </button>
      </div>
    </form>
  );
}