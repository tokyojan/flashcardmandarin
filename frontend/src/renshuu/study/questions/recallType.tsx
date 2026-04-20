import { useState, useRef, useEffect } from "react";
import type { QuestionProps } from "./types";
import { evaluatePinyin, toneConfusionKey } from "../../../lib/pinyin";
import { speak } from "../../../lib/utils";

export function RecallType({ card, onAnswer, showHint, onToggleHint }: QuestionProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ReturnType<typeof evaluatePinyin> | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const start = useRef(Date.now());

  useEffect(() => { ref.current?.focus(); setInput(""); setResult(null); start.current = Date.now(); }, [card.id]);

  function submit() {
    if (result) return;
    const r = evaluatePinyin(input, card.pinyin);
    setResult(r);
    const fast = Date.now() - start.current < 6000;
    setTimeout(() => onAnswer(r.charactersCorrect && r.tonesCorrect, fast), 900);
  }

  const confusions: string[] = [];
  if (result) {
    for (const s of result.syllables) {
      if (s.baseCorrect && !s.toneCorrect && s.expected.tone && s.got.tone) {
        confusions.push(toneConfusionKey(s.expected.tone, s.got.tone));
      }
    }
  }

  return (
    <div className="rs-q">
      <div className="rs-q-prompt">
        <div className="rs-q-target"><span className="rs-meaning-prompt">{card.meaning}</span></div>
        <div className="rs-q-pos">(type the pinyin — use tone numbers, e.g. ni3 hao3)</div>
        <button className="rs-hint-toggle" onClick={onToggleHint}>{showHint ? "(hide hint)" : "(show hint)"}</button>
        {showHint && <div className="rs-q-hint">{card.hanzi}</div>}
      </div>
      <div className="rs-q-input-row">
        <input
          ref={ref}
          className="rs-q-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="pinyin with tone numbers"
          disabled={!!result}
        />
        <button className="rs-btn rs-btn-primary" onClick={submit} disabled={!!result || !input.trim()}>Check</button>
      </div>
      {result && (
        <div className={"rs-q-feedback " + (result.charactersCorrect && result.tonesCorrect ? "rs-correct-fb" : "rs-wrong-fb")}>
          <div><strong>{card.hanzi}</strong> · {card.pinyin} — {card.meaning}</div>
          {!result.charactersCorrect && <div className="rs-muted">Wrong syllables</div>}
          {result.charactersCorrect && !result.tonesCorrect && <div className="rs-muted">Tones off: {confusions.join(", ")}</div>}
          <button className="rs-icon-btn" onClick={() => speak(card.hanzi)}>{"\u25B6"}</button>
        </div>
      )}
    </div>
  );
}
