import type { Settings, StudyStats, DayStats, Card, PersistedSession, RenshuuSchedule, RenshuuSettings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  cefrSel: "A1",
  dailyNew: 5,
  reversed: false,
  darkMode: "system",
  mnemonicLangs: { english: true, italian: true },
  designTheme: "classic",
  layoutVariant: "classic",
  productionMode: false,
  appMode: "classic",
};

export const DEFAULT_RENSHUU_SETTINGS: RenshuuSettings = {
  defaultQuestionTypes: ["meaningMC", "readingMC", "audioMC", "recallType"],
  audioRate: 0.8,
  accent: "teal",
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

export interface RenshuuUserData {
  schedules: RenshuuSchedule[];
  settings: RenshuuSettings;
  dashboardLayout: string[] | null;
}

export async function loadRenshuuData(): Promise<RenshuuUserData> {
  const resp = await api("/api/user-data");
  if (!resp.ok) throw new Error("Failed to load renshuu data");
  const data = await resp.json();
  return {
    schedules: Array.isArray(data.renshuuSchedules) ? data.renshuuSchedules : [],
    settings: data.renshuuSettings
      ? { ...DEFAULT_RENSHUU_SETTINGS, ...data.renshuuSettings }
      : { ...DEFAULT_RENSHUU_SETTINGS },
    dashboardLayout: Array.isArray(data.renshuuDashboardLayout) ? data.renshuuDashboardLayout : null,
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

export interface ReviewExtras {
  charactersCorrect?: boolean;
  tonesCorrect?: boolean;
  /** Tone confusion entries recorded this review, e.g. ["3->1", "2->1"]. */
  toneConfusions?: string[];
}

export function recordReview(
  stats: StudyStats,
  correct: boolean,
  isNewCard: boolean,
  extras: ReviewExtras = {}
): StudyStats {
  const today = new Date().toISOString().slice(0, 10);
  const prev: DayStats = stats.history[today] ?? {
    reviews: 0,
    correct: 0,
    newLearned: 0,
  };
  const day: DayStats = { ...prev };
  day.reviews++;
  if (correct) day.correct++;
  if (isNewCard) day.newLearned++;
  if (extras.charactersCorrect !== undefined) {
    day.charactersCorrect = (day.charactersCorrect ?? 0) + (extras.charactersCorrect ? 1 : 0);
  }
  if (extras.tonesCorrect !== undefined) {
    day.tonesCorrect = (day.tonesCorrect ?? 0) + (extras.tonesCorrect ? 1 : 0);
  }

  const toneConfusions = { ...(stats.toneConfusions ?? {}) };
  for (const key of extras.toneConfusions ?? []) {
    toneConfusions[key] = (toneConfusions[key] ?? 0) + 1;
  }

  return {
    history: { ...stats.history, [today]: day },
    toneConfusions,
  };
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
