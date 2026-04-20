import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { Card, RawEntry, RenshuuSchedule, RenshuuSettings, StudyStats, Settings } from "../types";
import { buildDeckFromRaw, mergeDeckProgress } from "../deck";
import { loadAllUserData, loadRenshuuData, saveUserData, DEFAULT_RENSHUU_SETTINGS } from "../storage";
import { authClient } from "../lib/auth-client";
import { TopNav } from "./TopNav";
import { useHashRoute } from "./router";
import { Dashboard } from "./dashboard/Dashboard";
import { ScheduleList } from "./schedule/ScheduleList";
import { ScheduleEditor } from "./schedule/ScheduleEditor";
import { VocabList } from "./browse/VocabList";
import { HanziIndex } from "./browse/HanziIndex";
import { GrammarLibrary } from "./browse/GrammarLibrary";
import { SentenceLibrary } from "./browse/SentenceLibrary";
import { StudyView } from "./study/StudyView";
import { SettingsPage } from "./settings/SettingsPage";

interface Props {
  user: { id: string; name: string; email: string };
  onSwitchApp: () => void;
}

export interface RenshuuContext {
  cards: Card[];
  setCards: (updater: (prev: Card[]) => Card[]) => void;
  stats: StudyStats;
  setStats: (s: StudyStats) => void;
  schedules: RenshuuSchedule[];
  setSchedules: (s: RenshuuSchedule[]) => void;
  settings: RenshuuSettings;
  setSettings: (s: RenshuuSettings) => void;
  classicSettings: Settings | null;
  setClassicSettings: (s: Settings) => void;
}

export function RenshuuApp({ user, onSwitchApp }: Props) {
  const [route, navigate] = useHashRoute();
  const [loading, setLoading] = useState(true);
  const [cards, setCardsState] = useState<Card[]>([]);
  const [stats, setStats] = useState<StudyStats>({ history: {} });
  const [schedules, setSchedulesState] = useState<RenshuuSchedule[]>([]);
  const [settings, setSettingsState] = useState<RenshuuSettings>(DEFAULT_RENSHUU_SETTINGS);
  const [classicSettings, setClassicSettings] = useState<Settings | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  const rawDataRef = useRef<RawEntry[] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Apply scope attribute on mount ---
  useEffect(() => {
    document.documentElement.setAttribute("data-app", "renshuu");
    return () => { document.documentElement.removeAttribute("data-app"); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-renshuu-accent", settings.accent);
    return () => { document.documentElement.removeAttribute("data-renshuu-accent"); };
  }, [settings.accent]);

  // --- Apply theme (reuses classic data-theme attribute) ---
  useEffect(() => {
    if (!classicSettings) return;
    if (classicSettings.darkMode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", classicSettings.darkMode);
    }
  }, [classicSettings?.darkMode]);

  // --- Initial load ---
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    (async () => {
      try {
        const [user, rs] = await Promise.all([loadAllUserData(), loadRenshuuData()]);
        setClassicSettings(user.settings);
        setStats(user.stats);
        setSettingsState(rs.settings);
        setSchedulesState(rs.schedules);

        const rawResp = await fetch(`/api/raw-deck?cefr=ALL`);
        const data: RawEntry[] = await rawResp.json();
        rawDataRef.current = data;
        const fresh = buildDeckFromRaw(data, "ALL");
        const deck = user.deck && user.deck.length > 0 ? mergeDeckProgress(fresh, user.deck) : fresh;
        setCardsState(deck);
        // Persist deck so classic and renshuu share the same merged base
        saveUserData("deck", deck);
      } catch (err) {
        console.error("renshuu load failed", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Setters with persistence ---
  const setCards = useCallback((updater: (prev: Card[]) => Card[]) => {
    setCardsState((prev) => {
      const next = updater(prev);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveUserData("deck", next), 500);
      return next;
    });
  }, []);

  const setStatsAndSave = useCallback((s: StudyStats) => {
    setStats(s);
    saveUserData("stats", s);
  }, []);

  const setSchedules = useCallback((s: RenshuuSchedule[]) => {
    setSchedulesState(s);
    saveUserData("renshuuSchedules", s);
  }, []);

  const setSettings = useCallback((s: RenshuuSettings) => {
    setSettingsState(s);
    saveUserData("renshuuSettings", s);
  }, []);

  const setClassicSettingsAndSave = useCallback((s: Settings) => {
    setClassicSettings(s);
    saveUserData("settings", s);
  }, []);

  const cycleDarkMode = useCallback(() => {
    if (!classicSettings) return;
    const next = classicSettings.darkMode === "system" ? "light"
      : classicSettings.darkMode === "light" ? "dark" : "system";
    setClassicSettingsAndSave({ ...classicSettings, darkMode: next });
  }, [classicSettings, setClassicSettingsAndSave]);

  const ctx: RenshuuContext = useMemo(() => ({
    cards, setCards, stats, setStats: setStatsAndSave,
    schedules, setSchedules, settings, setSettings,
    classicSettings, setClassicSettings: setClassicSettingsAndSave,
  }), [cards, setCards, stats, setStatsAndSave, schedules, setSchedules, settings, setSettings, classicSettings, setClassicSettingsAndSave]);

  if (loading || !classicSettings) {
    return (
      <div className="rs-app">
        <div className="rs-loading">Loading…</div>
      </div>
    );
  }

  let body: React.ReactNode;
  switch (route.name) {
    case "dashboard":
      body = <Dashboard ctx={ctx} navigate={navigate} userName={user.name} />;
      break;
    case "schedules":
      body = editingScheduleId
        ? <ScheduleEditor ctx={ctx} scheduleId={editingScheduleId} onClose={() => setEditingScheduleId(null)} />
        : <ScheduleList ctx={ctx} navigate={navigate} onEdit={(id) => setEditingScheduleId(id)} />;
      break;
    case "vocab": body = <VocabList ctx={ctx} />; break;
    case "hanzi": body = <HanziIndex ctx={ctx} />; break;
    case "grammar": body = <GrammarLibrary />; break;
    case "sentences": body = <SentenceLibrary ctx={ctx} />; break;
    case "study": body = <StudyView ctx={ctx} scheduleId={route.scheduleId} navigate={navigate} />; break;
    case "settings": body = <SettingsPage ctx={ctx} />; break;
  }

  return (
    <div className="rs-app">
      <TopNav
        route={route}
        navigate={navigate}
        user={user}
        onSignOut={() => authClient.signOut()}
        onSwitchApp={onSwitchApp}
        darkMode={classicSettings.darkMode}
        cycleDarkMode={cycleDarkMode}
      />
      <main className="rs-main">{body}</main>
    </div>
  );
}
