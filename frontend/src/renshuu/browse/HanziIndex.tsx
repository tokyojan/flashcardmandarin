import { useEffect, useMemo, useState } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import { CEFR_ORDER } from "../../types";

interface HanziEntry {
  char: string;
  pinyins: string[];
  cefrFirst: string;
  freqMin: number;
  appearsIn: number;
}

export function HanziIndex({ ctx }: { ctx: RenshuuContext }) {
  void ctx;
  const [data, setData] = useState<HanziEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [cefr, setCefr] = useState("ALL");

  useEffect(() => {
    fetch("/api/hanzi-index").then((r) => r.json()).then(setData).catch(() => setData([]));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const ql = q.trim().toLowerCase();
    return data.filter((e) => {
      if (cefr !== "ALL" && e.cefrFirst !== cefr) return false;
      if (ql && !e.char.includes(ql) && !e.pinyins.some((p) => p.toLowerCase().includes(ql))) return false;
      return true;
    }).slice(0, 1000);
  }, [data, q, cefr]);

  return (
    <div className="rs-page">
      <div className="rs-page-head"><h1>Hanzi index</h1></div>
      <div className="rs-filters">
        <input placeholder="Search character or pinyin…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cefr} onChange={(e) => setCefr(e.target.value)}>
          <option value="ALL">All CEFR</option>
          {CEFR_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="rs-count">{data ? rows.length : "loading…"}</span>
      </div>

      {!data ? <div className="rs-loading">Loading…</div> : (
        <div className="rs-hanzi-grid">
          {rows.map((e) => (
            <div key={e.char} className="rs-hanzi-cell-card" title={`appears in ${e.appearsIn} words`}>
              <div className="rs-hanzi-big">{e.char}</div>
              <div className="rs-hanzi-pinyin">{e.pinyins.join(" / ")}</div>
              <div className="rs-hanzi-meta">{e.cefrFirst || "—"} · ƒ{e.freqMin < 1e9 ? e.freqMin : "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
