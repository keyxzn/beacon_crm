export default function EmptyState({
  icon, title, subtitle, action, compact = false,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
}) {
  return (
    <div className={`empty-card ${compact ? "empty-card-compact" : ""}`}>
      <div className="empty-card-icon">{icon}</div>
      <div className="empty-card-title">{title}</div>
      {subtitle && <div className="empty-card-subtitle">{subtitle}</div>}
      {action && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}