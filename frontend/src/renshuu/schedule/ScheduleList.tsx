import { useState } from "react";
import type { RenshuuSchedule } from "../../types";
import { CEFR_ORDER } from "../../types";
import type { RenshuuContext } from "../RenshuuApp";
import type { Route } from "../router";
import { cardsForSchedule, newScheduleId, scheduleCounts } from "./helpers";

interface Props {
  ctx: RenshuuContext;
  navigate: (r: Route) => void;
  onEdit: (id: string) => void;
}

export function ScheduleList({ ctx, navigate, onEdit }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"cefr" | "custom">("cefr");
  const [cefr, setCefr] = useState<string>("A1");

  function create() {
    const s: RenshuuSchedule = {
      id: newScheduleId(),
      name: name.trim() || (sourceType === "cefr" ? `${cefr} vocab` : "Custom list"),
      source: sourceType === "cefr" ? { type: "cefr", value: cefr } : { type: "custom", value: "custom" },
      enabled: true,
      newPerDay: 10,
      reviewsPerDay: 100,
      questionTypes: [...ctx.settings.defaultQuestionTypes],
      cardIds: sourceType === "custom" ? [] : undefined,
    };
    ctx.setSchedules([...ctx.schedules, s]);
    setCreating(false);
    setName("");
    onEdit(s.id);
  }

  function del(id: string) {
    if (!confirm("Delete this schedule?")) return;
    ctx.setSchedules(ctx.schedules.filter((s) => s.id !== id));
  }

  function toggleEnabled(id: string) {
    ctx.setSchedules(ctx.schedules.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }

  return (
    <div className="rs-page">
      <div className="rs-page-head">
        <h1>Mastery schedules</h1>
        <button className="rs-btn rs-btn-primary" onClick={() => setCreating(true)}>+ New schedule</button>
      </div>

      {creating && (
        <div className="rs-card rs-schedule-create">
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HSK1 core" /></label>
          <label>Source
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as "cefr" | "custom")}>
              <option value="cefr">CEFR level</option>
              <option value="custom">Custom list</option>
            </select>
          </label>
          {sourceType === "cefr" && (
            <label>Level
              <select value={cefr} onChange={(e) => setCefr(e.target.value)}>
                {CEFR_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          )}
          <div className="rs-schedule-create-actions">
            <button className="rs-btn" onClick={() => setCreating(false)}>Cancel</button>
            <button className="rs-btn rs-btn-primary" onClick={create}>Create</button>
          </div>
        </div>
      )}

      {ctx.schedules.length === 0 ? (
        <div className="rs-card rs-empty">No schedules yet.</div>
      ) : (
        <div className="rs-schedule-list">
          {ctx.schedules.map((s) => {
            const all = cardsForSchedule(s, ctx.cards);
            const c = scheduleCounts(all);
            const pct = all.length === 0 ? 0 : Math.round((c.known / all.length) * 100);
            return (
              <div key={s.id} className={"rs-card rs-schedule-row" + (s.enabled ? "" : " rs-disabled")}>
                <div className="rs-ring" style={{ "--pct": pct } as React.CSSProperties}><span>{pct}%</span></div>
                <div className="rs-schedule-meta">
                  <div className="rs-schedule-name">{s.name}</div>
                  <div className="rs-schedule-sub">
                    {s.source.type === "cefr" ? `CEFR ${s.source.value}` : "Custom"} · {all.length} terms · {c.new} new · {c.due} due
                  </div>
                  <div className="rs-schedule-sub">{s.newPerDay}/day new · {s.reviewsPerDay}/day reviews · {s.questionTypes.length} question types</div>
                </div>
                <div className="rs-schedule-actions">
                  <button className="rs-btn rs-btn-sm" onClick={() => toggleEnabled(s.id)}>{s.enabled ? "Disable" : "Enable"}</button>
                  <button className="rs-btn rs-btn-sm" onClick={() => onEdit(s.id)}>Edit</button>
                  <button className="rs-btn rs-btn-sm" onClick={() => del(s.id)}>Delete</button>
                  <button className="rs-btn rs-btn-sm rs-btn-primary" disabled={all.length === 0} onClick={() => navigate({ name: "study", scheduleId: s.id })}>Study</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
