import type { Card, CardStatus } from "./types";

const today = () => new Date().toISOString().slice(0, 10);

const addDays = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function computeSm2(
  ease: number,
  interval: number,
  reps: number,
  lapses: number,
  q: number
) {
  const grade = Math.max(0, Math.min(5, q));
  ease = Math.max(
    1.3,
    ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  );

  if (grade < 3) {
    reps = 0;
    lapses += 1;
    interval = 1;
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ease);
  }

  return { ease, interval, reps, lapses };
}

export function scheduleSm2(card: Card, q: number): Card {
  const { ease, interval, reps, lapses } = computeSm2(
    card.ease,
    card.interval,
    card.reps,
    card.lapses,
    q
  );
  return { ...card, ease, interval, reps, lapses, due: addDays(interval), isNew: false };
}

export function previewInterval(card: Card, q: number): number {
  return computeSm2(card.ease, card.interval, card.reps, card.lapses, q).interval;
}

export function formatInterval(days: number): string {
  if (days < 1) return "<1d";
  if (days === 1) return "1d";
  if (days < 31) return `${days}d`;
  if (days < 365) {
    const mo = days / 30;
    return `${mo < 10 ? mo.toFixed(1) : Math.round(mo)}mo`;
  }
  const yr = days / 365;
  return `${yr < 10 ? yr.toFixed(1) : Math.round(yr)}yr`;
}

export function isDue(card: Card): boolean {
  return card.due <= today() && !card.isNew;
}

export function makeNewCard(
  id: number,
  hanzi: string,
  pinyin: string,
  meaning: string,
  cefr: string,
  pos: string,
  freq: number
): Card {
  return {
    id, hanzi, pinyin, meaning, cefr, pos, freq,
    ease: 2.5, interval: 0, reps: 0, lapses: 0, due: today(), isNew: true,
  };
}

export function getCardStatus(card: Card): CardStatus {
  if (card.isNew) return "new";
  if (card.interval < 7) return "learning";
  if (card.interval < 21) return "young";
  return "mature";
}
