import { useState, useMemo, useEffect, useRef } from "react";
import type { QuestionProps } from "./types";
import { shuffle } from "../engine";
import { MeaningMC } from "./meaningMC";

export function SentenceBuild(props: QuestionProps) {
  const { card, onAnswer, showHint, onToggleHint } = props;
  const sentence = card.sentenceNative;
  if (!sentence) return <MeaningMC {...props} />;

  const tokens = useMemo(() => Array.from(sentence), [sentence]);
  const [bank, setBank] = useState<{ ch: string; key: number }[]>(() =>
    shuffle(tokens.map((ch, i) => ({ ch, key: i })))
  );
  const [placed, setPlaced] = useState<{ ch: string; key: number }[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const start = useRef(Date.now());

  useEffect(() => {
    setBank(shuffle(tokens.map((ch, i) => ({ ch, key: i }))));
    setPlaced([]);
    setResult(null);
    start.current = Date.now();
  }, [card.id, sentence]);

  function place(t: { ch: string; key: number }) {
    if (result) return;
    setBank((b) => b.filter((x) => x.key !== t.key));
    setPlaced((p) => [...p, t]);
  }
  function unplace(t: { ch: string; key: number }) {
    if (result) return;
    setPlaced((p) => p.filter((x) => x.key !== t.key));
    setBank((b) => [...b, t]);
  }
  function submit() {
    if (result || placed.length !== tokens.length) return;
    const ok = placed.map((p) => p.ch).join("") === sentence;
    setResult(ok ? "correct" : "wrong");
    const fast = Date.now() - start.current < 10000;
    setTimeout(() => onAnswer(ok, fast), 900);
  }

  return (
    <div className="rs-q">
      <div className="rs-q-prompt">
        <div className="rs-q-target rs-q-small">{card.sentenceEnglish ?? card.meaning}</div>
        <button className="rs-hint-toggle" onClick={onToggleHint}>{showHint ? "(hide hint)" : "(show hint)"}</button>
        {showHint && <div className="rs-q-hint">{card.hanzi} — {card.pinyin}</div>}
      </div>

      <div className="rs-build-answer">
        {placed.map((t) => (
          <button key={t.key} className="rs-token" onClick={() => unplace(t)}>{t.ch}</button>
        ))}
        {placed.length === 0 && <span className="rs-muted">Tap tokens below to build the sentence</span>}
      </div>

      <div className="rs-build-bank">
        {bank.map((t) => (
          <button key={t.key} className="rs-token rs-token-bank" onClick={() => place(t)}>{t.ch}</button>
        ))}
      </div>

      <div className="rs-btn-row">
        <button className="rs-btn rs-btn-primary" disabled={!!result || placed.length !== tokens.length} onClick={submit}>Check</button>
      </div>

      {result && (
        <div className={"rs-q-feedback " + (result === "correct" ? "rs-correct-fb" : "rs-wrong-fb")}>
          <div>{sentence}</div>
          {card.sentenceEnglish && <div className="rs-muted">{card.sentenceEnglish}</div>}
        </div>
      )}
    </div>
  );
}
