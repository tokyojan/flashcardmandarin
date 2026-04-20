import { useMemo } from "react";
import type { QuestionProps } from "./types";
import { MCShell } from "./MCShell";
import { pickDistractors, shuffle } from "../engine";
import { speak } from "../../../lib/utils";

export function MeaningMC({ card, pool, onAnswer, showHint, onToggleHint }: QuestionProps) {
  const options = useMemo(() => {
    const samePool = pool.filter((c) => (c.cefr ?? "").toUpperCase() === (card.cefr ?? "").toUpperCase() && c.id !== card.id);
    const base = samePool.length >= 3 ? samePool : pool.filter((c) => c.id !== card.id);
    const distractors = pickDistractors(base, card, 3, (c) => c.meaning);
    return shuffle([card, ...distractors]).map((c) => ({ id: String(c.id), label: c.meaning, correct: c.id === card.id }));
  }, [card, pool]);

  return (
    <MCShell
      prompt={<span className="rs-hanzi-big">{card.hanzi}</span>}
      pos={card.pos}
      hint={<span>{card.pinyin}</span>}
      showHint={showHint}
      onToggleHint={onToggleHint}
      onPlay={() => speak(card.hanzi)}
      autoPlay
      options={options}
      onChoose={(correct, fast) => onAnswer(correct, fast)}
      feedback={<div><strong>{card.hanzi}</strong> · {card.pinyin} — {card.meaning}</div>}
    />
  );
}
