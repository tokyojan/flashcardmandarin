import { useMemo } from "react";
import type { QuestionProps } from "./types";
import { MCShell } from "./MCShell";
import { pickDistractors, shuffle } from "../engine";
import { speak } from "../../../lib/utils";

export function AudioMC({ card, pool, onAnswer, showHint, onToggleHint }: QuestionProps) {
  const options = useMemo(() => {
    const distractors = pickDistractors(pool.filter((c) => c.id !== card.id), card, 3, (c) => c.hanzi);
    return shuffle([card, ...distractors]).map((c) => ({ id: String(c.id), label: <span className="rs-hanzi-md">{c.hanzi}</span>, correct: c.id === card.id }));
  }, [card, pool]);

  return (
    <MCShell
      prompt={<span className="rs-audio-prompt">{"\u{1F50A}"}</span>}
      hint={<span>{card.pinyin} — {card.meaning}</span>}
      showHint={showHint}
      onToggleHint={onToggleHint}
      onPlay={() => speak(card.hanzi)}
      autoPlay
      options={options}
      onChoose={onAnswer}
      feedback={<div><strong>{card.hanzi}</strong> · {card.pinyin} — {card.meaning}</div>}
    />
  );
}
