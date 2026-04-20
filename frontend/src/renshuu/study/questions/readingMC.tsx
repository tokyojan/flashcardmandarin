import { useMemo } from "react";
import type { QuestionProps } from "./types";
import { MCShell } from "./MCShell";
import { pickDistractors, shuffle } from "../engine";
import { speak } from "../../../lib/utils";

export function ReadingMC({ card, pool, onAnswer, showHint, onToggleHint }: QuestionProps) {
  const options = useMemo(() => {
    const distractors = pickDistractors(pool.filter((c) => c.id !== card.id), card, 3, (c) => c.pinyin);
    return shuffle([card, ...distractors]).map((c) => ({ id: String(c.id), label: c.pinyin, correct: c.id === card.id }));
  }, [card, pool]);

  return (
    <MCShell
      prompt={<span className="rs-hanzi-big">{card.hanzi}</span>}
      pos={card.pos}
      hint={<span>{card.meaning}</span>}
      showHint={showHint}
      onToggleHint={onToggleHint}
      onPlay={() => speak(card.hanzi)}
      options={options}
      onChoose={onAnswer}
      feedback={<div><strong>{card.hanzi}</strong> · {card.pinyin} — {card.meaning}</div>}
    />
  );
}
