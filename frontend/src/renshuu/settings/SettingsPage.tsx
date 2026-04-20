import type { RenshuuContext } from "../RenshuuApp";
import type { RenshuuAccent, RenshuuQuestionType } from "../../types";
import { RENSHUU_QUESTION_TYPES } from "../../types";

const ACCENTS: { key: RenshuuAccent; label: string }[] = [
  { key: "teal", label: "Teal" },
  { key: "rose", label: "Rose" },
  { key: "indigo", label: "Indigo" },
  { key: "amber", label: "Amber" },
];

export function SettingsPage({ ctx }: { ctx: RenshuuContext }) {
  function toggle(t: RenshuuQuestionType) {
    const has = ctx.settings.defaultQuestionTypes.includes(t);
    const next = has
      ? ctx.settings.defaultQuestionTypes.filter((x) => x !== t)
      : [...ctx.settings.defaultQuestionTypes, t];
    if (next.length === 0) return;
    ctx.setSettings({ ...ctx.settings, defaultQuestionTypes: next });
  }

  function exportData() {
    const data = JSON.stringify({
      deck: ctx.cards, stats: ctx.stats,
      settings: ctx.classicSettings,
      renshuuSettings: ctx.settings,
      renshuuSchedules: ctx.schedules,
      exportDate: new Date().toISOString(),
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `renshuu-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data.deck)) ctx.setCards(() => data.deck);
      if (data.stats) ctx.setStats(data.stats);
      if (data.renshuuSettings) ctx.setSettings({ ...ctx.settings, ...data.renshuuSettings });
      if (Array.isArray(data.renshuuSchedules)) ctx.setSchedules(data.renshuuSchedules);
      alert("Import complete");
    } catch {
      alert("Import failed — invalid file");
    }
  }

  return (
    <div className="rs-page">
      <div className="rs-page-head"><h1>Settings</h1></div>

      <section className="rs-card rs-form">
        <div className="rs-card-title">Default question types</div>
        <div className="rs-qtype-grid">
          {RENSHUU_QUESTION_TYPES.map((qt) => (
            <label key={qt.key} className="rs-qtype-check">
              <input type="checkbox" checked={ctx.settings.defaultQuestionTypes.includes(qt.key)} onChange={() => toggle(qt.key)} />
              <span>{qt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rs-card rs-form">
        <div className="rs-card-title">Audio</div>
        <label>Rate ({ctx.settings.audioRate.toFixed(1)})
          <input type="range" min={0.5} max={1.2} step={0.1} value={ctx.settings.audioRate}
            onChange={(e) => ctx.setSettings({ ...ctx.settings, audioRate: Number(e.target.value) })} />
        </label>
      </section>

      <section className="rs-card rs-form">
        <div className="rs-card-title">Accent</div>
        <div className="rs-accent-row">
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              className={"rs-accent-swatch rs-accent-" + a.key + (ctx.settings.accent === a.key ? " rs-active" : "")}
              onClick={() => ctx.setSettings({ ...ctx.settings, accent: a.key })}
            >{a.label}</button>
          ))}
        </div>
      </section>

      <section className="rs-card rs-form">
        <div className="rs-card-title">Data</div>
        <div className="rs-btn-row">
          <button className="rs-btn" onClick={exportData}>Export backup</button>
          <label className="rs-btn">
            Import backup
            <input type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ""; }} />
          </label>
        </div>
      </section>
    </div>
  );
}
