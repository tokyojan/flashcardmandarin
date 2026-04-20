import { useMemo, useState } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import type { Card } from "../../types";
import { CEFR_ORDER } from "../../types";
import { isDue } from "../../sm2";
import { speak } from "../../lib/utils";

type Filter = "all" | "new" | "learning" | "known" | "due";

export function VocabList({ ctx }: { ctx: RenshuuContext }) {
  const [q, setQ] = useState("");
  const [cefr, setCefr] = useState<string>("ALL");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Card | null>(null);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return ctx.cards.filter((c) => {
      if (cefr !== "ALL" && (c.cefr ?? "").toUpperCase() !== cefr) return false;
      if (filter === "new" && !c.isNew) return false;
      if (filter === "learning" && (c.isNew || c.interval >= 21)) return false;
      if (filter === "known" && (c.isNew || c.interval < 21)) return false;
      if (filter === "due" && !isDue(c)) return false;
      if (ql && !c.hanzi.includes(ql) && !c.pinyin.toLowerCase().includes(ql) && !c.meaning.toLowerCase().includes(ql)) return false;
      return true;
    }).slice(0, 500);
  }, [ctx.cards, q, cefr, filter]);

  function status(c: Card): { label: string; cls: string } {
    if (c.isNew) return { label: "new", cls: "rs-tag rs-tag-new" };
    if (isDue(c)) return { label: "due", cls: "rs-tag rs-tag-due" };
    if (c.interval >= 21) return { label: "known", cls: "rs-tag rs-tag-known" };
    return { label: "learning", cls: "rs-tag rs-tag-learning" };
  }

  function addToSchedule(card: Card, scheduleId: string) {
    const target = ctx.schedules.find((s) => s.id === scheduleId);
    if (!target || target.source.type !== "custom") return;
    const ids = target.cardIds ?? [];
    if (ids.includes(card.id)) return;
    ctx.setSchedules(ctx.schedules.map((s) => s.id === scheduleId ? { ...s, cardIds: [...ids, card.id] } : s));
  }

  const customSchedules = ctx.schedules.filter((s) => s.source.type === "custom");

  return (
    <div className="rs-page">
      <div className="rs-page-head"><h1>Vocab</h1></div>

      <div className="rs-filters">
        <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cefr} onChange={(e) => setCefr(e.target.value)}>
          <option value="ALL">All CEFR</option>
          {CEFR_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All</option>
          <option value="new">New</option>
          <option value="learning">Learning</option>
          <option value="known">Known</option>
          <option value="due">Due</option>
        </select>
        <span className="rs-count">{rows.length} shown</span>
      </div>

      <div className="rs-table">
        <div className="rs-thead">
          <span>Hanzi</span><span>Pinyin</span><span>Meaning</span><span>CEFR</span><span>Freq</span><span>Status</span>
        </div>
        {rows.map((c) => {
          const st = status(c);
          return (
            <div key={c.id} className="rs-tr" onClick={() => setSelected(c)}>
              <span className="rs-hanzi-cell">{c.hanzi}</span>
              <span>{c.pinyin}</span>
              <span className="rs-meaning-cell">{c.meaning}</span>
              <span>{c.cefr}</span>
              <span>{c.freq < 1e9 ? c.freq : "—"}</span>
              <span className={st.cls}>{st.label}</span>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="rs-detail-overlay" onClick={() => setSelected(null)}>
          <div className="rs-detail" onClick={(e) => e.stopPropagation()}>
            <div className="rs-detail-head">
              <span className="rs-detail-hanzi">{selected.hanzi}</span>
              <button className="rs-icon-btn" onClick={() => speak(selected.hanzi)} title="Play">{"\u25B6"}</button>
              <button className="rs-icon-btn" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="rs-detail-pinyin">{selected.pinyin}</div>
            <div className="rs-detail-meaning">{selected.meaning}</div>
            {selected.sentenceNative && (
              <div className="rs-detail-sentence">
                <div>{selected.sentenceNative}</div>
                {selected.sentenceEnglish && <div className="rs-muted">{selected.sentenceEnglish}</div>}
              </div>
            )}
            {selected.mnemonicEnglish && <div className="rs-detail-mnemonic">{selected.mnemonicEnglish}</div>}
            {customSchedules.length > 0 && (
              <div className="rs-detail-actions">
                <span>Add to:</span>
                <select defaultValue="" onChange={(e) => { if (e.target.value) { addToSchedule(selected, e.target.value); e.target.value = ""; } }}>
                  <option value="">Choose list…</option>
                  {customSchedules.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
