import type { CefrSelection, MnemonicLang, Settings } from "../types";
import { CEFR_ORDER, SUPPORTED_LANGUAGES } from "../types";

interface Props {
  cefrSel: CefrSelection;
  setCefrSel: (v: CefrSelection) => void;
  dailyNew: number;
  setDailyNew: (n: number) => void;
  reversed: boolean;
  setReversed: (v: boolean) => void;
  mnemonicLangs: Record<MnemonicLang, boolean>;
  setMnemonicLangs: (updater: (prev: Record<MnemonicLang, boolean>) => Record<MnemonicLang, boolean>) => void;
  productionMode: boolean;
  setProductionMode: (v: boolean) => void;
  darkMode: Settings["darkMode"];
  cycleDarkMode: () => void;
  onShowHelp: () => void;
  onShowStats: () => void;
  onShowBrowse: () => void;
  onRebuildSession: () => void;
  onRebuildDeck: () => void;
  onSignOut: () => void;
  user: { name: string; email: string };
}

export function Toolbar(p: Props) {
  const darkModeIcon = p.darkMode === "dark" ? "\u263E" : p.darkMode === "light" ? "\u2600" : "\u25D1";
  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <label className="toolbar-field">
          <span>CEFR</span>
          <select value={p.cefrSel} onChange={(e) => p.setCefrSel(e.target.value as CefrSelection)}>
            <option value="ALL">ALL</option>
            {CEFR_ORDER.map((l) => (<option key={l} value={l}>{l}</option>))}
          </select>
        </label>
        <label className="toolbar-field">
          <span>New/day</span>
          <input type="number" min={0} max={200} value={p.dailyNew} onChange={(e) => p.setDailyNew(Number(e.target.value))} />
        </label>
        <label className="toolbar-check">
          <input type="checkbox" checked={p.reversed} onChange={() => p.setReversed(!p.reversed)} />
          <span>Hanzi first</span>
        </label>
        <label className="toolbar-check" title="4-choice cloze quiz with sentence context">
          <input type="checkbox" checked={p.productionMode} onChange={() => p.setProductionMode(!p.productionMode)} />
          <span>Quiz mode</span>
        </label>
        {SUPPORTED_LANGUAGES.map(({ key, label }) => (
          <label key={key} className="toolbar-check">
            <input
              type="checkbox"
              checked={p.mnemonicLangs[key]}
              onChange={() => p.setMnemonicLangs((m) => ({ ...m, [key]: !m[key] }))}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="toolbar-right">
        <button className="toolbar-icon" onClick={p.cycleDarkMode} title={`Theme: ${p.darkMode}`}>{darkModeIcon}</button>
        <button className="toolbar-icon" onClick={p.onShowHelp} title="Keyboard shortcuts">?</button>
        <button className="toolbar-icon" onClick={p.onShowStats} title="Statistics">&#x2261;</button>
        <button className="toolbar-icon" onClick={p.onShowBrowse} title="Browse cards">&#x1F50D;</button>
        <div className="toolbar-divider" />
        <button className="btn-outline btn-sm" onClick={p.onRebuildSession}>New Session</button>
        <button className="btn-primary btn-sm" onClick={p.onRebuildDeck}>Rebuild Deck</button>
        <div className="toolbar-divider" />
        <span className="toolbar-user" title={p.user.email}>{p.user.name}</span>
        <button className="btn-outline btn-sm" onClick={p.onSignOut}>Sign Out</button>
      </div>
    </header>
  );
}
