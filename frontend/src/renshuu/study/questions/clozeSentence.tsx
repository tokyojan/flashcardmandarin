import { useMemo } from "react";
import type { QuestionProps } from "./types";
import { MCShell } from "./MCShell";
import { pickDistractors, shuffle } from "../engine";
import { MeaningMC } from "./meaningMC";

export function ClozeSentence(props: QuestionProps) {
  const { card, pool, onAnswer, showHint, onToggleHint } = props;
  const sentence = card.sentenceNative;
  if (!sentence || !sentence.includes(card.hanzi)) {
    return <MeaningMC {...props} />;
  }

  const options = useMemo(() => {
    const distractors = pickDistractors(pool.filter((c) => c.id !== card.id), card, 3, (c) => c.hanzi);
    return shuffle([card, ...distractors]).map((c) => ({ id: String(c.id), label: <span className="rs-hanzi-md">{c.hanzi}</span>, correct: c.id === card.id }));
  }, [card, pool]);

  const blanked = sentence.replace(card.hanzi, "____");

  return (
    <MCShell
      prompt={<span className="rs-cloze">{blanked}</span>}
      hint={card.sentenceEnglish ? <span>{card.sentenceEnglish}</span> : <span>{card.meaning}</span>}
      showHint={showHint}
      onToggleHint={onToggleHint}
      options={options}
      onChoose={onAnswer}
      feedback={<div>{sentence} — {card.sentenceEnglish ?? card.meaning}</div>}
    />
  );
}
