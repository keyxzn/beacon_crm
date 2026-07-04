"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk, coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-stage">
      <div className="beacon-glow" />
      <div className="beacon-glow ring2" />

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginBottom: 36 }}>
          <div className="logo-mark" />
          <span className="logo-word">beacon</span>
        </div>

        <form className="card" onSubmit={handleSubmit}>
          <div style={{ fontFamily: "Sora, sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            Masuk ke akun tim
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 22 }}>
            Khusus anggota tim sales hubungi admin kalau belum punya akses.
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.id"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 6 }}>
            <label>Kata sandi</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-text">{error}</div>}

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: 14 }}
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "var(--muted)" }}>
          lihat sinyalnya duluan, menang duluan.
        </div>
      </div>
    </div>
  );
}