"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import EmptyState from "@/components/EmptyState";
import { SkeletonTable } from "@/components/Skeleton";
import { useToast } from "@/lib/toast";
import InfoTip from "@/components/InfoTip";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, ApiError } from "@/lib/api";

type Customer = {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  channel: string | null;
  created_at: string;
  leads_given: number;
  opportunities_count: number;
  is_repeat: boolean;
  last_interaction_at: string | null;
};

function timeAgo(dateStr: string | null) {
  if (!dateStr) return "—";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export default function CustomersPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CustomersPage />
    </Suspense>
  );
}

function CustomersPage() {
  const { setSidebarOpen } = useAppShell();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterParam = (searchParams.get("filter") as "" | "repeat" | "new") || "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"" | "repeat" | "new">(filterParam);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [filter, search]);
  useEffect(() => { setFilter(filterParam); }, [filterParam]);

  function changeFilter(f: "" | "repeat" | "new") {
    setFilter(f);
    router.replace(f ? `/customers?filter=${f}` : "/customers");
  }

  async function load() {
    setLoading(true);
    try {
      setCustomers(await apiGet<Customer[]>("/customers"));
    } finally {
      setLoading(false);
    }
  }

  const filtered = customers.filter((c) => {
    if (filter === "repeat" && !c.is_repeat) return false;
    if (filter === "new" && c.is_repeat) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !(c.contact_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const repeatCount = customers.filter((c) => c.is_repeat).length;
  const viaWA = customers.filter((c) => c.channel === "WhatsApp").length;
  const viaManual = customers.length - viaWA;

  return (
    <>
      <Topbar
        title="Customer"
        onMenuClick={() => setSidebarOpen(true)}
        rightSlot={
          <div className="search-box">
            <span>⌕</span>
            <input placeholder="Cari customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />
      <div className="content">
        <InfoTip label="Apa itu Customer?">
          <b>Customer</b> adalah pihak yang ngasih lead — bukan lead itu sendiri.
          1 customer bisa muncul berkali-kali kalau dia repeat inquiry, jadi histori komunikasinya kekumpul di 1 profil.
        </InfoTip>

        <div className="dash-stat-strip">
          <div className="dash-stat">
            <div className="dash-stat-val">{customers.length}</div>
            <div className="dash-stat-lbl">Total customer</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val" style={{ color: "var(--ai-1)" }}>{repeatCount}</div>
            <div className="dash-stat-lbl">Repeat customer</div>
          </div>
          <div className="dash-stat-divider" />
          <div className="dash-stat">
            <div className="dash-stat-val">🤖 {viaWA} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>via WA</span></div>
            <div className="dash-stat-lbl">✍ {viaManual} manual/lainnya</div>
          </div>
        </div>

        <div className="page-head">
          <div className="chip-row" style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <span className={`chip ${filter === "" ? "on" : ""}`} onClick={() => changeFilter("")}>Semua</span>
            <span className={`chip ${filter === "repeat" ? "on" : ""}`} onClick={() => changeFilter("repeat")}>🔁 Repeat customer</span>
            <span className={`chip ${filter === "new" ? "on" : ""}`} onClick={() => changeFilter("new")}>🆕 Baru</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "✕ Tutup" : "+ Tambah customer"}
          </button>
        </div>

        {showForm && (
          <NewCustomerForm
            onCreated={() => { setShowForm(false); load(); toast("Customer baru ditambahkan ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {loading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="card" style={{ padding: paged.length === 0 ? 0 : "6px 20px 12px", background: paged.length === 0 ? "transparent" : undefined, border: paged.length === 0 ? "none" : undefined }}>
            {paged.length === 0 ? (
              <EmptyState
                icon="🏢"
                title={customers.length === 0 ? "Belum ada customer" : "Gak ada customer yang cocok"}
                subtitle={customers.length === 0 ? "Customer bakal otomatis kebentuk begitu ada lead masuk (manual atau via WA)." : "Coba ubah filter atau kata pencarian di atas."}
                action={customers.length === 0 ? { label: "+ Tambah customer pertama", onClick: () => setShowForm(true) } : undefined}
              />
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Customer</th><th>Kontak utama</th><th>Sumber</th>
                    <th>Lead diberikan</th><th>Jadi opportunity</th><th>Interaksi terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => (
                    <tr key={c.id}>
                      <td className="cell-name">
                        <div className="avatar" style={{ background: colorForName(c.name) }}>{initialsOf(c.name)}</div>
                        <div>
                          <b>{c.name}</b>
                          {c.is_repeat && <span>🔁 Repeat customer</span>}
                        </div>
                      </td>
                      <td className="t-small">
                        {c.contact_name || "—"}
                        {c.phone && <div style={{ color: "var(--muted)" }}>{c.phone}</div>}
                      </td>
                      <td className="t-small">{c.channel === "WhatsApp" ? "🤖 WhatsApp" : `✍ ${c.channel || "Manual"}`}</td>
                      <td className="t-small">{c.leads_given}</td>
                      <td className="t-small">
                        {c.opportunities_count > 0 ? (
                          <span className="badge badge-qualified">{c.opportunities_count} opportunity</span>
                        ) : "—"}
                      </td>
                      <td className="t-small">{timeAgo(c.last_interaction_at)}</td>
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
              Menampilkan {(pageSafe - 1) * pageSize + 1}–{Math.min(pageSafe * pageSize, filtered.length)} dari {filtered.length} customer
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

function NewCustomerForm({ onCreated, onError }: { onCreated: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState("Website");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { onError("Isi nama customer dulu."); return; }
    setSaving(true);
    try {
      await apiPost("/customers", {
        name, contact_name: contactName || null, phone: phone || null, email: email || null, channel,
      });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal nambah customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={handleSubmit}>
      <div className="card-title">Customer baru</div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama perusahaan/customer</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama kontak utama</label>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>No. telepon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opsional" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Sumber</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option>Website</option><option>WhatsApp</option><option>Referral</option><option>Event</option><option>Cold outreach</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? "Nyimpen…" : "Simpan customer"}
        </button>
      </div>
    </form>
  );
}