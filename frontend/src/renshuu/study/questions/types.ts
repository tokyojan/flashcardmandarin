import type { Card, RenshuuQuestionType } from "../../../types";

export interface QuestionProps {
  card: Card;
  pool: Card[];
  onAnswer: (correct: boolean, fast: boolean) => void;
  showHint: boolean;
  onToggleHint: () => void;
  type: RenshuuQuestionType;
}

export interface MCOption {
  id: string;
  label: React.ReactNode;
  correct: boolean;
}
