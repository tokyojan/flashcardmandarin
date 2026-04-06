import { useState, useMemo, useEffect } from "react";
import type { Card, CardStatus } from "../types";
import { getCardStatus, formatInterval } from "../sm2";

interface Props {
  cards: Card[];
  onClose: () => void;
}

const FILTERS: Array<"all" | CardStatus> = ["all", "new", "learning", "young", "mature"];
const PAGE_SIZE = 100;

export function BrowseModal({ cards, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | CardStatus>("all");

  const { filtered, totalMatching } = useMemo(() => {
    let result = cards;

    if (filter !== "all") {
      result = result.filter((c) => getCardStatus(c) === filter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.hanzi.includes(q) ||
          c.pinyin.toLowerCase().includes(q) ||
          c.meaning.toLowerCase().includes(q)
      );
    }

    return { filtered: result.slice(0, PAGE_SIZE), totalMatching: result.length };
  }, [cards, filter, search]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Browse Cards</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <input
          type="text"
          placeholder="Search hanzi, pinyin, or meaning..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="browse-search"
          autoFocus
        />

        <div className="browse-filters">
          {FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-chip${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="browse-meta">
          Showing {filtered.length}
          {totalMatching > PAGE_SIZE ? ` of ${totalMatching}` : ""} cards
        </div>

        <div className="browse-list">
          <div className="browse-header-row">
            <span>Hanzi</span>
            <span>Pinyin</span>
            <span>Meaning</span>
            <span>Status</span>
            <span>CEFR</span>
          </div>
          {filtered.map((c) => {
            const status = getCardStatus(c);
            return (
              <div key={c.id} className="browse-row">
                <span className="browse-hanzi">{c.hanzi}</span>
                <span className="browse-pinyin">{c.pinyin}</span>
                <span className="browse-meaning">{c.meaning}</span>
                <span className={`browse-badge status-${status}`}>
                  {c.isNew ? "new" : formatInterval(c.interval)}
                </span>
                <span className="browse-cefr">{c.cefr || "?"}</span>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="browse-empty">No cards match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}
