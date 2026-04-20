import type { RenshuuContext } from "../RenshuuApp";
import { isDue } from "../../sm2";

export function UserCard({ ctx, userName }: { ctx: RenshuuContext; userName: string }) {
  const known = ctx.cards.filter((c) => !c.isNew && c.interval >= 21).length;
  const learning = ctx.cards.filter((c) => !c.isNew && c.interval < 21).length;
  const due = ctx.cards.filter((c) => isDue(c)).length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayReviews = ctx.stats.history[todayKey]?.reviews ?? 0;

  return (
    <section className="rs-card rs-user-card">
      <div className="rs-user-card-head">
        <div className="rs-user-avatar-lg">{userName.slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="rs-user-card-name">{userName}</div>
          <div className="rs-user-card-sub">My Mandarin</div>
        </div>
      </div>
      <div className="rs-stat-row">
        <Stat label="Known" value={known} tone="good" />
        <Stat label="Learning" value={learning} />
        <Stat label="Due" value={due} tone={due > 0 ? "warn" : undefined} />
        <Stat label="Today" value={todayReviews} tone="good" />
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" }) {
  return (
    <div className={"rs-stat" + (tone ? " rs-stat-" + tone : "")}>
      <div className="rs-stat-value">{value}</div>
      <div className="rs-stat-label">{label}</div>
    </div>
  );
}
