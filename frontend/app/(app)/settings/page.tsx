"use client";

import { useState, useEffect, FormEvent } from "react";
import { useAppShell } from "../layout";
import Topbar from "@/components/Topbar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { SkeletonRow } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { useTheme } from "@/lib/theme";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet, apiPost, apiPatch, apiDelete, ApiError } from "@/lib/api";

type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "sales";
};

export default function SettingsPage() {
  const { setSidebarOpen } = useAppShell();
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  const [notifDeal, setNotifDeal] = useState(true);
  const [notifTask, setNotifTask] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(false);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";

  const TABS = [
    { key: "profile", label: "Profil", icon: "👤" },
    { key: "appearance", label: "Tampilan", icon: "🎨" },
    ...(!isAdmin ? [{ key: "notifications", label: "Notifikasi", icon: "🔔" }] : []),
    ...(isAdmin || isManager ? [{ key: "team", label: "Tim & Akun", icon: "👥" }] : []),
  ];
  const [tab, setTab] = useState(TABS[0].key);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiPatch("/team/me", { name, email });
      localStorage.setItem("beacon_user", JSON.stringify(updated));
      toast("Profil berhasil disimpan ✓");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal nyimpen profil.", "error");
    } finally {
      setSaving(false);
    }
  }

  const roleBadgeClass = isAdmin ? "" : isManager ? "settings-role-manager" : "settings-role-sales";
  const roleLabel = isAdmin ? "Admin" : isManager ? "Manager" : "Sales";
  const bannerClass = isAdmin ? "settings-banner-admin" : isManager ? "settings-banner-manager" : "settings-banner-sales";
  const bannerIcon = isAdmin ? "👑" : isManager ? "🧭" : "⚡";
  const bannerTitle = isAdmin ? "Admin Panel" : isManager ? "Manager Settings" : "Settings";
  const bannerSub = isAdmin
    ? "Kamu punya akses penuh ke manajemen akun. Buat akun baru, ganti password, dan atur role anggota tim."
    : isManager
    ? "Kelola profil, tampilan, notifikasi, dan lihat anggota tim dari sini."
    : "Kelola profil dan preferensi tampilan kamu.";

  return (
    <>
      <Topbar title="Settings" onMenuClick={() => setSidebarOpen(true)} />
      <div className="content">
        <div className={`settings-banner ${bannerClass}`}>
          <div className="settings-banner-icon">{bannerIcon}</div>
          <div>
            <div className="settings-banner-title">{bannerTitle}</div>
            <div className="settings-banner-sub">{bannerSub}</div>
          </div>
        </div>

        <div className="settings-shell">
          {/* Sub-nav kiri — biar settings gak jadi satu halaman panjang gulung terus */}
          <div className="settings-nav">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`settings-nav-item ${tab === t.key ? "on" : ""}`}
                onClick={() => setTab(t.key)}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          <div className="settings-panel" style={tab === "team" ? undefined : { maxWidth: 640 }}>
            {tab === "profile" && (
              <form className="card" onSubmit={handleSubmit}>
                <div className="card-title">Profil Kamu</div>
                <div className="settings-profile-hero">
                  <div className="settings-avatar-wrap">
                    <div className="avatar avatar-lg" style={{ width: 60, height: 60, fontSize: 20, background: isAdmin ? "var(--ai-1)" : colorForName(name || "?") }}>
                      {initialsOf(name || "?")}
                    </div>
                    <div className={`settings-role-badge ${roleBadgeClass}`}>{roleLabel}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
                    <div className="t-small" style={{ marginTop: 2 }}>{email}</div>
                  </div>
                </div>
                <div className="field">
                  <label>Nama lengkap</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? "Nyimpen…" : "Simpan perubahan"}
                </button>
              </form>
            )}

            {tab === "appearance" && (
              <div className="card">
                <div className="card-title">Tampilan</div>
                <ToggleRow label="Mode gelap" sub={theme === "dark" ? "Aktif sekarang" : "Lagi pakai mode terang"} checked={theme === "dark"} onChange={toggleTheme} />
              </div>
            )}

            {tab === "notifications" && !isAdmin && (
              <div className="card">
                <div className="card-title">Notifikasi</div>
                {isManager && (
                  <ToggleRow label="Deal baru masuk" sub="Email tiap ada deal ditugaskan ke kamu" checked={notifDeal} onChange={setNotifDeal} />
                )}
                <ToggleRow label="Reminder tugas" sub="Push notifikasi sebelum deadline" checked={notifTask} onChange={setNotifTask} />
                <ToggleRow label="Laporan mingguan" sub="Ringkasan performa tiap Senin pagi" checked={notifWeekly} onChange={setNotifWeekly} />
              </div>
            )}

            {tab === "team" && isAdmin && <AdminTeamSection currentUserId={user?.id} />}
            {tab === "team" && isManager && <ManagerTeamView />}
          </div>
        </div>
      </div>
    </>
  );
}

/** Admin-only: full CRUD tim + ganti role + reset password */
function AdminTeamSection({ currentUserId }: { currentUserId?: string }) {
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pwTarget, setPwTarget] = useState<TeamMember | null>(null);

  function load() {
    setLoading(true);
    apiGet<TeamMember[]>("/team").then(setTeam).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function changeRole(userId: string, role: string) {
    setSavingId(userId);
    try {
      const updated = await apiPatch<TeamMember>(`/team/${userId}/role`, { role });
      setTeam((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      toast(`Role ${updated.name} diganti jadi ${role} ✓`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal ganti role.", "error");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiDelete(`/team/${deleteTarget.id}`);
      setTeam((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast(`Akun ${deleteTarget.name} dihapus ✓`);
      setDeleteTarget(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal hapus akun.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const grouped = {
    admin: team.filter((t) => t.role === "admin"),
    manager: team.filter((t) => t.role === "manager"),
    sales: team.filter((t) => t.role === "sales"),
  };

  return (
    <>
      <div className="card">
        <div className="card-title">
          <span>Manajemen Tim & Akun</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm((v) => !v)}>
            + Buat akun baru
          </button>
        </div>
        <div className="t-small" style={{ marginBottom: 18, color: "var(--muted)" }}>
          Kamu bisa buat akun baru, ganti role, reset password, atau hapus akun anggota tim.
        </div>

        {showForm && (
          <NewMemberForm
            onCreated={() => { setShowForm(false); load(); toast("Akun baru berhasil dibuat ✓"); }}
            onError={(msg) => toast(msg, "error")}
          />
        )}

        {loading ? (
          <>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</>
        ) : (
          <>
            {(["admin", "manager", "sales"] as const).map((roleKey) => (
              grouped[roleKey].length > 0 && (
                <div key={roleKey} style={{ marginBottom: 20 }}>
                  <div className="team-role-header">
                    <span className={`role-pill role-${roleKey}`}>{roleKey}</span>
                    <span className="t-small">{grouped[roleKey].length} akun</span>
                  </div>
                  {grouped[roleKey].map((member) => (
                    <div className="team-row" key={member.id}>
                      <div className="avatar" style={{ background: colorForName(member.name) }}>
                        {initialsOf(member.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="team-name">{member.name} {member.id === currentUserId && <span className="t-micro" style={{ color: "var(--signal)" }}>(kamu)</span>}</div>
                        <div className="team-email">{member.email}</div>
                      </div>
                      {member.id !== currentUserId ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <select
                            className="role-select"
                            value={member.role}
                            disabled={savingId === member.id}
                            onChange={(e) => changeRole(member.id, e.target.value)}
                          >
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="sales">Sales</option>
                          </select>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPwTarget(member)}
                            title="Reset password"
                            style={{ color: "var(--warning)", fontSize: 13 }}
                          >
                            🔑
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(member)}
                            style={{ color: "var(--danger)" }}
                          >
                            🗑
                          </button>
                        </div>
                      ) : (
                        <span className={`role-pill role-${member.role}`}>{member.role}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            ))}
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus akun ini?"
        message={`Akun "${deleteTarget?.name}" gak akan bisa login lagi. Lead/deal yang udah ada tetap kesimpen.`}
        confirmLabel="Hapus akun"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {pwTarget && (
        <ResetPasswordModal
          member={pwTarget}
          onClose={() => setPwTarget(null)}
          onDone={() => { setPwTarget(null); toast("Password berhasil direset ✓"); }}
        />
      )}
    </>
  );
}

function ResetPasswordModal({ member, onClose, onDone }: { member: TeamMember; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 6) { toast("Password minimal 6 karakter.", "error"); return; }
    setSaving(true);
    try {
      await apiPatch(`/team/${member.id}/password`, { password: pw });
      onDone();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Gagal reset password.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="t-h3" style={{ marginBottom: 6 }}>Reset Password</div>
        <div className="t-small" style={{ marginBottom: 16 }}>
          Ganti password untuk akun <b>{member.name}</b>
        </div>
        <form onSubmit={handleReset}>
          <div className="field">
            <label>Password baru</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Min 6 karakter"
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Nyimpen…" : "Simpan password baru"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Batal</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Manager hanya lihat tim, tidak bisa edit */
function ManagerTeamView() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<TeamMember[]>("/team").then(setTeam).finally(() => setLoading(false));
  }, []);

  return (
    <div className="card">
      <div className="card-title">
        <span>Anggota Tim</span>
        <span className="t-small" style={{ color: "var(--muted)", fontWeight: 500 }}>hanya admin yang bisa ubah akun</span>
      </div>
      {loading ? (
        <>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}</>
      ) : (
        team.map((member) => (
          <div className="team-row" key={member.id}>
            <div className="avatar" style={{ background: colorForName(member.name) }}>
              {initialsOf(member.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div className="team-name">{member.name}</div>
              <div className="team-email">{member.email}</div>
            </div>
            <span className={`role-pill role-${member.role}`}>{member.role}</span>
          </div>
        ))
      )}
    </div>
  );
}

function NewMemberForm({ onCreated, onError }: { onCreated: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("sales");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiPost("/team", { name, email, password, role });
      onCreated();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Gagal bikin akun.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="new-member-form" onSubmit={handleSubmit}>
      <div className="t-small" style={{ fontWeight: 700, marginBottom: 12, color: "var(--signal)" }}>
        Akun Baru
      </div>
      <div className="grid-3">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Nama lengkap</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Password awal</label>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 karakter" />
        </div>
      </div>
      <div className="field" style={{ marginTop: 14, maxWidth: 220 }}>
        <label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="sales">Sales</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? "Nyimpen…" : "Buat akun"}
        </button>
      </div>
    </form>
  );
}

function ToggleRow({
  label, sub, checked, onChange,
}: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="switch-row">
      <div>
        <div className="switch-label">{label}</div>
        <div className="switch-sub">{sub}</div>
      </div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="track"><div className="knob" /></div>
      </label>
    </div>
  );
}