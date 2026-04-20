import type { RenshuuContext } from "../RenshuuApp";
import { getStreak, getReviewHistory } from "../../storage";

export function Streak({ ctx }: { ctx: RenshuuContext }) {
  const streak = getStreak(ctx.stats);
  const history = getReviewHistory(ctx.stats, 30);
  const max = Math.max(1, ...history.map((h) => h.reviews));

  return (
    <section className="rs-card rs-streak-card">
      <div className="rs-card-title">Streak</div>
      <div className="rs-streak-big">
        <span className="rs-streak-num">{streak}</span>
        <span className="rs-streak-unit">day{streak === 1 ? "" : "s"}</span>
        <span className="rs-streak-flame">{"\u{1F525}"}</span>
      </div>
      <div className="rs-heatmap" title="Reviews per day (last 30)">
        {history.map((h) => {
          const lvl = h.reviews === 0 ? 0 : Math.min(4, Math.ceil((h.reviews / max) * 4));
          return <div key={h.date} className={`rs-heat rs-heat-${lvl}`} title={`${h.date}: ${h.reviews}`} />;
        })}
      </div>
    </section>
  );
}
