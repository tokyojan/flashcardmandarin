import { useMemo } from "react";
import type { QuestionProps } from "./types";
import { MCShell } from "./MCShell";
import { pickDistractors, shuffle } from "../engine";
import { speak } from "../../../lib/utils";
import { MeaningMC } from "./meaningMC";

export function ListeningSentence(props: QuestionProps) {
  const { card, pool, onAnswer, showHint, onToggleHint } = props;
  if (!card.sentenceNative || !card.sentenceEnglish) return <MeaningMC {...props} />;

  const withSentence = pool.filter((c) => c.sentenceEnglish && c.id !== card.id);
  const distractors = useMemo(
    () => pickDistractors(withSentence, card, 3, (c) => c.sentenceEnglish ?? String(c.id)),
    [card, withSentence]
  );
  const options = useMemo(
    () => shuffle([card, ...distractors]).map((c) => ({ id: String(c.id), label: c.sentenceEnglish!, correct: c.id === card.id })),
    [card, distractors]
  );

  return (
    <MCShell
      prompt={<span className="rs-audio-prompt">{"\u{1F50A}"}</span>}
      hint={<span>{card.sentenceNative}</span>}
      showHint={showHint}
      onToggleHint={onToggleHint}
      onPlay={() => speak(card.sentenceNative!)}
      autoPlay
      options={options}
      onChoose={onAnswer}
      feedback={<div>{card.sentenceNative} — {card.sentenceEnglish}</div>}
    />
  );
}
