import { useEffect, useMemo, useState } from "react";

export interface GrammarEntry {
  id: string;
  pattern: string;
  level: string;
  english: string;
  examples: { native: string; english: string }[];
  keywords?: string[];
}

export function GrammarLibrary() {
  const [data, setData] = useState<GrammarEntry[] | null>(null);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("ALL");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/grammar").then((r) => r.json()).then(setData).catch(() => setData([]));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const ql = q.trim().toLowerCase();
    return data.filter((e) => {
      if (level !== "ALL" && e.level !== level) return false;
      if (ql && !e.pattern.toLowerCase().includes(ql) && !e.english.toLowerCase().includes(ql) &&
          !(e.keywords ?? []).some((k) => k.toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [data, q, level]);

  return (
    <div className="rs-page">
      <div className="rs-page-head"><h1>Grammar library</h1></div>
      <div className="rs-filters">
        <input placeholder="Search pattern or meaning…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="ALL">All levels</option>
          {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <span className="rs-count">{data ? rows.length : "loading…"}</span>
      </div>

      {!data ? <div className="rs-loading">Loading…</div> : data.length === 0 ? (
        <div className="rs-card rs-empty">No grammar entries yet. The library is being built.</div>
      ) : (
        <div className="rs-grammar-list">
          {rows.map((e) => (
            <div key={e.id} className={"rs-card rs-grammar" + (open === e.id ? " rs-open" : "")}>
              <button className="rs-grammar-head" onClick={() => setOpen(open === e.id ? null : e.id)}>
                <span className="rs-grammar-pattern">{e.pattern}</span>
                <span className="rs-tag rs-tag-known">{e.level}</span>
                <span className="rs-grammar-eng">{e.english}</span>
              </button>
              {open === e.id && (
                <div className="rs-grammar-body">
                  {e.examples.map((ex, i) => (
                    <div key={i} className="rs-grammar-ex">
                      <div>{ex.native}</div>
                      <div className="rs-muted">{ex.english}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
