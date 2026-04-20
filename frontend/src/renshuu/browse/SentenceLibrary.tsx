import { useMemo, useState } from "react";
import type { RenshuuContext } from "../RenshuuApp";
import { speak } from "../../lib/utils";

export function SentenceLibrary({ ctx }: { ctx: RenshuuContext }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const pool = ctx.cards.filter((c) => c.sentenceNative);
    const ql = q.trim().toLowerCase();
    if (!ql) return pool.slice(0, 200);
    return pool.filter((c) =>
      (c.sentenceNative ?? "").includes(ql) ||
      (c.sentenceEnglish ?? "").toLowerCase().includes(ql) ||
      c.hanzi.includes(ql) || c.pinyin.toLowerCase().includes(ql)
    ).slice(0, 500);
  }, [ctx.cards, q]);

  return (
    <div className="rs-page">
      <div className="rs-page-head"><h1>Sentences</h1></div>
      <div className="rs-filters">
        <input placeholder="Search sentence text…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="rs-count">{rows.length} shown</span>
      </div>

      <div className="rs-sentence-list">
        {rows.map((c) => (
          <div key={c.id} className="rs-card rs-sentence">
            <button className="rs-icon-btn" onClick={() => speak(c.sentenceNative!)}>{"\u25B6"}</button>
            <div className="rs-sentence-body">
              <div className="rs-sentence-native">{c.sentenceNative}</div>
              {c.sentenceEnglish && <div className="rs-muted">{c.sentenceEnglish}</div>}
              <div className="rs-sentence-key">{c.hanzi} · {c.pinyin} · {c.meaning}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
