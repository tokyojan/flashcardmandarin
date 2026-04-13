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
  example_sentence_native?: string;
  example_sentence_english?: string;
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
  sentenceNative?: string;
  sentenceEnglish?: string;
}

export type Grade = 0 | 3 | 4 | 5;

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_ORDER)[number];
export type CefrSelection = CefrLevel | "ALL";

export interface DayStats {
  reviews: number;
  correct: number;
  newLearned: number;
  charactersCorrect?: number;
  tonesCorrect?: number;
}

export interface StudyStats {
  history: Record<string, DayStats>;
  toneConfusions?: Record<string, number>;
}

export type DesignTheme =
  | "classic"
  | "ink"
  | "sakura"
  | "paper"
  | "minimal"
  | "brutalist"
  | "solarized"
  | "terminal"
  | "neon"
  | "aurora";

export const DESIGN_THEMES: { key: DesignTheme; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "ink", label: "Ink \u00b7 \u58a8" },
  { key: "sakura", label: "Sakura \u00b7 \u685c" },
  { key: "paper", label: "Paper" },
  { key: "minimal", label: "Minimal" },
  { key: "brutalist", label: "Brutalist" },
  { key: "solarized", label: "Solarized" },
  { key: "terminal", label: "Terminal" },
  { key: "neon", label: "Neon" },
  { key: "aurora", label: "Aurora" },
];

export type LayoutVariant =
  | "classic"
  | "focused"
  | "stack"
  | "split"
  | "sidebar"
  | "compact"
  | "magazine"
  | "zen"
  | "theater"
  | "immersive";

export const LAYOUT_VARIANTS: { key: LayoutVariant; label: string }[] = [
  { key: "classic", label: "Classic" },
  { key: "focused", label: "Focused" },
  { key: "stack", label: "Stack" },
  { key: "split", label: "Split" },
  { key: "sidebar", label: "Sidebar" },
  { key: "compact", label: "Compact" },
  { key: "magazine", label: "Magazine" },
  { key: "zen", label: "Zen" },
  { key: "theater", label: "Theater" },
  { key: "immersive", label: "Immersive" },
];

export interface Settings {
  cefrSel: CefrSelection;
  dailyNew: number;
  reversed: boolean;
  darkMode: "system" | "light" | "dark";
  mnemonicLangs: Record<MnemonicLang, boolean>;
  designTheme: DesignTheme;
  layoutVariant: LayoutVariant;
  productionMode: boolean;
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
