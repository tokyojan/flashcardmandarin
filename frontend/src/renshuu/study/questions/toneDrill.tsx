import { useState, useEffect, useMemo, useRef } from "react";
import type { QuestionProps } from "./types";
import { parseDiacriticPinyin } from "../../../lib/pinyin";
import { speak } from "../../../lib/utils";

const TONES = [1, 2, 3, 4, 5];
const TONE_LABEL = ["", "\u0101", "\u00e1", "\u01ce", "\u00e0", "a"]; // 1..4, 5=neutral

export function ToneDrill({ card, onAnswer, showHint, onToggleHint }: QuestionProps) {
  const target = useMemo(() => parseDiacriticPinyin(card.pinyin), [card.pinyin]);
  const [picked, setPicked] = useState<number[]>(() => Array(target.length).fill(0));
  const [submitted, setSubmitted] = useState(false);
  const start = useRef(Date.now());

  useEffect(() => { setPicked(Array(target.length).fill(0)); setSubmitted(false); start.current = Date.now(); speak(card.hanzi); }, [card.id, target.length]);

  function setAt(i: number, tone: number) {
    if (submitted) return;
    setPicked((p) => { const n = p.slice(); n[i] = tone; return n; });
  }
  function submit() {
    if (submitted) return;
    const ok = picked.every((t, i) => t === target[i].tone);
    setSubmitted(true);
    const fast = Date.now() - start.current < 8000;
    setTimeout(() => onAnswer(ok, fast), 900);
  }

  return (
    <div className="rs-q">
      <div className="rs-q-prompt">
        <div className="rs-q-target"><span className="rs-hanzi-big">{card.hanzi}</span></div>
        <div className="rs-q-pos">mark the tones</div>
        <button className="rs-icon-btn rs-play" onClick={() => speak(card.hanzi)}>{"\u25B6"}</button>
        <button className="rs-hint-toggle" onClick={onToggleHint}>{showHint ? "(hide hint)" : "(show hint)"}</button>
        {showHint && <div className="rs-q-hint">{card.meaning}</div>}
      </div>

      <div className="rs-tone-row">
        {target.map((syl, i) => (
          <div key={i} className="rs-tone-syl">
            <div className="rs-tone-base">{syl.base}</div>
            <div className="rs-tone-buttons">
              {TONES.map((t) => {
                const isPicked = picked[i] === t;
                const isRight = submitted && target[i].tone === t;
                const isWrong = submitted && isPicked && target[i].tone !== t;
                let cls = "rs-tone-btn";
                if (isRight) cls += " rs-correct";
                else if (isWrong) cls += " rs-wrong";
                else if (isPicked) cls += " rs-picked";
                return <button key={t} className={cls} onClick={() => setAt(i, t)}>{t === 5 ? "·" : TONE_LABEL[t]}</button>;
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rs-btn-row">
        <button className="rs-btn rs-btn-primary" disabled={submitted || picked.some((p) => p === 0)} onClick={submit}>Check</button>
      </div>

      {submitted && (
        <div className="rs-q-feedback">
          <div><strong>{card.hanzi}</strong> · {card.pinyin} — {card.meaning}</div>
        </div>
      )}
    </div>
  );
}
