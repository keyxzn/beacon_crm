export default function AIPanel({
  icon = "🤖",
  title,
  children,
}: {
  icon?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ai-panel">
      <div className="ai-panel-head">
        <span className="ping" />
        <span className="grad-text">{icon} {title}</span>
      </div>
      {children}
    </div>
  );
}

export function AIBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="ai-bullet">
      <span className="dot" />
      <span>{children}</span>
    </div>
  );
}
