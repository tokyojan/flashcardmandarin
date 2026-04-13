import type { Card, MnemonicLang } from "../types";

interface Props {
  card: Card;
  langs: Record<MnemonicLang, boolean>;
}

export function MnemonicList({ card, langs }: Props) {
  const items: { key: MnemonicLang; label: string; text: string }[] = [];
  if (langs.english && card.mnemonicEnglish?.trim()) {
    items.push({ key: "english", label: "EN", text: card.mnemonicEnglish.trim() });
  }
  if (langs.italian && card.mnemonicItalian?.trim()) {
    items.push({ key: "italian", label: "IT", text: card.mnemonicItalian.trim() });
  }
  if (items.length === 0) return null;
  return (
    <div className="mnemonics">
      {items.map(({ key, label, text }) => (
        <div key={key} className="mnemonic">
          <span className="mnemonic-lang">{label}</span>
          <span className="mnemonic-text">{text}</span>
        </div>
      ))}
    </div>
  );
}
