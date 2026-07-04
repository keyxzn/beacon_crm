"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet } from "@/lib/api";

type TeamMember = { id: string; name: string; email: string; role: string };
type LeadMini = { id: string };

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [sales, setSales] = useState<TeamMember[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [leadsExpanded, setLeadsExpanded] = useState(true);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isSales = user?.role === "sales";
  const onLeadsPage = pathname.startsWith("/leads");
  const currentTab = searchParams?.get("tab") || "active";

  // Nav items per role (Leads handled separately as expandable group)
  const getNavItems = () => {
    if (isAdmin) {
      return [{ href: "/settings", label: "Settings", icon: "⚙" }];
    }
    if (isManager) {
      return [
        { href: "/dashboard", label: "Dashboard", icon: "⌂" },
        { href: "/pipeline", label: "Pipeline", icon: "◧" },
        { href: "/activities", label: "Aktivitas", icon: "✓" },
        { href: "/reports", label: "Reports", icon: "▴" },
        { href: "/settings", label: "Settings", icon: "⚙" },
      ];
    }
    return [
      { href: "/dashboard", label: "Dashboard", icon: "⌂" },
      { href: "/pipeline", label: "Pipeline", icon: "◧" },
      { href: "/activities", label: "Aktivitas", icon: "✓" },
      { href: "/reports", label: "Reports", icon: "▴" },
      { href: "/settings", label: "Settings", icon: "⚙" },
    ];
  };

  const navItems = getNavItems();
  const settingsIndex = navItems.findIndex((i) => i.href === "/settings");
  const navBeforeSettings = settingsIndex >= 0 ? navItems.slice(0, settingsIndex) : navItems;
  const navSettings = settingsIndex >= 0 ? navItems.slice(settingsIndex) : [];

  useEffect(() => {
    if (!isManager) return;
    apiGet<TeamMember[]>("/team").then((team) => setSales(team.filter((m) => m.role === "sales")));
    apiGet<LeadMini[]>("/leads?approval_status=in_review").then((d) => setPendingCount(d.length));
  }, [isManager]);

  useEffect(() => {
    if (onLeadsPage) setLeadsExpanded(true);
  }, [onLeadsPage]);

  const initials = user?.name ? initialsOf(user.name) : "?";

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="fs-logo">
        <div className="logo-mark" />
        <span className="logo-word" style={{ fontSize: 15 }}>beacon</span>
      </div>

      {/* Role badge di bawah logo */}
      {isAdmin && (
        <div className="sidebar-role-banner sidebar-role-admin">
          <span>👑</span> Admin Panel
        </div>
      )}
      {isManager && (
        <div className="sidebar-role-banner sidebar-role-manager">
          <span>🎯</span> Manager View
        </div>
      )}
      {isSales && (
        <div className="sidebar-role-banner sidebar-role-sales">
          <span>⚡</span> Sales Dashboard
        </div>
      )}

      <nav className="fs-nav">
        {/* Dashboard (first item before Leads slot) */}
        {!isAdmin && navBeforeSettings.slice(0, 1).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`fs-link ${active ? "on" : ""}`}>
              <span className="ic">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Leads — expandable group */}
        {!isAdmin && (
          <div className="fs-group">
            <div
              className={`fs-link fs-link-parent ${onLeadsPage ? "on" : ""}`}
              onClick={() => setLeadsExpanded((v) => !v)}
              role="button"
              tabIndex={0}
            >
              <span className="ic">◎</span>
              <span style={{ flex: 1 }}>{isSales ? "Leads Saya" : "Leads"}</span>
              {isManager && pendingCount > 0 && <span className="sb-badge">{pendingCount}</span>}
              <span className={`fs-chevron ${leadsExpanded ? "fs-chevron-open" : ""}`}>›</span>
            </div>

            <div className={`fs-submenu ${leadsExpanded ? "fs-submenu-open" : ""}`}>
              <Link
                href="/leads?tab=active"
                className={`fs-sublink ${onLeadsPage && currentTab === "active" ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Lead Aktif
              </Link>

              {isSales && (
                <Link
                  href="/leads?tab=submissions"
                  className={`fs-sublink ${onLeadsPage && currentTab === "submissions" ? "on" : ""}`}
                >
                  <span className="fs-sub-dot" />
                  Submission Saya
                </Link>
              )}

              {isManager && (
                <Link
                  href="/leads?tab=review"
                  className={`fs-sublink fs-sublink-warn ${onLeadsPage && currentTab === "review" ? "on" : ""}`}
                >
                  <span className="fs-sub-dot fs-sub-dot-warn" />
                  Menunggu Review
                  {pendingCount > 0 && <span className="fs-sub-badge">{pendingCount}</span>}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Remaining items (Pipeline, Aktivitas, Reports) */}
        {!isAdmin && navBeforeSettings.slice(1).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`fs-link ${active ? "on" : ""}`}>
              <span className="ic">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}

        {/* Settings always last */}
        {navSettings.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} className={`fs-link ${active ? "on" : ""}`}>
              <span className="ic">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Tim Sales hanya untuk Manager */}
      {isManager && sales.length > 0 && (
        <div className="sb-team-section">
          <div className="sb-section-lbl">Tim Sales</div>
          {sales.map((s) => (
            <Link key={s.id} href={`/leads?owner=${s.id}`} className="sb-team-item">
              <div className="avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: colorForName(s.name) }}>
                {initialsOf(s.name)}
              </div>
              <span>{s.name}</span>
            </Link>
          ))}
        </div>
      )}

      {user && (
        <div className="fs-profile">
          <div className="avatar" style={{ background: isAdmin ? "var(--ai-1)" : isManager ? "var(--signal)" : "var(--warning)" }}>
            {initials}
          </div>
          <div>
            <b>{user.name}</b>
            <span
              className="sb-role-tag"
              style={
                isAdmin
                  ? { background: "var(--ai-grad)", color: "#fff" }
                  : isManager
                  ? { background: "var(--signal-soft)", color: "var(--signal)" }
                  : { background: "var(--warning-soft)", color: "var(--warning)" }
              }
            >
              {user.role}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}