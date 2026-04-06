import type { Card, RawEntry, CefrSelection } from "./types";
import { CEFR_ORDER } from "./types";
import { makeNewCard, isDue } from "./sm2";

const MAX_WORDS = 5000;

function normalizePinyin(p: string): string {
  return (p ?? "").trim().replace(/\s+/g, " ");
}

export function buildDeckFromRaw(
  data: RawEntry[],
  cefrSelection: CefrSelection,
  onlyFlashcard = true
): Card[] {
  const sel = cefrSelection.toUpperCase() as CefrSelection;
  const filterByCefr = (CEFR_ORDER as readonly string[]).includes(sel);

  const sorted = [...data].sort((a, b) => {
    const fa = typeof a.word_frequency === "number" ? a.word_frequency : 1e9;
    const fb = typeof b.word_frequency === "number" ? b.word_frequency : 1e9;
    return fa - fb;
  });

  const seen = new Set<string>();
  const cards: Card[] = [];

  for (const row of sorted) {
    if (cards.length >= MAX_WORDS) break;
    if (onlyFlashcard && !row.useful_for_flashcard) continue;

    const lvl = (row.cefr_level ?? "").trim().toUpperCase();
    if (filterByCefr && lvl !== sel) continue;

    const hanzi = (row.word ?? "").trim();
    const pinyin = normalizePinyin(row.romanization);
    const meaning = (row.english_translation ?? "").trim().replace(/\s+/g, " ");
    const freq = typeof row.word_frequency === "number" ? row.word_frequency : 1e9;

    if (!hanzi || !pinyin || !meaning) continue;

    const key = `${hanzi}|${pinyin}`;
    if (seen.has(key)) continue;
    seen.add(key);

    cards.push(
      makeNewCard(cards.length + 1, hanzi, pinyin, meaning, lvl, (row.pos ?? "noun").trim().toLowerCase(), freq)
    );
  }

  return cards;
}

export function mergeDeckProgress(fresh: Card[], existing: Card[]): Card[] {
  const progressMap = new Map<string, Card>();
  for (const c of existing) {
    progressMap.set(`${c.hanzi}|${c.pinyin}`, c);
  }

  return fresh.map((c) => {
    const prev = progressMap.get(`${c.hanzi}|${c.pinyin}`);
    if (prev && !prev.isNew) {
      return {
        ...c,
        ease: prev.ease, interval: prev.interval, reps: prev.reps,
        lapses: prev.lapses, due: prev.due, isNew: false,
      };
    }
    return c;
  });
}

export function buildSession(cards: Card[], dailyNewLimit: number): number[] {
  const dueCards = cards
    .filter((c) => isDue(c))
    .sort((a, b) => a.freq - b.freq || a.id - b.id);

  const newCards = cards
    .filter((c) => c.isNew)
    .sort((a, b) => a.freq - b.freq || a.id - b.id)
    .slice(0, Math.max(0, dailyNewLimit));

  const session: number[] = [];
  let iD = 0;
  let iN = 0;

  while (iD < dueCards.length || iN < newCards.length) {
    for (let j = 0; j < 3 && iD < dueCards.length; j++) {
      session.push(dueCards[iD].id);
      iD++;
    }
    if (iN < newCards.length) {
      session.push(newCards[iN].id);
      iN++;
    }
  }

  return session;
}
