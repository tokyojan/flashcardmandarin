import type { SessionGrades } from "../types";
import { formatDuration } from "../lib/utils";

interface Props {
  grades: SessionGrades;
  durationMs: number;
  onRebuildSession: () => void;
}

export function DoneScreen({ grades, durationMs, onRebuildSession }: Props) {
  const sessionTotal = grades.again + grades.hard + grades.good + grades.easy;
  const accuracy = sessionTotal > 0
    ? Math.round(((grades.good + grades.easy) / sessionTotal) * 100)
    : 0;

  return (
    <div className="done-screen">
      <div className="done-icon">&#127881;</div>
      <h2>Session Complete!</h2>
      {sessionTotal > 0 && (
        <div className="done-stats">
          <p>Reviewed <strong>{sessionTotal}</strong> card{sessionTotal !== 1 ? "s" : ""} in <strong>{formatDuration(durationMs)}</strong></p>
          <div className="done-breakdown">
            <span className="grade-again">Again: {grades.again}</span>
            <span className="grade-hard">Hard: {grades.hard}</span>
            <span className="grade-good">Good: {grades.good}</span>
            <span className="grade-easy">Easy: {grades.easy}</span>
          </div>
          <p className="done-accuracy">Accuracy: <strong>{accuracy}%</strong></p>
        </div>
      )}
      <button className="btn-primary" onClick={onRebuildSession}>Start New Session</button>
    </div>
  );
}
