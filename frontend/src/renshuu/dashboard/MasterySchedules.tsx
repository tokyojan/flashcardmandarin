import type { RenshuuContext } from "../RenshuuApp";
import type { Route } from "../router";
import { cardsForSchedule, scheduleCounts } from "../schedule/helpers";

export function MasterySchedules({ ctx, navigate }: { ctx: RenshuuContext; navigate: (r: Route) => void }) {
  const items = ctx.schedules.filter((s) => s.enabled);

  return (
    <section className="rs-card rs-schedules">
      <div className="rs-card-title-row">
        <span className="rs-card-title">Mastery schedules</span>
        <button className="rs-link" onClick={() => navigate({ name: "schedules" })}>Manage</button>
      </div>
      {items.length === 0 ? (
        <div className="rs-empty">
          <p>No schedules yet. Create one to start studying.</p>
          <button className="rs-btn rs-btn-primary" onClick={() => navigate({ name: "schedules" })}>Create schedule</button>
        </div>
      ) : (
        <div className="rs-schedule-row">
          {items.map((s) => {
            const all = cardsForSchedule(s, ctx.cards);
            const c = scheduleCounts(all);
            const pct = all.length === 0 ? 0 : Math.round((c.known / all.length) * 100);
            return (
              <div key={s.id} className="rs-schedule-tile">
                <div className="rs-ring" style={{ "--pct": pct } as React.CSSProperties}>
                  <span>{pct}%</span>
                </div>
                <div className="rs-schedule-tile-name">{s.name}</div>
                <div className="rs-schedule-tile-sub">{all.length} terms · {c.due} due</div>
                <button className="rs-btn rs-btn-primary rs-btn-sm" onClick={() => navigate({ name: "study", scheduleId: s.id })}>Study</button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
