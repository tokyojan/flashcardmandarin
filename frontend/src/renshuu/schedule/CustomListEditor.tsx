import { useState, useMemo } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import type { RenshuuSchedule } from "../../types";

export function CustomListEditor({ ctx, schedule, update }: { ctx: RenshuuContext; schedule: RenshuuSchedule; update: (patch: Partial<RenshuuSchedule>) => void }) {
  const [query, setQuery] = useState("");
  const [importText, setImportText] = useState("");
  const ids = useMemo(() => new Set(schedule.cardIds ?? []), [schedule.cardIds]);

  const matching = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as typeof ctx.cards;
    return ctx.cards.filter((c) =>
      c.hanzi.includes(q) || c.pinyin.toLowerCase().includes(q) || c.meaning.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, ctx.cards]);

  function add(id: number) { if (!ids.has(id)) update({ cardIds: [...(schedule.cardIds ?? []), id] }); }
  function remove(id: number) { update({ cardIds: (schedule.cardIds ?? []).filter((x) => x !== id) }); }

  function importFromText() {
    const lines = importText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const matched: number[] = [];
    for (const line of lines) {
      const found = ctx.cards.find((c) => c.hanzi === line || c.pinyin === line || c.meaning.toLowerCase() === line.toLowerCase());
      if (found && !ids.has(found.id) && !matched.includes(found.id)) matched.push(found.id);
    }
    update({ cardIds: [...(schedule.cardIds ?? []), ...matched] });
    setImportText("");
    alert(`Added ${matched.length} cards`);
  }

  function exportCsv() {
    const picked = ctx.cards.filter((c) => ids.has(c.id));
    const csv = "hanzi,pinyin,meaning\n" + picked.map((c) => `"${c.hanzi}","${c.pinyin}","${c.meaning.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${schedule.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const picked = ctx.cards.filter((c) => ids.has(c.id));

  return (
    <div className="rs-custom-list">
      <div className="rs-card">
        <div className="rs-card-title">Add by search</div>
        <input placeholder="Search by hanzi / pinyin / meaning" value={query} onChange={(e) => setQuery(e.target.value)} />
        {matching.length > 0 && (
          <div className="rs-search-results">
            {matching.map((c) => (
              <div key={c.id} className="rs-search-result">
                <span className="rs-sr-hanzi">{c.hanzi}</span>
                <span className="rs-sr-pinyin">{c.pinyin}</span>
                <span className="rs-sr-meaning">{c.meaning}</span>
                <button className="rs-btn rs-btn-sm" disabled={ids.has(c.id)} onClick={() => add(c.id)}>{ids.has(c.id) ? "Added" : "Add"}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rs-card">
        <div className="rs-card-title">Import / export</div>
        <textarea placeholder="Paste one term per line (hanzi, pinyin, or meaning)" value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} />
        <div className="rs-btn-row">
          <button className="rs-btn" onClick={importFromText} disabled={!importText.trim()}>Import</button>
          <button className="rs-btn" onClick={exportCsv} disabled={picked.length === 0}>Export CSV</button>
        </div>
      </div>

      <div className="rs-card">
        <div className="rs-card-title">In this list ({picked.length})</div>
        <div className="rs-picked-list">
          {picked.map((c) => (
            <div key={c.id} className="rs-picked">
              <span className="rs-sr-hanzi">{c.hanzi}</span>
              <span className="rs-sr-pinyin">{c.pinyin}</span>
              <span className="rs-sr-meaning">{c.meaning}</span>
              <button className="rs-btn rs-btn-sm" onClick={() => remove(c.id)}>Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
