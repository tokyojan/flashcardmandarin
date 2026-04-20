import { useEffect, useMemo, useState } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import type { Route } from "../router";
import type { Card, Grade, RenshuuQuestionType } from "../../types";
import { scheduleSm2 } from "../../sm2";
import { recordReview } from "../../storage";
import { buildScheduleSession } from "../schedule/helpers";
import { pickQuestionType, recordTypeOutcome, gradeFromCorrect } from "./engine";
import { MeaningMC } from "./questions/meaningMC";
import { ReadingMC } from "./questions/readingMC";
import { AudioMC } from "./questions/audioMC";
import { RecallType } from "./questions/recallType";
import { ClozeSentence } from "./questions/clozeSentence";
import { SentenceBuild } from "./questions/sentenceBuild";
import { ToneDrill } from "./questions/toneDrill";
import { ListeningSentence } from "./questions/listeningSentence";

interface Props {
  ctx: RenshuuContext;
  scheduleId: string;
  navigate: (r: Route) => void;
}

const RENDERERS: Record<RenshuuQuestionType, React.FC<any>> = {
  meaningMC: MeaningMC,
  readingMC: ReadingMC,
  audioMC: AudioMC,
  recallType: RecallType,
  clozeSentence: ClozeSentence,
  sentenceBuild: SentenceBuild,
  toneDrill: ToneDrill,
  listeningSentence: ListeningSentence,
};

export function StudyView({ ctx, scheduleId, navigate }: Props) {
  const schedule = useMemo(() => ctx.schedules.find((s) => s.id === scheduleId), [ctx.schedules, scheduleId]);

  const [queue, setQueue] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [typesSeen, setTypesSeen] = useState<Record<RenshuuQuestionType, { correct: number; total: number }>>({} as any);
  const [showHint, setShowHint] = useState(false);
  const [done, setDone] = useState(false);
  const [questionType, setQuestionType] = useState<RenshuuQuestionType | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!schedule) return;
    const q = buildScheduleSession(schedule, ctx.cards);
    setQueue(q);
    setIdx(0);
    setDone(q.length === 0);
  }, [schedule?.id]);

  const currentCard: Card | undefined = useMemo(
    () => (queue[idx] != null ? ctx.cards.find((c) => c.id === queue[idx]) : undefined),
    [queue, idx, ctx.cards]
  );

  useEffect(() => {
    if (!currentCard || !schedule) { setQuestionType(null); return; }
    const type = pickQuestionType(currentCard, schedule.questionTypes);
    setQuestionType(type);
    setShowHint(false);
  }, [currentCard?.id, schedule?.questionTypes.join(",")]);

  if (!schedule) {
    return (
      <div className="rs-page"><div className="rs-card">Schedule not found. <button className="rs-btn" onClick={() => navigate({ name: "schedules" })}>Back</button></div></div>
    );
  }

  if (done || queue.length === 0) {
    const accuracy = queue.length === 0 ? 0 : Math.round((correctCount / (idx || 1)) * 100);
    const byType = Object.entries(typesSeen) as [RenshuuQuestionType, { correct: number; total: number }][];
    return (
      <div className="rs-page rs-study-done">
        <div className="rs-card rs-done-card">
          <h1>Session complete</h1>
          <p>{correctCount} / {idx} correct ({accuracy}%)</p>
          {byType.length > 0 && (
            <div className="rs-done-types">
              {byType.map(([t, s]) => (
                <div key={t} className="rs-done-type-row">
                  <span>{t}</span>
                  <span>{s.correct}/{s.total}</span>
                </div>
              ))}
            </div>
          )}
          <div className="rs-btn-row">
            <button className="rs-btn" onClick={() => navigate({ name: "dashboard" })}>Dashboard</button>
            <button className="rs-btn rs-btn-primary" onClick={() => navigate({ name: "schedules" })}>More</button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard || !questionType) return <div className="rs-page"><div className="rs-loading">Preparing…</div></div>;
  const Renderer = RENDERERS[questionType];

  function onAnswer(correct: boolean, fast: boolean) {
    if (!currentCard || !questionType) return;
    const grade: Grade = gradeFromCorrect(correct, fast);
    const withType = recordTypeOutcome(currentCard, questionType, correct);
    const scheduled = scheduleSm2(withType, grade);

    let addBack: number[] = [];
    if (grade === 0) addBack = [currentCard.id];

    ctx.setCards((prev) => prev.map((c) => c.id === scheduled.id ? scheduled : c));
    const newStats = recordReview(ctx.stats, correct, currentCard.isNew);
    ctx.setStats(newStats);

    setTypesSeen((prev) => {
      const cur = prev[questionType] ?? { correct: 0, total: 0 };
      return { ...prev, [questionType]: { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 } };
    });
    if (correct) setCorrectCount((n) => n + 1);

    setQueue((q) => {
      const next = q.slice();
      if (addBack.length > 0) {
        const insertAt = Math.min(idx + 1 + 8, next.length);
        next.splice(insertAt, 0, ...addBack);
      }
      return next;
    });

    const next = idx + 1;
    if (next >= queue.length + addBack.length) setDone(true);
    else setIdx(next);
  }

  function skip() {
    if (!currentCard) return;
    onAnswer(false, false);
  }

  const totalWithReinserts = queue.length;

  return (
    <div className="rs-study">
      <div className="rs-study-bar">
        <span className="rs-study-progress">{idx + 1} of {totalWithReinserts}</span>
        <div className="rs-study-bar-fill" style={{ width: `${Math.round(((idx) / totalWithReinserts) * 100)}%` }} />
        <button className="rs-btn rs-btn-sm rs-skip" onClick={skip}>I don't know</button>
      </div>

      <div className="rs-study-stage">
        <Renderer
          card={currentCard}
          pool={ctx.cards}
          onAnswer={onAnswer}
          showHint={showHint}
          onToggleHint={() => setShowHint((v) => !v)}
          type={questionType}
        />
      </div>

      <div className="rs-study-foot">
        <button className="rs-link" onClick={() => navigate({ name: "dashboard" })}>End session</button>
      </div>
    </div>
  );
}
