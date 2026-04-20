import { useState, useEffect, useRef } from "react";
import type { Route } from "./router";

interface Props {
  route: Route;
  navigate: (r: Route) => void;
  user: { name: string; email: string };
  onSignOut: () => void;
  onSwitchApp: () => void;
  darkMode: "system" | "light" | "dark";
  cycleDarkMode: () => void;
}

const NAV: { label: string; route: Route }[] = [
  { label: "Home", route: { name: "dashboard" } },
  { label: "Schedules", route: { name: "schedules" } },
  { label: "Vocab", route: { name: "vocab" } },
  { label: "Hanzi", route: { name: "hanzi" } },
  { label: "Grammar", route: { name: "grammar" } },
  { label: "Sentences", route: { name: "sentences" } },
];

export function TopNav(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const themeIcon = p.darkMode === "dark" ? "\u263E" : p.darkMode === "light" ? "\u2600" : "\u25D1";

  return (
    <header className="rs-topnav">
      <div className="rs-topnav-inner">
        <a className="rs-logo" href="#/dashboard" onClick={(e) => { e.preventDefault(); p.navigate({ name: "dashboard" }); }}>
          <span className="rs-logo-mark">{"\u4E2D"}</span>
          <span className="rs-logo-text">renshuu</span>
        </a>
        <nav className="rs-nav">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={"#" + (n.route.name === "study" ? "/study/" + n.route.scheduleId : "/" + n.route.name)}
              className={"rs-nav-item" + (p.route.name === n.route.name ? " rs-active" : "")}
              onClick={(e) => { e.preventDefault(); p.navigate(n.route); }}
            >{n.label}</a>
          ))}
        </nav>
        <div className="rs-topnav-right">
          <button className="rs-icon-btn" onClick={p.cycleDarkMode} title={`Theme: ${p.darkMode}`}>{themeIcon}</button>
          <a
            href="#/settings"
            className={"rs-icon-btn" + (p.route.name === "settings" ? " rs-active" : "")}
            onClick={(e) => { e.preventDefault(); p.navigate({ name: "settings" }); }}
            title="Settings"
          >{"\u2699"}</a>
          <div className="rs-user-menu" ref={menuRef}>
            <button className="rs-avatar" onClick={() => setMenuOpen((v) => !v)} title={p.user.email}>
              {p.user.name.slice(0, 1).toUpperCase()}
            </button>
            {menuOpen && (
              <div className="rs-user-menu-pop">
                <div className="rs-user-menu-name">{p.user.name}</div>
                <div className="rs-user-menu-email">{p.user.email}</div>
                <hr />
                <button onClick={() => { setMenuOpen(false); p.onSwitchApp(); }}>Switch to classic</button>
                <button onClick={() => { setMenuOpen(false); p.onSignOut(); }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
