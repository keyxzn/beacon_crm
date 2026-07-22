"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { colorForName, initialsOf } from "@/lib/colors";
import { apiGet } from "@/lib/api";

type TeamMember = { id: string; name: string; email: string; role: string };
type LeadMini = { id: string };
type PurchaseMini = { id: string };

export default function Sidebar({ open }: { open: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [sales, setSales] = useState<TeamMember[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingPurchaseCount, setPendingPurchaseCount] = useState(0);
  const [leadsExpanded, setLeadsExpanded] = useState(true);
  const [customerExpanded, setCustomerExpanded] = useState(false);
  const [oppExpanded, setOppExpanded] = useState(true);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [purchaseExpanded, setPurchaseExpanded] = useState(false);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isSales = user?.role === "sales";
  const onLeadsPage = pathname.startsWith("/leads");
  const onCustomerPage = pathname.startsWith("/customers");
  const onOppChainPage = pathname.startsWith("/opportunities") || pathname.startsWith("/pipeline") || pathname.startsWith("/projects");
  const onTeamPage = pathname.startsWith("/team");
  const onPurchasePage = pathname.startsWith("/purchases");
  const onPurchaseApprovalPage = onPurchasePage && searchParams?.get("status") === "submitted";
  const currentTab = searchParams?.get("tab") || "active";
  const customerFilter = searchParams?.get("filter") || "";
  const repParam = searchParams?.get("rep") || "";

  // Nav items per role (Leads, Customer, Opportunity handled separately as expandable groups)
  const getNavItems = () => {
    if (isAdmin) {
      return [{ href: "/settings", label: "Settings", icon: "⚙" }];
    }
    if (isManager) {
      return [
        { href: "/dashboard", label: "Dashboard", icon: "⌂" },
        { href: "/activities", label: "Aktivitas", icon: "✓" },
        { href: "/reports", label: "Reports", icon: "▴" },
        { href: "/settings", label: "Settings", icon: "⚙" },
      ];
    }
    // Sales sengaja gak dapet menu "Sales" (itu buat manager ngatur beban tim) —
    // ini juga yang bikin sidebar Sales & Manager beda struktur, bukan cuma beda label.
    return [
      { href: "/dashboard", label: "Dashboard", icon: "⌂" },
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
    apiGet<PurchaseMini[]>("/purchases?type=request&status=submitted").then((d) => setPendingPurchaseCount(d.length));
  }, [isManager]);

  useEffect(() => {
    if (onLeadsPage) setLeadsExpanded(true);
  }, [onLeadsPage]);

  useEffect(() => {
    if (onCustomerPage) setCustomerExpanded(true);
  }, [onCustomerPage]);

  useEffect(() => {
    if (onOppChainPage) setOppExpanded(true);
  }, [onOppChainPage]);

  useEffect(() => {
    if (onTeamPage) setSalesExpanded(true);
  }, [onTeamPage]);

  useEffect(() => {
    if (onPurchasePage) setPurchaseExpanded(true);
  }, [onPurchasePage]);

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

        {/* Customer — pihak yang ngasih lead. Bukan bagian dari brief Mas Firman buat Sales,
            jadi cuma dikasih ke Manager biar sidebar Sales tetep sesuai spek aslinya. */}
        {isManager && (
          <div className="fs-group">
            <div
              className={`fs-link fs-link-parent ${onCustomerPage ? "on" : ""}`}
              onClick={() => setCustomerExpanded((v) => !v)}
              role="button"
              tabIndex={0}
            >
              <span className="ic">▦</span>
              <span style={{ flex: 1 }}>Customer</span>
              <span className={`fs-chevron ${customerExpanded ? "fs-chevron-open" : ""}`}>›</span>
            </div>

            <div className={`fs-submenu ${customerExpanded ? "fs-submenu-open" : ""}`}>
              <Link
                href="/customers"
                className={`fs-sublink ${onCustomerPage && customerFilter === "" ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Semua Customer
              </Link>
              <Link
                href="/customers?filter=repeat"
                className={`fs-sublink ${onCustomerPage && customerFilter === "repeat" ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Repeat Customer
              </Link>
            </div>
          </div>
        )}

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

        {/* Opportunity — lead yang udah di-approve, jadi kerjaan beneran, LANGSUNG nyambung ke Pipeline
            (makanya digabung 1 grup — biar rantai Opportunity → Pipeline kebaca di navigasinya sendiri)
            Mas Firman cuma minta "pipeline-nya aja" buat Sales — jadi Opportunity/Project full-list
            cuma buat Manager, Sales dikasih akses langsung ke Pipeline doang. */}
        {isManager && (
          <div className="fs-group">
            <div
              className={`fs-link fs-link-parent ${onOppChainPage ? "on" : ""}`}
              onClick={() => setOppExpanded((v) => !v)}
              role="button"
              tabIndex={0}
            >
              <span className="ic">◆</span>
              <span style={{ flex: 1 }}>Opportunity</span>
              <span className={`fs-chevron ${oppExpanded ? "fs-chevron-open" : ""}`}>›</span>
            </div>

            <div className={`fs-submenu ${oppExpanded ? "fs-submenu-open" : ""}`}>
              <Link
                href="/opportunities"
                className={`fs-sublink ${pathname.startsWith("/opportunities") ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Daftar Opportunity
              </Link>
              <Link
                href="/pipeline"
                className={`fs-sublink ${pathname.startsWith("/pipeline") ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Pipeline (Kanban)
              </Link>
              <Link
                href="/projects"
                className={`fs-sublink ${pathname.startsWith("/projects") ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Project
              </Link>
            </div>
          </div>
        )}

        {isSales && (
          <Link href="/pipeline" className={`fs-link ${pathname.startsWith("/pipeline") ? "on" : ""}`}>
            <span className="ic">◧</span>
            Pipeline
          </Link>
        )}

        {/* Sales — cuma manager, expandable kayak Customer/Leads/Opportunity, sub-item-nya per anggota tim */}
        {isManager && (
          <div className="fs-group">
            <div
              className={`fs-link fs-link-parent ${onTeamPage ? "on" : ""}`}
              onClick={() => setSalesExpanded((v) => !v)}
              role="button"
              tabIndex={0}
            >
              <span className="ic">👥</span>
              <span style={{ flex: 1 }}>Sales</span>
              <span className={`fs-chevron ${salesExpanded ? "fs-chevron-open" : ""}`}>›</span>
            </div>

            <div className={`fs-submenu ${salesExpanded ? "fs-submenu-open" : ""}`}>
              <Link
                href="/team"
                className={`fs-sublink ${onTeamPage && repParam === "" ? "on" : ""}`}
              >
                <span className="fs-sub-dot" />
                Semua Sales
              </Link>
              {sales.map((s) => (
                <Link
                  key={s.id}
                  href={`/team?rep=${s.id}`}
                  className={`fs-sublink ${onTeamPage && repParam === s.id ? "on" : ""}`}
                >
                  <span className="fs-sub-dot" />
                  {s.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Purchase — di real-world CRM, PIC fase implementasi/operasional (Project/Purchase/Inventory)
            itu Project Manager/Ops, BUKAN Sales — Sales cuma PIC di fase akuisisi (Pipeline).
            Jadi ini balik ke Manager-only (manager jadi surrogate role Ops karena sistem cuma punya
            3 role: sales/manager/admin). */}
        {isManager && (
          <div className="fs-group">
            <div
              className={`fs-link fs-link-parent ${onPurchasePage ? "on" : ""}`}
              onClick={() => setPurchaseExpanded((v) => !v)}
              role="button"
              tabIndex={0}
            >
              <span className="ic">🧾</span>
              <span style={{ flex: 1 }}>Purchase</span>
              {isManager && pendingPurchaseCount > 0 && <span className="sb-badge">{pendingPurchaseCount}</span>}
              <span className={`fs-chevron ${purchaseExpanded ? "fs-chevron-open" : ""}`}>›</span>
            </div>

            <div className={`fs-submenu ${purchaseExpanded ? "fs-submenu-open" : ""}`}>
              <Link href="/purchases" className={`fs-sublink ${onPurchasePage && !onPurchaseApprovalPage ? "on" : ""}`}>
                <span className="fs-sub-dot" />
                Request / Order / Return
              </Link>

              <Link
                href="/purchases?type=request&status=submitted"
                className={`fs-sublink fs-sublink-warn ${onPurchaseApprovalPage ? "on" : ""}`}
              >
                <span className="fs-sub-dot fs-sub-dot-warn" />
                Menunggu Approval
                {pendingPurchaseCount > 0 && <span className="fs-sub-badge">{pendingPurchaseCount}</span>}
              </Link>
            </div>
          </div>
        )}

        {/* Inventory — sama alasannya kayak Purchase, ini kerjaan Ops bukan Sales */}
        {isManager && (
          <Link href="/inventory" className={`fs-link ${pathname.startsWith("/inventory") ? "on" : ""}`}>
            <span className="ic">🏬</span>
            Inventory
          </Link>
        )}

        {/* Remaining items (Aktivitas, Reports) */}
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