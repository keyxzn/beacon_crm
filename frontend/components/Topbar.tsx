"use client";

import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export default function Topbar({
  title,
  onMenuClick,
  rightSlot,
}: {
  title: string;
  onMenuClick: () => void;
  rightSlot?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const initials = user?.name
    ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button className="icon-btn hamburger" onClick={onMenuClick} style={btnReset}>
          ☰
        </button>
        <div className="t-h3">{title}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {rightSlot}
        <button
          onClick={toggleTheme}
          style={btnReset}
          title={theme === "dark" ? "Ganti ke light mode" : "Ganti ke dark mode"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
        <div
          className="avatar"
          style={{ background: "var(--ai-1)", cursor: "pointer" }}
          title={`${user?.name ?? ""} — klik buat logout`}
          onClick={logout}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}

const btnReset: React.CSSProperties = {
  background: "var(--surface)",
  border: "1.5px solid var(--border2)",
  borderRadius: 10,
  width: 38,
  height: 38,
  color: "var(--text)",
};