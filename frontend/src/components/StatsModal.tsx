import { Fragment, useEffect } from "react";
import type { Card, StudyStats } from "../types";
import { getCardStatus } from "../sm2";
import { getStreak, getRetention, getReviewHistory } from "../storage";

interface Props {
  cards: Card[];
  stats: StudyStats;
  onClose: () => void;
  onExport: () => void;
  onImportClick: () => void;
}

export function StatsModal({ cards, stats, onClose, onExport, onImportClick }: Props) {
  const streak = getStreak(stats);
  const retention7 = getRetention(stats, 7);
  const retention30 = getRetention(stats, 30);
  const history = getReviewHistory(stats, 14);
  const maxReviews = Math.max(...history.map((h) => h.reviews), 1);

  const counts = { new: 0, learning: 0, young: 0, mature: 0 };
  for (const c of cards) counts[getCardStatus(c)]++;

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayReviews = stats.history[todayKey]?.reviews ?? 0;
  const todayNew = stats.history[todayKey]?.newLearned ?? 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Statistics</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{cards.length.toLocaleString()}</div>
            <div className="stat-label">Total Cards</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {cards.filter((c) => !c.isNew).length}
            </div>
            <div className="stat-label">Learned</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {streak}
              <span className="streak-fire">{streak > 0 ? " \u{1F525}" : ""}</span>
            </div>
            <div className="stat-label">Day Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{todayReviews}</div>
            <div className="stat-label">Today ({todayNew} new)</div>
          </div>
        </div>

        <div className="stats-section">
          <h3>Retention</h3>
          <div className="retention-rows">
            <div className="retention-row">
              <span>Last 7 days</span>
              <div className="retention-bar-track">
                <div
                  className="retention-bar-fill"
                  style={{ width: `${retention7}%` }}
                />
              </div>
              <span className="retention-pct">{retention7}%</span>
            </div>
            <div className="retention-row">
              <span>Last 30 days</span>
              <div className="retention-bar-track">
                <div
                  className="retention-bar-fill"
                  style={{ width: `${retention30}%` }}
                />
              </div>
              <span className="retention-pct">{retention30}%</span>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <h3>Daily Reviews</h3>
          <div className="chart">
            {history.map((h) => (
              <div key={h.date} className="chart-col">
                <div className="chart-bar-track">
                  <div
                    className="chart-bar-fill"
                    style={{
                      height: `${(h.reviews / maxReviews) * 100}%`,
                    }}
                  />
                </div>
                <div className="chart-label">{h.date.slice(8)}</div>
                {h.reviews > 0 && (
                  <div className="chart-value">{h.reviews}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {stats.toneConfusions && Object.keys(stats.toneConfusions).length > 0 && (
          <div className="stats-section">
            <h3>Tone Confusions</h3>
            <ToneMatrix confusions={stats.toneConfusions} />
          </div>
        )}

        <div className="stats-section">
          <h3>Card Maturity</h3>
          <div className="maturity-rows">
            {(["new", "learning", "young", "mature"] as const).map(
              (status) => (
                <div key={status} className="maturity-row">
                  <span className={`maturity-label status-${status}`}>
                    {status}
                  </span>
                  <div className="maturity-track">
                    <div
                      className={`maturity-fill status-${status}`}
                      style={{
                        width: `${(counts[status] / (cards.length || 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="maturity-count">{counts[status]}</span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="stats-actions">
          <button className="btn-outline" onClick={onExport}>
            Export Backup
          </button>
          <button className="btn-outline" onClick={onImportClick}>
            Import Backup
          </button>
        </div>
      </div>
    </div>
  );
}

function ToneMatrix({ confusions }: { confusions: Record<string, number> }) {
  const tones = [1, 2, 3, 4, 5];
  const max = Math.max(1, ...Object.values(confusions));
  const total = Object.values(confusions).reduce((a, b) => a + b, 0);

  return (
    <div className="tone-matrix-wrap">
      <div className="tone-matrix">
        <div className="tone-matrix-corner">{"expected \u00b7 heard"}</div>
        {tones.map((t) => (
          <div key={`h-${t}`} className="tone-matrix-head">{t === 5 ? "\u00b0" : t}</div>
        ))}
        {tones.map((row) => (
          <Fragment key={`row-${row}`}>
            <div className="tone-matrix-head">{row === 5 ? "\u00b0" : row}</div>
            {tones.map((col) => {
              const count = row === col ? 0 : (confusions[`${row}->${col}`] ?? 0);
              const intensity = count / max;
              return (
                <div
                  key={`${row}-${col}`}
                  className="tone-matrix-cell"
                  data-self={row === col || undefined}
                  style={{
                    background: row === col
                      ? "transparent"
                      : `color-mix(in srgb, var(--danger) ${Math.round(intensity * 70)}%, transparent)`,
                  }}
                  title={`Expected ${row}, heard ${col}: ${count}`}
                >
                  {count || ""}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="tone-matrix-legend">
        <span>{total} tone slip{total !== 1 ? "s" : ""} recorded</span>
        <span className="tone-matrix-key">{"\u00b0"} = neutral</span>
      </div>
    </div>
  );
}
