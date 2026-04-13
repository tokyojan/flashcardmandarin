import type { Card } from "../types";

export type Cloze = {
  before: string;
  blank: string;
  after: string;
  full: string;
  gloss: string;
  hasSentence: boolean;
};

/**
 * Build a cloze view of a card's example sentence with the target word blanked.
 * Falls back to a degenerate cloze (no surrounding context) when the sentence
 * is missing or doesn't contain the target word.
 */
export function buildCloze(card: Card): Cloze {
  const sentence = (card.sentenceNative ?? "").trim();
  const gloss = (card.sentenceEnglish ?? "").trim() || card.meaning;
  if (!sentence) {
    return { before: "", blank: card.hanzi, after: "", full: card.hanzi, gloss: card.meaning, hasSentence: false };
  }
  const idx = sentence.indexOf(card.hanzi);
  if (idx === -1) {
    return { before: "", blank: card.hanzi, after: "", full: sentence, gloss, hasSentence: false };
  }
  return {
    before: sentence.slice(0, idx),
    blank: card.hanzi,
    after: sentence.slice(idx + card.hanzi.length),
    full: sentence,
    gloss,
    hasSentence: true,
  };
}
