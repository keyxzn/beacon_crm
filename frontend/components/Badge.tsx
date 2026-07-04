const LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  unqualified: "Unqualified",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}

export function AIBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge badge-ai">🤖 {children}</span>;
}
