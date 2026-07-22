"use client";

import { useEffect, useState, FormEvent } from "react";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import InfoTip from "@/components/InfoTip";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiGet, apiPost, ApiError } from "@/lib/api";

type Product = {
  id: string; sku: string | null; name: string; unit: string; category: string | null;
  unit_price: number; reorder_level: number; stock_qty: number; is_low_stock: boolean;
};
type Movement = {
  id: string; product_id: string; product_name: string | null; type: string;
  qty: number; reference: string | null; note: string | null; created_by_name: string | null; created_at: string;
};

function formatRupiah(n: number) {
  if (n >= 1_000_000) return `Rp ${Math.round(n / 1_000_000)}jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

const MOVEMENT_META: Record<string, { label: string; color: string; sign: string; icon: string }> = {
  in: { label: "Masuk (PO diterima)", color: "var(--success)", sign: "+", icon: "📥" },
  out: { label: "Keluar (dipakai project)", color: "var(--warning)", sign: "−", icon: "📤" },
  adjustment: { label: "Koreksi manual", color: "var(--ai-1)", sign: "±", icon: "🛠" },
  return_out: { label: "Keluar (return ke vendor)", color: "var(--danger)", sign: "−", icon: "↩️" },
};

const CATEGORY_ICON: Record<string, string> = {
  Hardware: "🖥", Software: "💾", Consumable: "🧵", Jasa: "🛎",
};

const TAB_META = {
  stock: {
    label: "📦 Stock Sekarang",
    desc: "Snapshot — jumlah barang yang ADA di gudang SEKARANG, per produk.",
  },
  movements: {
    label: "📋 Riwayat Perubahan",
    desc: "Log — catatan tiap kali angka stock di atas berubah: kapan, kenapa, dan siapa yang bikin.",
  },
};

export default function InventoryPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMgr = user?.role === "manager" || user?.role === "admin";

  const [tab, setTab] = useState<"stock" | "movements">("stock");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [productFilter, setProductFilter] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");

  useEffect(() => { load(); }, [tab, lowStockOnly, productFilter]);

  async function load() {
    setLoading(true);
    try {
      if (tab === "stock") {
        setProducts(await apiGet<Product[]>(`/inventory/products${lowStockOnly ? "?low_stock_only=true" : ""}`));
      } else {
        const q = productFilter ? `?product_id=${productFilter.id}` : "";
        setMovements(await apiGet<Movement[]>(`/inventory/movements${q}`));
      }
    } finally {
      setLoading(false);
    }
  }

  function viewHistoryFor(product: Product) {
    setProductFilter({ id: product.id, name: product.name });
    setTab("movements");
  }

  function openAdjustFor(productId: string) {
    setAdjustProductId(productId);
    setShowAdjustForm(true);
    setShowAddForm(false);
  }

  const totalValue = products.reduce((s, p) => s + p.stock_qty * p.unit_price, 0);
  const lowStockCount = products.filter((p) => p.is_low_stock).length;

  return (
    <>
      <Topbar title="Inventory" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        <InfoTip label="Apa itu Inventory?">
          Stock barang yang kesimpen di gudang. Nambah otomatis pas <b>Purchase Order diterima</b>, berkurang otomatis pas
          <b> Purchase Return</b> dibalikin ke vendor. Manager/admin juga bisa koreksi manual (stock opname) dari sini —
          semuanya kecatet di <b>Riwayat Pergerakan</b>, gak ada angka yang berubah diem-diem.
        </InfoTip>

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{products.length}</div>
            <div className="dash-stat-lbl">Jenis produk</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: lowStockCount > 0 ? "var(--danger)" : "var(--text)" }}>{lowStockCount}</div>
            <div className="dash-stat-lbl">Stock menipis</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">{formatRupiah(totalValue)}</div>
            <div className="dash-stat-lbl">Total nilai stock</div>
          </div>
        </div>

        <div className="page-head">
          <div className="chip-row" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className={`chip ${tab === "stock" ? "on" : ""}`} onClick={() => { setTab("stock"); setProductFilter(null); }}>{TAB_META.stock.label}</span>
            <span className={`chip ${tab === "movements" ? "on" : ""}`} onClick={() => setTab("movements")}>{TAB_META.movements.label}</span>
            {tab === "stock" && (
              <span className={`chip ${lowStockOnly ? "on" : ""}`} onClick={() => setLowStockOnly((v) => !v)}>⚠ Menipis aja</span>
            )}
          </div>
          {tab === "stock" && isMgr && (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowAdjustForm((v) => !v); setShowAddForm(false); if (!adjustProductId && products[0]) setAdjustProductId(products[0].id); }}
              >
                {showAdjustForm ? "✕ Tutup" : "🛠 Koreksi Stock"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowAddForm((v) => !v); setShowAdjustForm(false); }}>
                {showAddForm ? "✕ Tutup" : "+ Tambah Produk"}
              </button>
            </div>
          )}
        </div>
        <div className="t-small" style={{ marginTop: -10, marginBottom: 14 }}>{TAB_META[tab].desc}</div>

        {tab === "movements" && productFilter && (
          <div className="callout-warn" style={{ marginBottom: 14 }}>
            📋 Nampilin riwayat <b>{productFilter.name}</b> aja.{" "}
            <button className="link-btn" onClick={() => setProductFilter(null)}>Lihat semua produk →</button>
          </div>
        )}

        {showAddForm && (
          <NewProductForm
            onCreated={() => { setShowAddForm(false); load(); toast("Produk ditambahkan ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {showAdjustForm && (
          <AdjustStockForm
            products={products}
            defaultProductId={adjustProductId}
            onDone={() => { setShowAdjustForm(false); load(); toast("Stock dikoreksi ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : tab === "stock" ? (
          products.length === 0 ? (
            <EmptyState icon="📦" title="Belum ada produk" subtitle="Tambahin produk dulu buat mulai tracking stock." />
          ) : (
            <table className="tbl">
              <thead><tr><th>Produk</th><th>Kategori</th><th>Stock sekarang</th><th>Harga satuan</th><th>Nilai stock</th><th></th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} style={p.is_low_stock ? { background: "rgba(248,113,113,.04)" } : undefined}>
                    <td className="cell-name">
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, background: "var(--surface2)",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0,
                      }}>
                        {CATEGORY_ICON[p.category || ""] || "📦"}
                      </div>
                      <div><b>{p.name}</b><span>{p.sku || "—"}</span></div>
                    </td>
                    <td className="t-small">{p.category || "—"}</td>
                    <td className="t-small">
                      <span style={{ fontWeight: 700, color: p.is_low_stock ? "var(--danger)" : "var(--text)" }}>
                        {p.stock_qty} {p.unit}
                      </span>
                      {p.is_low_stock && <span className="badge" style={{ marginLeft: 8, background: "rgba(248,113,113,.15)", color: "var(--danger)" }}>⚠ menipis</span>}
                    </td>
                    <td className="t-small">{formatRupiah(p.unit_price)}</td>
                    <td className="t-small" style={{ fontWeight: 700, color: "var(--text)" }}>{formatRupiah(p.stock_qty * p.unit_price)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                        <button className="link-btn" onClick={() => viewHistoryFor(p)}>📋 Riwayat</button>
                        {isMgr && <button className="link-btn" onClick={() => openAdjustFor(p.id)}>🛠 Koreksi</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : movements.length === 0 ? (
          <EmptyState
            icon="📋"
            title={productFilter ? `Belum ada riwayat buat ${productFilter.name}` : "Belum ada pergerakan stock"}
            subtitle="Muncul begitu ada PO diterima, Return diproses, atau koreksi manual."
          />
        ) : (
          <table className="tbl">
            <thead><tr><th>Produk</th><th>Tipe</th><th>Qty</th><th>Referensi</th><th>Oleh</th><th>Waktu</th></tr></thead>
            <tbody>
              {movements.map((m) => {
                const meta = MOVEMENT_META[m.type] || { label: m.type, color: "var(--muted)", sign: "", icon: "•" };
                return (
                  <tr key={m.id}>
                    <td className="t-small"><b style={{ color: "var(--text)" }}>{m.product_name}</b></td>
                    <td><span className="badge" style={{ background: `${meta.color}22`, color: meta.color }}>{meta.icon} {meta.label}</span></td>
                    <td className="t-small" style={{ fontWeight: 700, color: meta.color }}>{meta.sign}{m.qty}</td>
                    <td className="t-small">{m.reference || "—"}</td>
                    <td className="t-small">{m.created_by_name || "—"}</td>
                    <td className="t-small">{new Date(m.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function NewProductForm({ onCreated, onError }: { onCreated: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [category, setCategory] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { onError("Isi nama produk dulu."); return; }
    setSaving(true);
    try {
      await apiPost("/inventory/products", {
        name, sku: sku || null, unit, category: category || null,
        unit_price: unitPrice ? Number(unitPrice) : 0, reorder_level: Number(reorderLevel) || 0,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal nambah produk.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={handleSubmit}>
      <div className="card-title">Produk baru</div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama produk</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>SKU</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Satuan</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs / unit / roll" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Kategori</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Harga satuan (Rp)</label>
          <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Ambang batas stock menipis</label>
          <input type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Nyimpen…" : "Simpan produk"}
        </button>
      </div>
    </form>
  );
}

function AdjustStockForm({
  products, defaultProductId, onDone, onError,
}: { products: Product[]; defaultProductId: string; onDone: () => void; onError: (msg: string) => void }) {
  const [productId, setProductId] = useState(defaultProductId || products[0]?.id || "");
  const [type, setType] = useState<"in" | "out" | "adjustment">("adjustment");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (defaultProductId) setProductId(defaultProductId); }, [defaultProductId]);

  const selected = products.find((p) => p.id === productId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!productId || !qty || Number(qty) <= 0) { onError("Pilih produk dan isi qty yang valid."); return; }
    setSaving(true);
    try {
      await apiPost("/inventory/adjust", { product_id: productId, type, qty: Number(qty), note: note || null });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal koreksi stock.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16, borderColor: "rgba(139,92,246,.3)" }} onSubmit={handleSubmit}>
      <div className="card-title">🛠 Koreksi stock manual</div>
      <div className="t-small" style={{ marginBottom: 14, marginTop: -8 }}>
        Buat stock opname atau koreksi di luar alur Purchase — kejadian ini tetep kecatet di riwayat pergerakan.
      </div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Produk</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock_qty} {p.unit})</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Arah koreksi</label>
          <select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="adjustment">± Nambah (ketemu lebih pas opname)</option>
            <option value="out">− Ngurangin (rusak/hilang/kepake)</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Qty</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
        <label>Catatan (kenapa dikoreksi)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cth: Hasil stock opname bulanan, ketemu 2 unit lebih di gudang B" />
      </div>
      {selected && (
        <div className="t-small" style={{ marginTop: 10 }}>
          Stock sekarang: <b style={{ color: "var(--text)" }}>{selected.stock_qty} {selected.unit}</b> → jadi{" "}
          <b style={{ color: "var(--signal)" }}>
            {type === "out" ? Math.max(0, selected.stock_qty - Number(qty || 0)) : selected.stock_qty + Number(qty || 0)} {selected.unit}
          </b>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Nyimpen…" : "Simpan koreksi"}
        </button>
      </div>
    </form>
  );
}