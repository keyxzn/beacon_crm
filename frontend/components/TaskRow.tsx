"use client";

import { apiPost } from "@/lib/api";
import { colorForName, initialsOf } from "@/lib/colors";

export type Activity = {
  id: string;
  title: string;
  type: "call" | "email" | "meeting" | "internal";
  due_at: string;
  completed_at: string | null;
  lead_name?: string | null;
  assigned_to_name?: string | null;
};

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  call:     { label: "Call",     icon: "📞", color: "var(--signal)" },
  email:    { label: "Email",    icon: "✉️",  color: "var(--ai-1)" },
  meeting:  { label: "Meeting",  icon: "🤝", color: "var(--warning)" },
  internal: { label: "Internal", icon: "📋", color: "var(--muted)" },
};

function formatDue(dueAt: string, completed: boolean) {
  if (completed) return { text: "Selesai", type: "done" as const };

  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) {
    const lateDays = Math.max(1, Math.abs(diffDays));
    return { text: `Terlambat ${lateDays} hari`, type: "overdue" as const };
  }
  const time = due.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return { text: `Hari ini · ${time}`, type: "today" as const };
  if (diffDays === 1) return { text: `Besok · ${time}`, type: "upcoming" as const };
  return {
    text: due.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ` · ${time}`,
    type: "future" as const,
  };
}

export default function TaskRow({
  activity,
  onToggled,
  showMeta = true,
  showAssignee = false,
  checkboxOnly = false,
}: {
  activity: Activity;
  onToggled?: (updated: Activity) => void;
  showMeta?: boolean;
  showAssignee?: boolean;
  checkboxOnly?: boolean;
}) {
  const isOverdue = !activity.completed_at && new Date(activity.due_at) < new Date();
  const isDone = !!activity.completed_at;
  const due = formatDue(activity.due_at, isDone);
  const meta = TYPE_META[activity.type] || TYPE_META.internal;

  async function toggle() {
    try {
      const updated = await apiPost<Activity>(`/activities/${activity.id}/toggle`);
      onToggled?.(updated);
    } catch {}
  }

  // Mode khusus buat table — cuma render checkbox
  if (checkboxOnly) {
    return (
      <button
        className={`task-checkbox ${isDone ? "task-checkbox-done" : ""}`}
        onClick={toggle}
        aria-label="Tandai selesai"
        style={{ margin: "0 auto", display: "flex" }}
      >
        {isDone && <span>✓</span>}
      </button>
    );
  }

  return (
    <div
      className={`task-card ${isOverdue ? "task-overdue" : ""} ${isDone ? "task-done" : ""}`}
      style={{ "--tc": isDone ? "var(--success)" : isOverdue ? "var(--danger)" : meta.color } as React.CSSProperties}
    >
      <button
        className={`task-checkbox ${isDone ? "task-checkbox-done" : ""}`}
        onClick={toggle}
        aria-label="Tandai selesai"
      >
        {isDone && <span>✓</span>}
      </button>

      <div className="task-type-icon" style={{ background: isDone ? "var(--surface2)" : `${meta.color}18`, color: isDone ? "var(--muted)" : meta.color }}>
        {meta.icon}
      </div>

      <div className="task-body">
        <div className={`task-title-text ${isDone ? "task-title-done" : ""}`}>{activity.title}</div>
        {(showMeta || activity.lead_name) && (
          <div className="task-type-label" style={{ color: isDone ? "var(--muted)" : meta.color }}>
            {meta.label}{activity.lead_name ? ` · ${activity.lead_name}` : ""}
          </div>
        )}
      </div>

      {showAssignee && activity.assigned_to_name && (
        <div className="task-assignee" title={activity.assigned_to_name}>
          <div className="avatar" style={{ width: 22, height: 22, fontSize: 9, background: colorForName(activity.assigned_to_name) }}>
            {initialsOf(activity.assigned_to_name)}
          </div>
        </div>
      )}

      <div className={`task-due task-due-${due.type}`}>
        {due.type === "overdue" && <span className="task-due-dot" />}
        {due.text}
      </div>
    </div>
  );
}