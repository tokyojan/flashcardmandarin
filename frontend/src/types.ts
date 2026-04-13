export interface RawEntry {
  word: string;
  romanization: string;
  english_translation: string;
  cefr_level: string;
  pos: string;
  word_frequency: number | string;
  useful_for_flashcard: boolean;
  english?: string;
  italian?: string;
}

export type MnemonicLang = "english" | "italian";

export const SUPPORTED_LANGUAGES: { key: MnemonicLang; label: string }[] = [
  { key: "english", label: "English" },
  { key: "italian", label: "Italian" },
];

export interface Card {
  id: number;
  hanzi: string;
  pinyin: string;
  meaning: string;
  cefr: string;
  pos: string;
  freq: number;
  ease: number;
  interval: number;
  reps: number;
  lapses: number;
  due: string;
  isNew: boolean;
  mnemonicEnglish?: string;
  mnemonicItalian?: string;
}

export type Grade = 0 | 3 | 4 | 5;

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_ORDER)[number];
export type CefrSelection = CefrLevel | "ALL";

export interface DayStats {
  reviews: number;
  correct: number;
  newLearned: number;
}

export interface StudyStats {
  history: Record<string, DayStats>;
}

export interface Settings {
  cefrSel: CefrSelection;
  dailyNew: number;
  reversed: boolean;
  darkMode: "system" | "light" | "dark";
  mnemonicLangs: Record<MnemonicLang, boolean>;
}

export interface SessionGrades {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export type CardStatus = "new" | "learning" | "young" | "mature";

export interface PersistedSession {
  cardIds: number[];
  currentIdx: number;
  reviews: number;
  grades: SessionGrades;
  startTime: number;
  cefrSel: string;
}
