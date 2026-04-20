import type { Card, RenshuuSchedule } from "../../types";
import { isDue } from "../../sm2";

export function cardsForSchedule(s: RenshuuSchedule, all: Card[]): Card[] {
  if (s.source.type === "custom") {
    const ids = new Set(s.cardIds ?? []);
    return all.filter((c) => ids.has(c.id));
  }
  const lvl = s.source.value.toUpperCase();
  return all.filter((c) => (c.cefr ?? "").toUpperCase() === lvl);
}

export interface ScheduleCounts {
  total: number;
  new: number;
  learning: number;
  known: number;
  due: number;
}

export function scheduleCounts(cards: Card[]): ScheduleCounts {
  let n = 0, learning = 0, known = 0, due = 0;
  for (const c of cards) {
    if (c.isNew) n++;
    else if (c.interval >= 21) known++;
    else learning++;
    if (isDue(c)) due++;
  }
  return { total: cards.length, new: n, learning, known, due };
}

export function buildScheduleSession(s: RenshuuSchedule, cards: Card[]): number[] {
  const pool = cardsForSchedule(s, cards);
  const due = pool.filter((c) => isDue(c)).sort((a, b) => a.freq - b.freq || a.id - b.id).slice(0, Math.max(0, s.reviewsPerDay));
  const fresh = pool.filter((c) => c.isNew).sort((a, b) => a.freq - b.freq || a.id - b.id).slice(0, Math.max(0, s.newPerDay));

  const out: number[] = [];
  let i = 0, j = 0;
  while (i < due.length || j < fresh.length) {
    for (let k = 0; k < 3 && i < due.length; k++) out.push(due[i++].id);
    if (j < fresh.length) out.push(fresh[j++].id);
  }
  return out;
}

export function newScheduleId(): string {
  return "s_" + Math.random().toString(36).slice(2, 10);
}
