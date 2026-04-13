import type { Settings, StudyStats, DayStats, Card, PersistedSession } from "./types";

const DEFAULT_SETTINGS: Settings = {
  cefrSel: "A1",
  dailyNew: 5,
  reversed: false,
  darkMode: "system",
  mnemonicLangs: { english: true, italian: true },
  designTheme: "classic",
  layoutVariant: "classic",
};

// --- API helpers ---

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { credentials: "include", ...opts });

export interface UserData {
  deck: Card[] | null;
  settings: Settings;
  stats: StudyStats;
  session: PersistedSession | null;
}

export async function loadAllUserData(): Promise<UserData> {
  const resp = await api("/api/user-data");
  if (!resp.ok) throw new Error("Failed to load user data");
  const data = await resp.json();
  return {
    deck: data.deck ?? null,
    settings: data.settings
      ? { ...DEFAULT_SETTINGS, ...data.settings }
      : { ...DEFAULT_SETTINGS },
    stats: data.stats ?? { history: {} },
    session: data.session ?? null,
  };
}

export async function saveUserData(key: string, data: unknown): Promise<void> {
  await api(`/api/user-data/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteUserData(key: string): Promise<void> {
  await api(`/api/user-data/${key}`, { method: "DELETE" });
}

// --- Pure functions (operate on already-loaded data) ---

export function recordReview(
  stats: StudyStats,
  correct: boolean,
  isNewCard: boolean
): StudyStats {
  const today = new Date().toISOString().slice(0, 10);
  const prev: DayStats = stats.history[today] ?? {
    reviews: 0,
    correct: 0,
    newLearned: 0,
  };
  const day = { ...prev };
  day.reviews++;
  if (correct) day.correct++;
  if (isNewCard) day.newLearned++;
  return { history: { ...stats.history, [today]: day } };
}

export function getStreak(stats: StudyStats): number {
  const date = new Date();
  let streak = 0;

  const todayKey = date.toISOString().slice(0, 10);
  if (stats.history[todayKey]?.reviews > 0) {
    streak = 1;
    date.setDate(date.getDate() - 1);
  } else {
    date.setDate(date.getDate() - 1);
  }

  while (stats.history[date.toISOString().slice(0, 10)]?.reviews > 0) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

export function getRetention(stats: StudyStats, days: number): number {
  let totalReviews = 0;
  let totalCorrect = 0;
  const d = new Date();

  for (let i = 0; i < days; i++) {
    const k = d.toISOString().slice(0, 10);
    const day = stats.history[k];
    if (day) {
      totalReviews += day.reviews;
      totalCorrect += day.correct;
    }
    d.setDate(d.getDate() - 1);
  }

  return totalReviews > 0
    ? Math.round((totalCorrect / totalReviews) * 100)
    : 0;
}

export function getReviewHistory(
  stats: StudyStats,
  days: number
): { date: string; reviews: number }[] {
  const result: { date: string; reviews: number }[] = [];
  const d = new Date();
  d.setDate(d.getDate() - days + 1);

  for (let i = 0; i < days; i++) {
    const k = d.toISOString().slice(0, 10);
    result.push({ date: k, reviews: stats.history[k]?.reviews ?? 0 });
    d.setDate(d.getDate() + 1);
  }

  return result;
}

// --- Export / Import (use current state, not API) ---

export function importAllData(json: string): {
  deck: Card[] | null;
  stats: StudyStats | null;
  settings: Settings | null;
} {
  const data = JSON.parse(json);
  return {
    deck: data.deck ?? null,
    stats: data.stats ?? null,
    settings: data.settings ?? null,
  };
}
