import { useMemo, useState } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import type { RenshuuQuestionType } from "../../types";
import { RENSHUU_QUESTION_TYPES } from "../../types";
import { CustomListEditor } from "./CustomListEditor";

export function ScheduleEditor({ ctx, scheduleId, onClose }: { ctx: RenshuuContext; scheduleId: string; onClose: () => void }) {
  const s = useMemo(() => ctx.schedules.find((x) => x.id === scheduleId), [ctx.schedules, scheduleId]);
  const [tab, setTab] = useState<"settings" | "cards">("settings");

  if (!s) return <div className="rs-page"><button className="rs-btn" onClick={onClose}>Back</button><p>Schedule not found.</p></div>;

  function update(patch: Partial<typeof s>) {
    ctx.setSchedules(ctx.schedules.map((x) => x.id === scheduleId ? { ...x, ...patch } : x));
  }

  function toggleType(t: RenshuuQuestionType) {
    const has = s!.questionTypes.includes(t);
    const next = has ? s!.questionTypes.filter((x) => x !== t) : [...s!.questionTypes, t];
    if (next.length === 0) return;
    update({ questionTypes: next });
  }

  return (
    <div className="rs-page">
      <div className="rs-page-head">
        <button className="rs-btn" onClick={onClose}>{"\u2190"} Back</button>
        <h1>{s.name}</h1>
      </div>

      {s.source.type === "custom" && (
        <div className="rs-tabs">
          <button className={tab === "settings" ? "rs-active" : ""} onClick={() => setTab("settings")}>Settings</button>
          <button className={tab === "cards" ? "rs-active" : ""} onClick={() => setTab("cards")}>Cards ({s.cardIds?.length ?? 0})</button>
        </div>
      )}

      {tab === "settings" ? (
        <div className="rs-card rs-form">
          <label>Name<input value={s.name} onChange={(e) => update({ name: e.target.value })} /></label>
          <div className="rs-form-row">
            <label>New per day<input type="number" min={0} max={500} value={s.newPerDay} onChange={(e) => update({ newPerDay: Math.max(0, Number(e.target.value)) })} /></label>
            <label>Reviews per day<input type="number" min={0} max={1000} value={s.reviewsPerDay} onChange={(e) => update({ reviewsPerDay: Math.max(0, Number(e.target.value)) })} /></label>
          </div>
          <div>
            <div className="rs-form-label">Question types</div>
            <div className="rs-qtype-grid">
              {RENSHUU_QUESTION_TYPES.map((qt) => (
                <label key={qt.key} className="rs-qtype-check">
                  <input type="checkbox" checked={s.questionTypes.includes(qt.key)} onChange={() => toggleType(qt.key)} />
                  <span>{qt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <CustomListEditor ctx={ctx} schedule={s} update={update} />
      )}
    </div>
  );
}
