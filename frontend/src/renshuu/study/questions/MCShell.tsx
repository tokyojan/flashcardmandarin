import { useEffect, useRef, useState } from "react";
import type { MCOption } from "./types";

interface Props {
  prompt: React.ReactNode;
  pos?: string;
  hint?: React.ReactNode;
  showHint: boolean;
  onToggleHint: () => void;
  audioText?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  options: MCOption[];
  onChoose: (correct: boolean, fast: boolean) => void;
  feedback?: React.ReactNode;
}

export function MCShell({ prompt, pos, hint, showHint, onToggleHint, audioText, autoPlay, onPlay, options, onChoose, feedback }: Props) {
  void audioText;
  const [picked, setPicked] = useState<string | null>(null);
  const start = useRef(Date.now());

  useEffect(() => { if (autoPlay && onPlay) onPlay(); }, [autoPlay, onPlay]);
  useEffect(() => { start.current = Date.now(); setPicked(null); }, [prompt]);

  function pick(o: MCOption) {
    if (picked) return;
    setPicked(o.id);
    const fast = Date.now() - start.current < 3500;
    setTimeout(() => onChoose(o.correct, fast), 650);
  }

  return (
    <div className="rs-q">
      <div className="rs-q-prompt">
        <div className="rs-q-target">{prompt}</div>
        {pos && <div className="rs-q-pos">({pos})</div>}
        {onPlay && <button className="rs-icon-btn rs-play" onClick={onPlay} title="Play audio">{"\u25B6"}</button>}
        <button className="rs-hint-toggle" onClick={onToggleHint}>{showHint ? "(hide hint)" : "(show hint)"}</button>
        {showHint && hint && <div className="rs-q-hint">{hint}</div>}
      </div>

      <div className="rs-q-options">
        {options.map((o, i) => {
          let cls = "rs-q-opt";
          if (picked) {
            if (o.correct) cls += " rs-correct";
            else if (o.id === picked) cls += " rs-wrong";
            else cls += " rs-dim";
          }
          return (
            <button key={o.id} className={cls} onClick={() => pick(o)} disabled={!!picked}>
              <span className="rs-q-opt-num">{i + 1}</span>
              <span className="rs-q-opt-label">{o.label}</span>
            </button>
          );
        })}
      </div>

      {picked && feedback && <div className="rs-q-feedback">{feedback}</div>}
    </div>
  );
}
