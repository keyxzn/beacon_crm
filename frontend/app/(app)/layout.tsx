"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

type AppCtx = { sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void };
export const AppContext = createContext<AppCtx>({ sidebarOpen: false, setSidebarOpen: () => {} });
export const useAppShell = () => useContext(AppContext);

// Route rules per role
const ADMIN_ALLOWED = ["/settings"];
// /team (menu Sales — buat manager ngatur beban kerja & reassign) SENGAJA gak dimasukin,
// itu emang cuma buat manager. Selain itu sales boleh akses semua halaman kerja hariannya.
// Sales cuma PIC di fase akuisisi (Pipeline/Lead) — begitu masuk fase implementasi/operasional
// (Project, Purchase, Inventory), itu tanggung jawab Project Manager/Ops, bukan Sales.
// /customers, /opportunities (daftar), /projects, /purchases, /inventory, /team semuanya
// Manager-only karena itu (Manager jadi surrogate role Ops, sistem cuma punya 3 role).
const SALES_ALLOWED = ["/dashboard", "/leads", "/pipeline", "/activities", "/reports", "/settings"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    // Admin hanya boleh akses /settings
    if (user.role === "admin") {
      const allowed = ADMIN_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) {
        router.replace("/settings");
      }
      return;
    }

    // Sales cuma boleh akses halaman-halaman ini (Reports udah discope ke data dia sendiri)
    if (user.role === "sales") {
      const allowed = SALES_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) {
        router.replace("/dashboard");
      }
      return;
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="login-stage">
        <div className="spinner" />
      </div>
    );
  }

  // Admin yang nyasar ke route non-settings jangan render dulu
  if (user.role === "admin") {
    const allowed = ADMIN_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"));
    if (!allowed) return null;
  }

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} />
      <div className="main">
        <AppContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
          {children}
        </AppContext.Provider>
      </div>
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}