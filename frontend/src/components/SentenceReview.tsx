import { useEffect, useMemo, useState } from "react";
import type { Card, Grade, MnemonicLang } from "../types";
import { speak } from "../lib/utils";
import { buildCloze } from "../lib/sentence";
import { previewInterval, formatInterval } from "../sm2";
import { MnemonicList } from "./MnemonicList";

interface Props {
  card: Card;
  pool: Card[];
  sessionIdx: number;
  sessionLength: number;
  reviews: number;
  mnemonicLangs: Record<MnemonicLang, boolean>;
  canUndo: boolean;
  onSubmit: (grade: Grade) => void;
  onUndo: () => void;
  onCopyHanzi: () => void;
}

const GRADES: { q: Grade; label: string; cls: string }[] = [
  { q: 0, label: "Again", cls: "btn-again" },
  { q: 3, label: "Hard", cls: "btn-hard" },
  { q: 4, label: "Good", cls: "btn-good" },
  { q: 5, label: "Easy", cls: "btn-easy" },
];

function pickDistractors(target: Card, pool: Card[], n = 3): Card[] {
  const seen = new Set<string>([target.hanzi]);
  const viable = pool.filter((c) => c.id !== target.id && c.hanzi && !seen.has(c.hanzi));

  const scored = viable.map((c) => {
    let score = Math.random() * 0.15;
    if (c.cefr === target.cefr) score += 1.0;
    if (c.hanzi.length === target.hanzi.length) score += 0.5;
    if (c.pos === target.pos) score += 0.3;
    if (Math.abs(c.freq - target.freq) < 200) score += 0.2;
    return { card: c, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked: Card[] = [];
  for (const s of scored) {
    if (seen.has(s.card.hanzi)) continue;
    seen.add(s.card.hanzi);
    picked.push(s.card);
    if (picked.length >= n) break;
  }
  return picked;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "input" | "graded";

export function SentenceReview(p: Props) {
  const { card } = p;
  const cloze = useMemo(() => buildCloze(card), [card]);

  const choices = useMemo(() => {
    const distractors = pickDistractors(card, p.pool, 3);
    return shuffle([card, ...distractors]);
  }, [card, p.pool]);

  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("input");

  useEffect(() => {
    setPickedIdx(null);
    setPhase("input");
  }, [card.id]);

  const correctIdx = choices.findIndex((c) => c.id === card.id);
  const isCorrect = pickedIdx !== null && pickedIdx === correctIdx;
  const defaultGrade: Grade = pickedIdx === null ? 4 : isCorrect ? 4 : 0;

  const choose = (idx: number) => {
    if (phase !== "input") return;
    setPickedIdx(idx);
    setPhase("graded");
    // Speak the correct answer to reinforce the audio link
    speak(card.hanzi);
  };

  const confirm = (g: Grade) => p.onSubmit(g);

  // Keyboard: 1-4 picks during input, Space/Enter confirms default grade after
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (phase === "input") {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) {
          e.preventDefault();
          choose(n - 1);
        }
      } else {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          confirm(defaultGrade);
        } else {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= 4) {
            e.preventDefault();
            const g = GRADES[n - 1].q;
            confirm(g);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, defaultGrade]);

  return (
    <div className="sentence-review">
      <div className="sr-progress">
        Card {p.sessionIdx + 1} / {p.sessionLength} <span className="sr-dot">·</span> Reviewed: {p.reviews}
      </div>

      <div className="sr-card">
        <div className="sr-cloze">
          {cloze.hasSentence ? (
            <>
              <span className="sr-context">{cloze.before}</span>
              <span className={phase === "graded" ? "sr-target revealed" : "sr-target"}>
                {phase === "graded" ? cloze.blank : <span className="sr-blank">{"\u00a0\u00a0\u00a0\u00a0"}</span>}
              </span>
              <span className="sr-context">{cloze.after}</span>
            </>
          ) : (
            <span className={phase === "graded" ? "sr-target revealed" : "sr-target"}>
              {phase === "graded" ? card.hanzi : <span className="sr-blank">{"\u00a0\u00a0\u00a0"}</span>}
            </span>
          )}
        </div>
        <div className="sr-gloss">{cloze.gloss}</div>

        <div className="sr-choices">
          {choices.map((choice, idx) => {
            const isPicked = pickedIdx === idx;
            const isCorrectChoice = idx === correctIdx;
            const cls =
              phase === "graded"
                ? isCorrectChoice
                  ? "sr-choice sr-choice-correct"
                  : isPicked
                  ? "sr-choice sr-choice-wrong"
                  : "sr-choice sr-choice-dim"
                : "sr-choice";
            return (
              <button
                key={choice.id}
                className={cls}
                onClick={() => choose(idx)}
                disabled={phase === "graded"}
              >
                <span className="sr-choice-num">{idx + 1}</span>
                <span className="sr-choice-hanzi">{choice.hanzi}</span>
                {phase === "graded" && (
                  <span className="sr-choice-pinyin">{choice.pinyin}</span>
                )}
              </button>
            );
          })}
        </div>

        {phase === "graded" && (
          <div className="sr-feedback">
            <div className="sr-result-line">
              {isCorrect ? (
                <span className="sr-result-ok">{"\u2713"} {card.hanzi} {"\u2014"} {card.pinyin}</span>
              ) : (
                <span className="sr-result-bad">
                  {"\u2715"} answer: <strong>{card.hanzi}</strong> {"\u2014"} {card.pinyin}
                </span>
              )}
              <button className="btn-speak sr-speak" onClick={() => speak(card.hanzi)} title="Pronounce (P)">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
            </div>
            <MnemonicList card={card} langs={p.mnemonicLangs} />
            <div className="sr-meta">
              <span>{card.cefr || "?"}</span><span>·</span>
              <span>{card.pos}</span><span>·</span>
              <span>freq #{card.freq.toLocaleString()}</span>
              {card.isNew && <span className="badge-new">NEW</span>}
              {card.lapses >= 4 && <span className="badge-leech">LEECH</span>}
            </div>
          </div>
        )}
      </div>

      {phase === "graded" && (
        <div className="sr-grades">
          {GRADES.map(({ q, label, cls }, i) => (
            <button
              key={q}
              className={`btn-grade ${cls}${q === defaultGrade ? " sr-default" : ""}`}
              onClick={() => confirm(q)}
            >
              <span className="grade-label">{label}</span>
              <span className="grade-interval">{formatInterval(previewInterval(card, q))}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
          <div className="sr-confirm-hint">
            <kbd>Space</kbd> accepts <strong>{GRADES.find((g) => g.q === defaultGrade)?.label}</strong>
          </div>
        </div>
      )}

      <div className="sr-secondary">
        <button className="btn-icon" onClick={p.onCopyHanzi} title="Copy hanzi (C)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        {p.canUndo && (
          <button className="btn-icon" onClick={p.onUndo} title="Undo (Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
