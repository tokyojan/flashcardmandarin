import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Card, CefrSelection, Grade, MnemonicLang, RawEntry, SessionGrades, Settings, StudyStats } from "./types";
import { CEFR_ORDER, SUPPORTED_LANGUAGES } from "./types";
import { buildDeckFromRaw, mergeDeckProgress, buildSession } from "./deck";
import { scheduleSm2, previewInterval, formatInterval } from "./sm2";
import {
  loadAllUserData, saveUserData, deleteUserData,
  recordReview, getStreak, importAllData,
} from "./storage";
import { useKeyboard } from "./useKeyboard";
import { authClient } from "./lib/auth-client";
import { AuthPage } from "./components/AuthPage";
import { StatsModal } from "./components/StatsModal";
import { BrowseModal } from "./components/BrowseModal";
import { HelpOverlay } from "./components/HelpOverlay";
import "./App.css";

type Phase = "loading" | "ready" | "review" | "done";

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-CN";
  utter.rate = 0.8;
  window.speechSynthesis.speak(utter);
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${mins}m ${s}s` : `${mins}m`;
}

export default function App() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="app">
        <div className="center-message">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  return <FlashcardApp user={session.user} />;
}

function MnemonicList({ card, langs }: { card: Card; langs: Record<MnemonicLang, boolean> }) {
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

function FlashcardApp({ user }: { user: { id: string; name: string; email: string } }) {
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

  // Persist settings on change
  useEffect(() => {
    if (phase === "loading") return; // don't save defaults before load completes
    saveUserData("settings", { cefrSel, dailyNew, reversed, darkMode, mnemonicLangs });
  }, [cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, phase]);

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
  useEffect(() => {
    async function load() {
      try {
        const [rawResp, userData] = await Promise.all([
          fetch("/mandarin.json"),
          loadAllUserData(),
        ]);

        if (!rawResp.ok) throw new Error("mandarin.json not found in /public");
        const data: RawEntry[] = await rawResp.json();
        rawDataRef.current = data;

        // Apply saved settings
        const s = userData.settings;
        setCefrSel(s.cefrSel);
        setDailyNew(s.dailyNew);
        setReversed(s.reversed);
        setDarkMode(s.darkMode);
        if (s.mnemonicLangs) setMnemonicLangs(s.mnemonicLangs);
        setStats(userData.stats);

        // Build deck, merge with saved progress
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

        // Restore persisted session if valid
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Actions ---

  const rebuildDeck = useCallback(() => {
    if (!rawDataRef.current) return;
    const fresh = buildDeckFromRaw(rawDataRef.current, cefrSel);
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

  const grade = useCallback(
    (q: Grade) => {
      if (!revealed || !currentCard || anyModalOpen) return;

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

      // Update stats
      const newStats = recordReview(stats, q >= 3, currentCard.isNew);
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
    [revealed, currentCard, cards, session, sessionIdx, reviews, grades, stats, cefrSel, debouncedSaveDeck, anyModalOpen]
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
      settings: { cefrSel, dailyNew, reversed, darkMode, mnemonicLangs },
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
  }, [cards, stats, cefrSel, dailyNew, reversed, darkMode, mnemonicLangs, showFlash]);

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

  const keyHandlers = useMemo(
    () => ({
      " ": revealOrAdvance,
      Enter: revealOrAdvance,
      "1": () => grade(0),
      "2": () => grade(3),
      "3": () => grade(4),
      "4": () => grade(5),
      c: copyHanzi,
      C: copyHanzi,
      z: undo,
      Z: undo,
      p: speakCurrent,
      P: speakCurrent,
      s: () => { if (!anyModalOpen) setShowStats(true); },
      S: () => { if (!anyModalOpen) setShowStats(true); },
      b: () => { if (!anyModalOpen) setShowBrowse(true); },
      B: () => { if (!anyModalOpen) setShowBrowse(true); },
      "?": () => setShowHelp((v) => !v),
    }),
    [revealOrAdvance, grade, copyHanzi, undo, speakCurrent, anyModalOpen]
  );
  useKeyboard(keyHandlers);

  // --- Computed ---

  const totalNew = cards.filter((c) => c.isNew).length;
  const totalLearned = cards.filter((c) => !c.isNew).length;
  const sessionProgress = session.length > 0 ? ((sessionIdx) / session.length) * 100 : 0;
  const sessionTotal = grades.again + grades.hard + grades.good + grades.easy;
  const accuracy = sessionTotal > 0 ? Math.round(((grades.good + grades.easy) / sessionTotal) * 100) : 0;

  // --- Render ---

  if (phase === "loading") {
    return (
      <div className="app">
        <div className="center-message">Loading...</div>
      </div>
    );
  }

  const darkModeIcon = darkMode === "dark" ? "\u263E" : darkMode === "light" ? "\u2600" : "\u25D1";

  return (
    <div className="app">
      <header className="toolbar">
        <div className="toolbar-left">
          <label className="toolbar-field">
            <span>CEFR</span>
            <select value={cefrSel} onChange={(e) => setCefrSel(e.target.value as CefrSelection)}>
              <option value="ALL">ALL</option>
              {CEFR_ORDER.map((l) => (<option key={l} value={l}>{l}</option>))}
            </select>
          </label>
          <label className="toolbar-field">
            <span>New/day</span>
            <input type="number" min={0} max={200} value={dailyNew} onChange={(e) => setDailyNew(Number(e.target.value))} />
          </label>
          <label className="toolbar-check">
            <input type="checkbox" checked={reversed} onChange={() => setReversed(!reversed)} />
            <span>Hanzi first</span>
          </label>
          {SUPPORTED_LANGUAGES.map(({ key, label }) => (
            <label key={key} className="toolbar-check">
              <input
                type="checkbox"
                checked={mnemonicLangs[key]}
                onChange={() => setMnemonicLangs((m) => ({ ...m, [key]: !m[key] }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="toolbar-right">
          <button className="toolbar-icon" onClick={cycleDarkMode} title={`Theme: ${darkMode}`}>{darkModeIcon}</button>
          <button className="toolbar-icon" onClick={() => setShowHelp(true)} title="Keyboard shortcuts">?</button>
          <button className="toolbar-icon" onClick={() => setShowStats(true)} title="Statistics">&#x2261;</button>
          <button className="toolbar-icon" onClick={() => setShowBrowse(true)} title="Browse cards">&#x1F50D;</button>
          <div className="toolbar-divider" />
          <button className="btn-outline btn-sm" onClick={rebuildSession}>New Session</button>
          <button className="btn-primary btn-sm" onClick={rebuildDeck}>Rebuild Deck</button>
          <div className="toolbar-divider" />
          <span className="toolbar-user" title={user.email}>{user.name}</span>
          <button className="btn-outline btn-sm" onClick={() => authClient.signOut()}>Sign Out</button>
        </div>
      </header>

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
          <div className="done-screen">
            <div className="done-icon">&#127881;</div>
            <h2>Session Complete!</h2>
            {sessionTotal > 0 && (
              <div className="done-stats">
                <p>Reviewed <strong>{sessionTotal}</strong> card{sessionTotal !== 1 ? "s" : ""} in <strong>{formatDuration(Date.now() - sessionStartRef.current)}</strong></p>
                <div className="done-breakdown">
                  <span className="grade-again">Again: {grades.again}</span>
                  <span className="grade-hard">Hard: {grades.hard}</span>
                  <span className="grade-good">Good: {grades.good}</span>
                  <span className="grade-easy">Easy: {grades.easy}</span>
                </div>
                <p className="done-accuracy">Accuracy: <strong>{accuracy}%</strong></p>
              </div>
            )}
            <button className="btn-primary" onClick={rebuildSession}>Start New Session</button>
          </div>
        ) : phase === "ready" ? (
          <div className="done-screen">
            <h2>No data loaded</h2>
            <p>Place <code>mandarin.json</code> in the <code>public/</code> folder and reload.</p>
          </div>
        ) : currentCard ? (
          <>
            <div className="card">
              {reversed ? (
                <div className="card-chinese">
                  <div className="hanzi-row">
                    <span className="hanzi">{currentCard.hanzi}</span>
                    <button className="btn-speak" onClick={() => speak(currentCard.hanzi)} title="Pronounce (P)">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                    </button>
                  </div>
                  <span className="pinyin">{currentCard.pinyin}</span>
                  <MnemonicList card={currentCard} langs={mnemonicLangs} />
                </div>
              ) : (
                <div className="card-meaning">{currentCard.meaning}</div>
              )}
              {revealed && (
                <div className="card-answer">
                  {reversed ? (
                    <div className="card-meaning revealed">{currentCard.meaning}</div>
                  ) : (
                    <div className="card-chinese revealed">
                      <div className="hanzi-row">
                        <span className="hanzi">{currentCard.hanzi}</span>
                        <button className="btn-speak" onClick={() => speak(currentCard.hanzi)} title="Pronounce (P)">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                        </button>
                      </div>
                      <span className="pinyin">{currentCard.pinyin}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="card-meta">
                <span>{currentCard.cefr || "?"}</span><span>&middot;</span><span>{currentCard.pos}</span><span>&middot;</span>
                <span>freq #{currentCard.freq.toLocaleString()}</span>
                {currentCard.isNew && <span className="badge-new">NEW</span>}
                {currentCard.lapses >= 4 && <span className="badge-leech">LEECH</span>}
              </div>
            </div>
            <div className="controls">
              <div className="progress-text">{sessionIdx + 1} / {session.length} &middot; Reviewed: {reviews}</div>
              {!revealed ? (
                <button className="btn-reveal" onClick={revealOrAdvance}>Reveal <kbd>Space</kbd></button>
              ) : (
                <div className="grade-buttons">
                  {([
                    { q: 0 as Grade, label: "Again", cls: "btn-again" },
                    { q: 3 as Grade, label: "Hard", cls: "btn-hard" },
                    { q: 4 as Grade, label: "Good", cls: "btn-good" },
                    { q: 5 as Grade, label: "Easy", cls: "btn-easy" },
                  ] as const).map(({ q, label, cls }, i) => (
                    <button key={q} className={`btn-grade ${cls}`} onClick={() => grade(q)}>
                      <span className="grade-label">{label}</span>
                      <span className="grade-interval">{formatInterval(previewInterval(currentCard, q))}</span>
                      <kbd>{i + 1}</kbd>
                    </button>
                  ))}
                </div>
              )}
              <div className="secondary-actions">
                <button className="btn-icon" onClick={copyHanzi} title="Copy hanzi (C)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                </button>
                {undoStack.length > 0 && (
                  <button className="btn-icon" onClick={undo} title="Undo (Z)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
                  </button>
                )}
              </div>
            </div>
          </>
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
