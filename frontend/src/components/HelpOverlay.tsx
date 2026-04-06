import { useEffect } from "react";

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space / Enter", action: "Reveal answer or advance" },
  { key: "1", action: "Again" },
  { key: "2", action: "Hard" },
  { key: "3", action: "Good" },
  { key: "4", action: "Easy" },
  { key: "C", action: "Copy hanzi to clipboard" },
  { key: "Z", action: "Undo last grade" },
  { key: "P", action: "Play pronunciation" },
  { key: "S", action: "Open statistics" },
  { key: "B", action: "Browse cards" },
  { key: "?", action: "Toggle this help" },
  { key: "Esc", action: "Close modals" },
];

export function HelpOverlay({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-compact" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="shortcuts-list">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="shortcut-row">
              <kbd>{s.key}</kbd>
              <span>{s.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
