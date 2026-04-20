import type { Card, Grade, RenshuuQuestionType, RenshuuSchedule } from "../../types";

export interface QuestionPick {
  type: RenshuuQuestionType;
}

/**
 * Choose the next question type for a card. Bias toward types where
 * the card has the lowest accuracy among allowed types. Falls back to random.
 */
export function pickQuestionType(card: Card, allowed: RenshuuQuestionType[]): RenshuuQuestionType {
  if (allowed.length === 0) return "meaningMC";
  if (allowed.length === 1) return allowed[0];

  const stats = card.typeStats ?? {};
  let worst: RenshuuQuestionType | null = null;
  let worstScore = Infinity;
  for (const t of allowed) {
    const s = stats[t];
    const score = s && s.total >= 1 ? s.correct / s.total : 0.5;
    const jitter = Math.random() * 0.1;
    if (score - jitter < worstScore) { worstScore = score - jitter; worst = t; }
  }
  return worst ?? allowed[0];
}

export function recordTypeOutcome(card: Card, type: RenshuuQuestionType, correct: boolean): Card {
  const stats = { ...(card.typeStats ?? {}) } as NonNullable<Card["typeStats"]>;
  const prev = stats[type] ?? { correct: 0, total: 0 };
  stats[type] = { correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 };
  return { ...card, typeStats: stats };
}

export function gradeFromCorrect(correct: boolean, fast: boolean): Grade {
  if (!correct) return 0;
  return fast ? 5 : 4;
}

export function pickDistractors<T>(pool: T[], correct: T, n: number, key: (x: T) => string): T[] {
  const ck = key(correct);
  const candidates = pool.filter((x) => key(x) !== ck);
  const out: T[] = [];
  const used = new Set<string>([ck]);
  while (out.length < n && candidates.length > 0) {
    const i = Math.floor(Math.random() * candidates.length);
    const pick = candidates.splice(i, 1)[0];
    const k = key(pick);
    if (used.has(k)) continue;
    used.add(k);
    out.push(pick);
  }
  return out;
}

export function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function scheduleNeeds(s: RenshuuSchedule): boolean {
  return s.questionTypes.length > 0;
}
