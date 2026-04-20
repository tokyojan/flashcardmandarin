import type { RenshuuContext } from "../RenshuuApp";

interface Challenge {
  id: string;
  label: string;
  target: number;
  progress: number;
}

export function DailyChallenges({ ctx }: { ctx: RenshuuContext }) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const day = ctx.stats.history[todayKey] ?? { reviews: 0, correct: 0, newLearned: 0 };

  const challenges: Challenge[] = [
    { id: "reviews", label: "Review 20 cards", target: 20, progress: day.reviews },
    { id: "new", label: "Learn 5 new words", target: 5, progress: day.newLearned },
    { id: "correct", label: "Get 15 correct", target: 15, progress: day.correct },
  ];

  return (
    <section className="rs-card rs-challenges">
      <div className="rs-card-title">Daily challenges</div>
      <div className="rs-challenge-list">
        {challenges.map((ch) => {
          const pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
          const done = ch.progress >= ch.target;
          return (
            <div key={ch.id} className={"rs-challenge" + (done ? " rs-done" : "")}>
              <div className="rs-challenge-label">
                <span>{ch.label}</span>
                <span className="rs-challenge-count">{Math.min(ch.progress, ch.target)} / {ch.target}</span>
              </div>
              <div className="rs-bar"><div className="rs-bar-fill" style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
