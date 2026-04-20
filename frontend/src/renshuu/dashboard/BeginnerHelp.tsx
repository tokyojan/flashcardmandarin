import type { Route } from "../router";

export function BeginnerHelp({ navigate }: { navigate: (r: Route) => void }) {
  const tips = [
    { title: "Create a schedule", body: "Pick a CEFR level or build a custom list, then set how many new/review cards per day.", action: () => navigate({ name: "schedules" }) },
    { title: "Browse the vocab", body: "Search the full word list and add cards to a custom schedule.", action: () => navigate({ name: "vocab" }) },
    { title: "Tune your study", body: "Pick which question types you see during study in settings.", action: () => navigate({ name: "settings" }) },
  ];
  return (
    <section className="rs-card rs-help">
      <div className="rs-card-title">Getting started</div>
      <div className="rs-help-list">
        {tips.map((t, i) => (
          <button key={i} className="rs-help-item" onClick={t.action}>
            <div className="rs-help-num">{i + 1}</div>
            <div>
              <div className="rs-help-title">{t.title}</div>
              <div className="rs-help-body">{t.body}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
