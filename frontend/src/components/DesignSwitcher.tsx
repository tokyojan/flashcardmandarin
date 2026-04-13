import type { DesignTheme, LayoutVariant } from "../types";
import { DESIGN_THEMES, LAYOUT_VARIANTS } from "../types";

interface Props {
  designTheme: DesignTheme;
  setDesignTheme: (v: DesignTheme) => void;
  layoutVariant: LayoutVariant;
  setLayoutVariant: (v: LayoutVariant) => void;
}

export function DesignSwitcher({ designTheme, setDesignTheme, layoutVariant, setLayoutVariant }: Props) {
  return (
    <div className="design-switcher" role="region" aria-label="Design and layout">
      <label className="design-switcher-field" title="Design theme">
        <span>Design</span>
        <select value={designTheme} onChange={(e) => setDesignTheme(e.target.value as DesignTheme)}>
          {DESIGN_THEMES.map((d) => (<option key={d.key} value={d.key}>{d.label}</option>))}
        </select>
      </label>
      <label className="design-switcher-field" title="Layout variant">
        <span>Layout</span>
        <select value={layoutVariant} onChange={(e) => setLayoutVariant(e.target.value as LayoutVariant)}>
          {LAYOUT_VARIANTS.map((l) => (<option key={l.key} value={l.key}>{l.label}</option>))}
        </select>
      </label>
    </div>
  );
}
