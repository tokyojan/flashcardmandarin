import type { Card, Grade } from "../types";
import { previewInterval, formatInterval } from "../sm2";

interface Props {
  card: Card;
  revealed: boolean;
  sessionIdx: number;
  sessionLength: number;
  reviews: number;
  canUndo: boolean;
  onReveal: () => void;
  onGrade: (q: Grade) => void;
  onCopyHanzi: () => void;
  onUndo: () => void;
}

const GRADES: { q: Grade; label: string; cls: string }[] = [
  { q: 0, label: "Again", cls: "btn-again" },
  { q: 3, label: "Hard", cls: "btn-hard" },
  { q: 4, label: "Good", cls: "btn-good" },
  { q: 5, label: "Easy", cls: "btn-easy" },
];

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

export function ReviewControls(p: Props) {
  return (
    <div className="controls">
      <div className="progress-text">{p.sessionIdx + 1} / {p.sessionLength} &middot; Reviewed: {p.reviews}</div>
      {!p.revealed ? (
        <button className="btn-reveal" onClick={p.onReveal}>Reveal <kbd>Space</kbd></button>
      ) : (
        <div className="grade-buttons">
          {GRADES.map(({ q, label, cls }, i) => (
            <button key={q} className={`btn-grade ${cls}`} onClick={() => p.onGrade(q)}>
              <span className="grade-label">{label}</span>
              <span className="grade-interval">{formatInterval(previewInterval(p.card, q))}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      )}
      <div className="secondary-actions">
        <button className="btn-icon" onClick={p.onCopyHanzi} title="Copy hanzi (C)">
          <CopyIcon />
        </button>
        {p.canUndo && (
          <button className="btn-icon" onClick={p.onUndo} title="Undo (Z)">
            <UndoIcon />
          </button>
        )}
      </div>
    </div>
  );
}
