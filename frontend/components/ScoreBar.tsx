export default function ScoreBar({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) {
    return <span className="t-small">—</span>;
  }
  return (
    <div className="score-bar">
      <div className="score-track">
        <div className="score-fill" style={{ width: `${score}%` }} />
      </div>
      <div className="score-num">{score}</div>
    </div>
  );
}
