import type { Card, MnemonicLang } from "../types";
import { speak } from "../lib/utils";
import { MnemonicList } from "./MnemonicList";

interface Props {
  card: Card;
  reversed: boolean;
  revealed: boolean;
  mnemonicLangs: Record<MnemonicLang, boolean>;
}

function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export function CardView({ card, reversed, revealed, mnemonicLangs }: Props) {
  return (
    <div className="card">
      {reversed ? (
        <div className="card-chinese">
          <div className="hanzi-row">
            <span className="hanzi">{card.hanzi}</span>
            <button className="btn-speak" onClick={() => speak(card.hanzi)} title="Pronounce (P)">
              <SpeakerIcon />
            </button>
          </div>
          <span className="pinyin">{card.pinyin}</span>
          <MnemonicList card={card} langs={mnemonicLangs} />
        </div>
      ) : (
        <div className="card-meaning">{card.meaning}</div>
      )}
      {revealed && (
        <div className="card-answer">
          {reversed ? (
            <div className="card-meaning revealed">{card.meaning}</div>
          ) : (
            <div className="card-chinese revealed">
              <div className="hanzi-row">
                <span className="hanzi">{card.hanzi}</span>
                <button className="btn-speak" onClick={() => speak(card.hanzi)} title="Pronounce (P)">
                  <SpeakerIcon />
                </button>
              </div>
              <span className="pinyin">{card.pinyin}</span>
            </div>
          )}
        </div>
      )}
      <div className="card-meta">
        <span>{card.cefr || "?"}</span><span>&middot;</span><span>{card.pos}</span><span>&middot;</span>
        <span>freq #{card.freq.toLocaleString()}</span>
        {card.isNew && <span className="badge-new">NEW</span>}
        {card.lapses >= 4 && <span className="badge-leech">LEECH</span>}
      </div>
    </div>
  );
}
