import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Card, CefrSelection, DesignTheme, Grade, LayoutVariant, MnemonicLang, RawEntry, SessionGrades, Settings, StudyStats } from "./types";
import { buildDeckFromRaw, mergeDeckProgress, buildSession } from "./deck";
import { scheduleSm2 } from "./sm2";
import {
  loadAllUserData, saveUserData, deleteUserData,
  recordReview, getStreak, importAllData,
} from "./storage";
import { useKeyboard } from "./useKeyboard";
import { authClient } from "./lib/auth-client";
import { speak } from "./lib/utils";
import { AuthPage } from "./components/AuthPage";
import { StatsModal } from "./components/StatsModal";
import { BrowseModal } from "./components/BrowseModal";
import { HelpOverlay } from "./components/HelpOverlay";
import { Toolbar } from "./components/Toolbar";
import { DesignSwitcher } from "./components/DesignSwitcher";
import { SentenceReview } from "./components/SentenceReview";
import type { PinyinEval } from "./lib/pinyin";
import { toneConfusionKey } from "./lib/pinyin";
import { CardView } from "./components/CardView";
import { ReviewControls } from "./components/ReviewControls";
import { DoneScreen } from "./components/DoneScreen";
import { RenshuuApp } from "./renshuu/RenshuuApp";
import type { AppMode } from "./types";
import "./App.css";
import "./renshuu/renshuu.css";

type Phase = "loading" | "ready" | "review" | "done";

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  const [appMode, setAppMode] = useState<AppMode>("classic");
  const [appModeLoaded, setAppModeLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    loadAllUserData()
      .then((d) => { if (!cancelled) setAppMode(d.settings.appMode ?? "classic"); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAppModeLoaded(true); });
    return () => { cancelled = true; };
  }, [session]);

  const switchApp = useCallback((next: AppMode) => {
    setAppMode(next);
    loadAllUserData().then((d) => {
      saveUserData("settings", { ...d.settings, appMode: next });
    }).catch(() => {});
  }, []);

  if (isPending) {
    return (
      <div className="app">
        <div className="center-message">Loading...</div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  if (!appModeLoaded) {
    return (
      <div className="app">
        <div className="center-message">Loading...</div>
      </div>
    );
  }

  if (appMode === "renshuu") {
    return <RenshuuApp user={session.user} onSwitchApp={() => switchApp("classic")} />;
  }
  return <FlashcardApp user={session.user} onSwitchApp={() => switchApp("renshuu")} />;
}

function FlashcardApp({ user, onSwitchApp }: { user: { id: string; name: string; email: string }; onSwitchApp: () => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState<StudyStats>({ history: {} });
  const [session, setSession] = useState<number[]>([]);
  const [sessionIdx, setSessionIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviews, setReviews] = useState(0);
  const [cefrSel, setCefrSel] = useState<CefrSelection>("A1");
  const [dailyNew, setDailyNew] = useState(10);
  const [mnemonicLangs, setMnemonicLangs] = useState<Record<MnemonicLang, boolean>>({ english: true, italian: true });
  const [reversed, setReversed] = useState(false);
  const [darkMode, setDarkMode] = useState<Settings["darkMode"]>("system");
  const [designTheme, setDesignTheme] = useState<DesignTheme>("classic");
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>("classic");
  const [productionMode, setProductionMode] = useState(false);
  const [undoStack, setUndoStack] = useState<Card[]>([]);
  const [flash, setFlash] = useState("");
  const [grades, setGrades] = useState<SessionGrades>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [showStats, setShowStats] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const rawDataRef = useRef<RawEntry[] | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const anyModalOpen = showStats || showBrowse || showHelp;

  // --- Derived ---

  const cardMap = useMemo(() => {
    const m = new Map<number, Card>();
    for (const c of cards) m.set(c.id, c);
    return m;
  }, [cards]);

  const currentCard = session[sessionIdx] ? cardMap.get(session[sessionIdx]) ?? null : null;
  const streak = useMemo(() => getStreak(stats), [stats]);

  // --- Helpers ---

  const showFlash = useCallback((msg: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(msg);
    flashTimerRef.current = setTimeout(() => setFlash(""), 2500);
  }, []);

  const debouncedSaveDeck = useCallback((deck: Card[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveUserData("deck", deck), 500);
  }, []);

  // --- Effects ---

  useEffect(() => {
    if (darkMode === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-design", designTheme);
  }, [designTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-layout", layoutVariant);
  }, [layoutVariant]);

  // Persist settings on change
  useEffect(() => {
    if (phase === "loading") return;
    saveUserData("settings", { cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, designTheme, layoutVariant, productionMode, appMode: "classic" });
  }, [cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, designTheme, layoutVariant, productionMode, phase]);

  // Flush pending deck save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveUserData("deck", cards);
      }
    };
  }, [cards]);

  // Initial load from PostgreSQL
  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    async function load() {
      try {
        const userData = await loadAllUserData();
        const cefrForFetch = userData.settings?.cefrSel ?? "ALL";
        const rawResp = await fetch(`/api/raw-deck?cefr=${encodeURIComponent(cefrForFetch)}`);
        if (!rawResp.ok) throw new Error("Failed to load raw deck");
        const data: RawEntry[] = await rawResp.json();
        rawDataRef.current = data;

        const s = userData.settings;
        setCefrSel(s.cefrSel);
        setDailyNew(s.dailyNew);
        setReversed(s.reversed);
        setDarkMode(s.darkMode);
        if (s.designTheme) setDesignTheme(s.designTheme);
        if (s.layoutVariant) setLayoutVariant(s.layoutVariant);
        if (s.mnemonicLangs) setMnemonicLangs(s.mnemonicLangs);
        if (typeof s.productionMode === "boolean") setProductionMode(s.productionMode);
        setStats(userData.stats);

        const deckCefr = s.cefrSel;
        let deck: Card[];
        if (userData.deck && userData.deck.length > 0) {
          const fresh = buildDeckFromRaw(data, deckCefr);
          deck = mergeDeckProgress(fresh, userData.deck);
        } else {
          deck = buildDeckFromRaw(data, deckCefr);
        }
        setCards(deck);
        saveUserData("deck", deck);

        const saved = userData.session;
        if (saved && saved.cefrSel === deckCefr && saved.currentIdx < saved.cardIds.length) {
          setSession(saved.cardIds);
          setSessionIdx(saved.currentIdx);
          setReviews(saved.reviews);
          setGrades(saved.grades);
          sessionStartRef.current = saved.startTime;
          setPhase("review");
        } else {
          deleteUserData("session");
          const sess = buildSession(deck, s.dailyNew);
          setSession(sess);
          setSessionIdx(0);
          sessionStartRef.current = Date.now();
          setPhase(sess.length > 0 ? "review" : "done");
        }
      } catch (err) {
        console.error(err);
        setPhase("ready");
      }
    }
    load();
  }, []);

  // --- Actions ---

  const rebuildDeck = useCallback(async () => {
    const resp = await fetch(`/api/raw-deck?cefr=${encodeURIComponent(cefrSel)}`);
    if (!resp.ok) { showFlash("Failed to fetch deck"); return; }
    const data: RawEntry[] = await resp.json();
    rawDataRef.current = data;
    const fresh = buildDeckFromRaw(data, cefrSel);
    const deck = mergeDeckProgress(fresh, cards);
    setCards(deck);
    saveUserData("deck", deck);
    deleteUserData("session");
    const sess = buildSession(deck, dailyNew);
    setSession(sess);
    setSessionIdx(0);
    setReviews(0);
    setRevealed(false);
    setUndoStack([]);
    setGrades({ again: 0, hard: 0, good: 0, easy: 0 });
    sessionStartRef.current = Date.now();
    setPhase(sess.length > 0 ? "review" : "done");
    showFlash(`Deck rebuilt \u2014 ${deck.length} cards (${cefrSel})`);
  }, [cards, cefrSel, dailyNew, showFlash]);

  const rebuildSession = useCallback(() => {
    deleteUserData("session");
    const sess = buildSession(cards, dailyNew);
    setSession(sess);
    setSessionIdx(0);
    setReviews(0);
    setRevealed(false);
    setUndoStack([]);
    setGrades({ again: 0, hard: 0, good: 0, easy: 0 });
    sessionStartRef.current = Date.now();
    setPhase(sess.length > 0 ? "review" : "done");
    showFlash(`New session \u2014 ${sess.length} cards`);
  }, [cards, dailyNew, showFlash]);

  const revealOrAdvance = useCallback(() => {
    if (phase !== "review" || !currentCard || anyModalOpen) return;
    if (!revealed) {
      setRevealed(true);
    } else {
      const next = sessionIdx + 1;
      if (next >= session.length) setPhase("done");
      else { setSessionIdx(next); setRevealed(false); }
    }
  }, [phase, currentCard, revealed, sessionIdx, session.length, anyModalOpen]);

  const applyGrade = useCallback(
    (q: Grade, evalResult: PinyinEval | null) => {
      if (!currentCard || anyModalOpen) return;

      setUndoStack((prev) => [...prev.slice(-19), { ...currentCard }]);

      const updated = scheduleSm2(currentCard, q);
      const newCards = cards.map((c) => (c.id === updated.id ? updated : c));

      let newSession = session;
      if (q === 0) {
        const at = Math.min(sessionIdx + 10, session.length);
        newSession = [...session.slice(0, at), updated.id, ...session.slice(at)];
      }

      setCards(newCards);
      setSession(newSession);
      debouncedSaveDeck(newCards);

      const newReviews = reviews + 1;
      const newGrades = {
        again: grades.again + (q === 0 ? 1 : 0),
        hard: grades.hard + (q === 3 ? 1 : 0),
        good: grades.good + (q === 4 ? 1 : 0),
        easy: grades.easy + (q === 5 ? 1 : 0),
      };
      setReviews(newReviews);
      setGrades(newGrades);

      const toneConfusions: string[] = [];
      if (evalResult) {
        for (const s of evalResult.syllables) {
          if (s.baseCorrect && !s.toneCorrect && s.expected.tone && s.got.tone) {
            toneConfusions.push(toneConfusionKey(s.expected.tone, s.got.tone));
          }
        }
      }
      const newStats = recordReview(stats, q >= 3, currentCard.isNew, evalResult ? {
        charactersCorrect: evalResult.charactersCorrect,
        tonesCorrect: evalResult.tonesCorrect,
        toneConfusions,
      } : undefined);
      setStats(newStats);
      saveUserData("stats", newStats);

      const next = sessionIdx + 1;
      if (next >= newSession.length) {
        deleteUserData("session");
        setPhase("done");
      } else {
        saveUserData("session", {
          cardIds: newSession,
          currentIdx: next,
          reviews: newReviews,
          grades: newGrades,
          startTime: sessionStartRef.current,
          cefrSel,
        });
        setSessionIdx(next);
        setRevealed(false);
      }
    },
    [currentCard, cards, session, sessionIdx, reviews, grades, stats, cefrSel, debouncedSaveDeck, anyModalOpen]
  );

  const grade = useCallback(
    (q: Grade) => {
      if (!revealed) return;
      applyGrade(q, null);
    },
    [revealed, applyGrade]
  );

  const undo = useCallback(() => {
    if (undoStack.length === 0 || sessionIdx === 0 || anyModalOpen) return;
    const prev = undoStack[undoStack.length - 1];
    const newCards = cards.map((c) => (c.id === prev.id ? prev : c));
    setCards(newCards);
    setUndoStack((s) => s.slice(0, -1));
    setSessionIdx((i) => i - 1);
    setRevealed(true);
    setReviews((r) => Math.max(0, r - 1));
    setPhase("review");
    debouncedSaveDeck(newCards);
  }, [undoStack, sessionIdx, cards, debouncedSaveDeck, anyModalOpen]);

  const copyHanzi = useCallback(() => {
    if (currentCard) {
      navigator.clipboard.writeText(currentCard.hanzi);
      showFlash("Copied to clipboard");
    }
  }, [currentCard, showFlash]);

  const speakCurrent = useCallback(() => {
    if (currentCard) speak(currentCard.hanzi);
  }, [currentCard]);

  const handleExport = useCallback(() => {
    const data = JSON.stringify({
      deck: cards, stats,
      settings: { cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, designTheme, layoutVariant, productionMode },
      exportDate: new Date().toISOString(),
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mandarin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showFlash("Backup exported");
  }, [cards, stats, cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, designTheme, layoutVariant, productionMode, showFlash]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = importAllData(reader.result as string);
          if (data.deck) {
            const merged = rawDataRef.current
              ? mergeDeckProgress(buildDeckFromRaw(rawDataRef.current, cefrSel), data.deck)
              : data.deck;
            setCards(merged);
            saveUserData("deck", merged);
          }
          if (data.stats) {
            setStats(data.stats);
            saveUserData("stats", data.stats);
          }
          if (data.settings) {
            saveUserData("settings", data.settings);
            setCefrSel(data.settings.cefrSel);
            setDailyNew(data.settings.dailyNew);
            setReversed(data.settings.reversed);
            setDarkMode(data.settings.darkMode);
            if (data.settings.mnemonicLangs) setMnemonicLangs(data.settings.mnemonicLangs);
            if (data.settings.designTheme) setDesignTheme(data.settings.designTheme);
            if (data.settings.layoutVariant) setLayoutVariant(data.settings.layoutVariant);
            if (typeof data.settings.productionMode === "boolean") setProductionMode(data.settings.productionMode);
          }
          showFlash("Backup imported successfully");
          setShowStats(false);
        } catch {
          showFlash("Import failed \u2014 invalid file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [cefrSel, showFlash]
  );

  const cycleDarkMode = useCallback(() => {
    setDarkMode((m) => {
      const next = m === "system" ? "light" : m === "light" ? "dark" : "system";
      showFlash(`Theme: ${next}`);
      return next;
    });
  }, [showFlash]);

  // --- Keyboard ---

  const keyHandlers = useMemo<Record<string, () => void>>(() => {
    const common: Record<string, () => void> = {
      c: copyHanzi, C: copyHanzi,
      z: undo, Z: undo,
      p: speakCurrent, P: speakCurrent,
      s: () => { if (!anyModalOpen) setShowStats(true); },
      S: () => { if (!anyModalOpen) setShowStats(true); },
      b: () => { if (!anyModalOpen) setShowBrowse(true); },
      B: () => { if (!anyModalOpen) setShowBrowse(true); },
      "?": () => setShowHelp((v) => !v),
    };
    if (productionMode) return common;
    return {
      ...common,
      " ": revealOrAdvance,
      Enter: revealOrAdvance,
      "1": () => grade(0),
      "2": () => grade(3),
      "3": () => grade(4),
      "4": () => grade(5),
    };
  }, [productionMode, revealOrAdvance, grade, copyHanzi, undo, speakCurrent, anyModalOpen]);
  useKeyboard(keyHandlers);

  // --- Render ---

  if (phase === "loading") {
    return (
      <div className="app">
        <div className="center-message">Loading...</div>
      </div>
    );
  }

  const totalNew = cards.filter((c) => c.isNew).length;
  const totalLearned = cards.filter((c) => !c.isNew).length;
  const sessionProgress = session.length > 0 ? (sessionIdx / session.length) * 100 : 0;

  return (
    <div className="app">
      <Toolbar
        cefrSel={cefrSel} setCefrSel={setCefrSel}
        dailyNew={dailyNew} setDailyNew={setDailyNew}
        reversed={reversed} setReversed={setReversed}
        mnemonicLangs={mnemonicLangs} setMnemonicLangs={setMnemonicLangs}
        productionMode={productionMode} setProductionMode={setProductionMode}
        darkMode={darkMode} cycleDarkMode={cycleDarkMode}
        onShowHelp={() => setShowHelp(true)}
        onShowStats={() => setShowStats(true)}
        onShowBrowse={() => setShowBrowse(true)}
        onRebuildSession={rebuildSession}
        onRebuildDeck={rebuildDeck}
        onSignOut={() => authClient.signOut()}
        onSwitchApp={onSwitchApp}
        user={user}
      />

      <DesignSwitcher
        designTheme={designTheme} setDesignTheme={setDesignTheme}
        layoutVariant={layoutVariant} setLayoutVariant={setLayoutVariant}
      />

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${sessionProgress}%` }} />
      </div>

      {flash && <div className="flash">{flash}</div>}

      <div className="info-bar">
        <span>Learned: <strong>{totalLearned}</strong></span>
        <span>New: <strong>{totalNew}</strong></span>
        <span>Session: <strong>{session.length}</strong></span>
        {streak > 0 && <span className="streak-badge">{streak} day streak {"\u{1F525}"}</span>}
      </div>

      <main className="main">
        {phase === "done" ? (
          <DoneScreen
            grades={grades}
            durationMs={Date.now() - sessionStartRef.current}
            onRebuildSession={rebuildSession}
          />
        ) : phase === "ready" ? (
          <div className="done-screen">
            <h2>No data loaded</h2>
            <p>Backend returned no data. Check <code>/api/raw-deck</code>.</p>
          </div>
        ) : currentCard ? (
          productionMode ? (
            <SentenceReview
              key={currentCard.id}
              card={currentCard}
              pool={cards}
              sessionIdx={sessionIdx}
              sessionLength={session.length}
              reviews={reviews}
              mnemonicLangs={mnemonicLangs}
              canUndo={undoStack.length > 0}
              onSubmit={(g) => applyGrade(g, null)}
              onUndo={undo}
              onCopyHanzi={copyHanzi}
            />
          ) : (
            <>
              <CardView
                card={currentCard}
                reversed={reversed}
                revealed={revealed}
                mnemonicLangs={mnemonicLangs}
              />
              <ReviewControls
                card={currentCard}
                revealed={revealed}
                sessionIdx={sessionIdx}
                sessionLength={session.length}
                reviews={reviews}
                canUndo={undoStack.length > 0}
                onReveal={revealOrAdvance}
                onGrade={grade}
                onCopyHanzi={copyHanzi}
                onUndo={undo}
              />
            </>
          )
        ) : null}
      </main>

      <input ref={fileInputRef} type="file" accept=".json" hidden onChange={handleImportFile} />

      {showStats && (
        <StatsModal cards={cards} stats={stats} onClose={() => setShowStats(false)} onExport={handleExport} onImportClick={() => fileInputRef.current?.click()} />
      )}
      {showBrowse && <BrowseModal cards={cards} onClose={() => setShowBrowse(false)} />}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
