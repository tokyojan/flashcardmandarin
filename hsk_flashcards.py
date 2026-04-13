#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mandarin Flashcards (JSON-based) — Exact CEFR Filtering + Mnemonics (EN/IT) + Debug Mode + Backups

- Data source: deck/mandarin.json (fields: word, romanization, english_translation, cefr_level, pos,
  useful_for_flashcard, word_frequency)
- Mnemonics source: mandarin_with_pinyin_mnemonics.json (keys include: word, romanization, english, italian)
- Front: English • Reveal: “汉字 — pinyin” (Reverse toggle available)
- Mnemonics: show suggestions below pinyin, user can enable English/Italian (default both ON)
- Copy: Chinese-only (button + 'C' shortcut)
- Space/Enter behave exactly like Reveal (no double-trigger)
- Grade with 1/2/3/4 (Again/Hard/Good/Easy), incl. numpad keys
- Daily new interleaving (3 reviews : 1 new)
- CEFR dropdown (ALL, A1..C2) with EXACT selection:
    * A1 → only A1
    * A2 → only A2
    * ...
    * ALL → include every item (all labels + unknown)
- Debug Mode: shows a detailed filter report and prints it to console
- Automatic backups in deck_backups/ (stable + timestamped, with retention)

No audio. No pinyin-copy. No normalize_meaning.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import datetime as dt
from dataclasses import dataclass, asdict, field, fields as dc_fields
from typing import Dict, List, Optional, Tuple

# ---------------------------
# CONFIG
# ---------------------------

JSON_FILE = "deck/mandarin.json"
DECK_FILE = "deck_mandarin.json"

# Mnemonics (pinyin memory hints)
MNEMONICS_FILE = "mandarin_with_pinyin_mnemonics.json"

# Backups
BACKUP_DIR = "deck_backups"
BACKUP_RETENTION = 30  # keep N latest timestamped backups

# Session controls
DAILY_NEW_LIMIT_DEFAULT = 5

# Dataset filters (defaults)
ONLY_FLASHCARD_TRUE = True
MAX_WORDS = 5000  # maximum rows to ingest
EXCLUDE_POS = set()  # e.g., {"particle","interjection"} to skip

CEFR_DEFAULT = "A1"
CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]

# ---------------------------
# DATA MODEL
# ---------------------------

@dataclass
class Card:
    id: int
    pinyin: str
    meaning: str
    hanzi: str
    cefr: str
    pos: str
    freq: int

    # Mnemonics (new fields; default empty for backward compatibility)
    mnemonic_english: str = ""
    mnemonic_italian: str = ""

    # SM-2
    ease: float = 2.5
    interval: int = 0
    reps: int = 0
    lapses: int = 0
    due: str = field(default_factory=lambda: dt.date.today().isoformat())
    is_new: bool = True

    def as_dict(self) -> Dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: Dict) -> "Card":
        """Backward/forward compatible loader: ignore unknown keys, allow missing new keys."""
        allowed = {f.name for f in dc_fields(Card)}
        filtered = {k: v for k, v in (d or {}).items() if k in allowed}
        return Card(**filtered)


# ---------------------------
# HELPERS
# ---------------------------

def cefr_exact_match(level: str, selection: str) -> bool:
    """
    Exact CEFR selection:
      - selection == "ALL" (or invalid) -> include everything
      - otherwise include only rows whose level exactly equals selection (A1..C2)
      - unknown/missing levels are excluded for specific selections
    """
    sel = (selection or "").strip().upper()
    if sel not in CEFR_ORDER:
        # ALL or invalid -> include everything
        return True
    lvl = (level or "").strip().upper()
    return lvl == sel


def normalize_pinyin(p: str) -> str:
    """Collapse extra spaces safely; lightweight normalization."""
    return re.sub(r"\s+", " ", (p or "").strip())


def normalize_pinyin_key(p: str) -> str:
    """Normalization used for lookups; keep diacritics but normalize spacing + case."""
    return normalize_pinyin(p).lower()


def schedule_sm2(card: Card, q: int) -> None:
    q = max(0, min(5, q))
    card.ease = max(1.3, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
    if q < 3:
        card.reps = 0
        card.lapses += 1
        card.interval = 1
    else:
        card.reps += 1
        if card.reps == 1:
            card.interval = 1
        elif card.reps == 2:
            card.interval = 6
        else:
            card.interval = int(round(card.interval * card.ease))
    card.due = (dt.date.today() + dt.timedelta(days=card.interval)).isoformat()
    card.is_new = False


# ---------------------------
# BACKUPS
# ---------------------------

def backup_deck_file() -> None:
    """Write stable + timestamped backups; prune older timestamped copies."""
    try:
        if not os.path.exists(DECK_FILE):
            return
        os.makedirs(BACKUP_DIR, exist_ok=True)
        # stable
        stable_path = os.path.join(BACKUP_DIR, "deck_mandarin.backup.json")
        shutil.copy2(DECK_FILE, stable_path)
        # timestamped
        ts = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        ts_path = os.path.join(BACKUP_DIR, f"deck_{ts}.json")
        shutil.copy2(DECK_FILE, ts_path)
        # retention
        entries = []
        for name in os.listdir(BACKUP_DIR):
            if name.startswith("deck_") and name.endswith(".json"):
                full = os.path.join(BACKUP_DIR, name)
                try:
                    entries.append((os.path.getmtime(full), full))
                except Exception:
                    pass
        entries.sort(key=lambda x: x[0], reverse=True)
        for _, old_path in entries[BACKUP_RETENTION:]:
            try:
                os.remove(old_path)
            except Exception:
                pass
    except Exception:
        pass  # never break save flow


# ---------------------------
# MNEMONICS LOADER (cached)
# ---------------------------

_MNEMONICS_CACHE: Optional[Dict[Tuple[str, str], Tuple[str, str]]] = None
_MNEMONICS_WORD_ONLY: Optional[Dict[str, Tuple[str, str]]] = None


def load_mnemonics_index() -> Tuple[Dict[Tuple[str, str], Tuple[str, str]], Dict[str, Tuple[str, str]]]:
    """
    Build lookup tables from MNEMONICS_FILE:
      - primary: (hanzi_word, normalized_pinyin) -> (english_mnemonic, italian_mnemonic)
      - fallback: hanzi_word -> (english_mnemonic, italian_mnemonic)  (first seen)
    Cached for runtime.
    """
    global _MNEMONICS_CACHE, _MNEMONICS_WORD_ONLY
    if _MNEMONICS_CACHE is not None and _MNEMONICS_WORD_ONLY is not None:
        return _MNEMONICS_CACHE, _MNEMONICS_WORD_ONLY

    idx: Dict[Tuple[str, str], Tuple[str, str]] = {}
    word_only: Dict[str, Tuple[str, str]] = {}

    if not os.path.exists(MNEMONICS_FILE):
        _MNEMONICS_CACHE, _MNEMONICS_WORD_ONLY = idx, word_only
        return idx, word_only

    try:
        with open(MNEMONICS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        for r in data:
            w = (r.get("word") or "").strip()
            if not w:
                continue
            py = normalize_pinyin_key(r.get("romanization") or "")
            en = (r.get("english") or "").strip()
            it = (r.get("italian") or "").strip()
            if py:
                idx[(w, py)] = (en, it)
            if w not in word_only:
                word_only[w] = (en, it)
    except Exception:
        # Fail safe: no mnemonics rather than crashing
        idx, word_only = {}, {}

    _MNEMONICS_CACHE, _MNEMONICS_WORD_ONLY = idx, word_only
    return idx, word_only


def attach_mnemonics_to_card(card: Card) -> None:
    """Populate mnemonic fields if empty, using MNEMONICS_FILE index."""
    if (card.mnemonic_english or "").strip() or (card.mnemonic_italian or "").strip():
        return
    idx, word_only = load_mnemonics_index()
    key = (card.hanzi.strip(), normalize_pinyin_key(card.pinyin))
    pair = idx.get(key) or word_only.get(card.hanzi.strip())
    if pair:
        card.mnemonic_english, card.mnemonic_italian = pair[0], pair[1]


def enrich_deck_with_mnemonics(cards: List[Card]) -> bool:
    """
    Ensure all cards have mnemonic fields present (maybe empty strings).
    Fill from MNEMONICS_FILE if available. Returns True if any card changed.
    """
    changed = False
    for c in cards:
        before_en = (c.mnemonic_english or "").strip()
        before_it = (c.mnemonic_italian or "").strip()
        attach_mnemonics_to_card(c)
        after_en = (c.mnemonic_english or "").strip()
        after_it = (c.mnemonic_italian or "").strip()
        if before_en != after_en or before_it != after_it:
            changed = True
    return changed


# ---------------------------
# DEBUG REPORT
# ---------------------------

def format_debug_report(
    raw_total: int,
    before_counts: Dict[str, int],
    before_unknown: int,
    excl_useful: int,
    excl_pos: int,
    excl_cefr: int,
    excl_missing: int,
    after_counts: Dict[str, int],
    after_unknown: int,
    cefr_sel: str,
    sample_kept: List[Tuple[str, str, str, int]]  # (hanzi, pinyin, cefr, freq)
) -> str:
    lines = []
    lines.append("=== Deck Rebuild Debug Report ===")
    lines.append(f"CEFR selection (EXACT): {cefr_sel}")
    lines.append("")
    lines.append(f"Raw rows read: {raw_total}")
    lines.append("Before filtering (by CEFR tags found):")
    for k in CEFR_ORDER:
        lines.append(f"  {k}: {before_counts.get(k, 0)}")
    lines.append(f"  Unknown: {before_unknown}")
    lines.append("")
    lines.append("Exclusions:")
    lines.append(f"  Not useful_for_flashcard: {excl_useful}")
    lines.append(f"  POS excluded:              {excl_pos}")
    lines.append(f"  CEFR not exact match:      {excl_cefr}")
    lines.append(f"  Missing core fields:       {excl_missing}")
    lines.append("")
    lines.append("After filtering (kept):")
    kept_total = sum(after_counts.values()) + after_unknown
    for k in CEFR_ORDER:
        lines.append(f"  {k}: {after_counts.get(k, 0)}")
    lines.append(f"  Unknown: {after_unknown}")
    lines.append(f"TOTAL kept: {kept_total}")
    lines.append("")
    if sample_kept:
        lines.append("Sample kept items (Hanzi — Pinyin | CEFR | Freq):")
        for hanzi, pinyin, cefr, freq in sample_kept[:20]:
            lines.append(f"  {hanzi} — {pinyin} | {cefr or 'Unknown'} | {freq}")
    return "\n".join(lines)


# ---------------------------
# DECK BUILD
# ---------------------------

def load_cards_from_json(
    cefr_selection: str,
    debug: bool = False
) -> Tuple[List[Card], Optional[str]]:
    """
    Build cards from JSON applying EXACT CEFR selection.
    Adds mnemonic fields from MNEMONICS_FILE if available.
    Returns (cards, debug_report or None).
    """
    if not os.path.exists(JSON_FILE):
        raise FileNotFoundError(JSON_FILE)
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Pre-counts
    raw_total = len(data)
    before_counts: Dict[str, int] = {k: 0 for k in CEFR_ORDER}
    before_unknown = 0
    for r in data:
        lvl = (r.get("cefr_level") or "").strip().upper()
        if lvl in CEFR_ORDER:
            before_counts[lvl] += 1
        else:
            before_unknown += 1

    rows = sorted(data, key=lambda r: (r.get("word_frequency", 10 ** 9)))
    out: List[Card] = []
    excl_useful = excl_pos = excl_cefr = excl_missing = 0

    for r in rows:
        # useful_for_flashcard filter
        if ONLY_FLASHCARD_TRUE and not r.get("useful_for_flashcard"):
            excl_useful += 1
            continue

        lvl = (r.get("cefr_level") or "").strip().upper()
        if not cefr_exact_match(lvl, cefr_selection):
            excl_cefr += 1
            continue

        pos = (r.get("pos") or "").strip().lower()
        if pos in EXCLUDE_POS:
            excl_pos += 1
            continue

        hanzi = (r.get("word") or "").strip()
        pinyin = normalize_pinyin(r.get("romanization") or "")
        meaning = " ".join((r.get("english_translation") or "").split())  # whitespace-only
        try:
            freq = int(r.get("word_frequency"))
        except Exception:
            freq = 10 ** 9

        if not (hanzi and pinyin and meaning):
            excl_missing += 1
            continue

        c = Card(
            id=0, hanzi=hanzi, pinyin=pinyin, meaning=meaning,
            cefr=lvl, pos=pos or "noun", freq=freq
        )
        # Attach mnemonics (if present in mnemonics file)
        attach_mnemonics_to_card(c)

        out.append(c)

        if len(out) >= MAX_WORDS:
            break

    # Deduplicate on (hanzi, pinyin)
    final: List[Card] = []
    seen = set()
    for c in out:
        key = (c.hanzi, c.pinyin)
        if key not in seen:
            seen.add(key)
            final.append(c)

    for i, c in enumerate(final, 1):
        c.id = i

    # After-counts
    after_counts: Dict[str, int] = {k: 0 for k in CEFR_ORDER}
    after_unknown = 0
    for c in final:
        if c.cefr in CEFR_ORDER:
            after_counts[c.cefr] += 1
        else:
            after_unknown += 1

    debug_report = None
    if debug:
        sample_kept = [(c.hanzi, c.pinyin, c.cefr, c.freq) for c in final[:50]]
        debug_report = format_debug_report(
            raw_total=raw_total,
            before_counts=before_counts,
            before_unknown=before_unknown,
            excl_useful=excl_useful,
            excl_pos=excl_pos,
            excl_cefr=excl_cefr,
            excl_missing=excl_missing,
            after_counts=after_counts,
            after_unknown=after_unknown,
            cefr_sel=cefr_selection,
            sample_kept=sample_kept
        )

    return final, debug_report


def save_deck(cards: List[Card]) -> None:
    with open(DECK_FILE, "w", encoding="utf-8") as f:
        json.dump([c.as_dict() for c in cards], f, ensure_ascii=False, indent=2)
    backup_deck_file()  # always back up after save


def load_or_build_deck(cefr_sel: str) -> List[Card]:
    """Load existing deck if present; if missing, build with CEFR selection."""
    if os.path.exists(DECK_FILE):
        with open(DECK_FILE, "r", encoding="utf-8") as f:
            cards = [Card.from_dict(d) for d in json.load(f)]
        # Auto-enrich existing progress deck with mnemonic fields (save once if changed)
        if enrich_deck_with_mnemonics(cards):
            save_deck(cards)
        return cards

    cards, _ = load_cards_from_json(cefr_sel, debug=False)
    save_deck(cards)
    return cards


def build_session(cards: List[Card], daily_new_limit: int) -> List[int]:
    today = dt.date.today().isoformat()
    due_ids = [c.id for c in cards if c.due <= today and not c.is_new]
    new_ids = [c.id for c in cards if c.is_new][:max(0, daily_new_limit)]
    due_ids.sort(key=lambda cid: (cards[cid - 1].freq, cid))
    new_ids.sort(key=lambda cid: (cards[cid - 1].freq, cid))
    session: List[int] = []
    i_d = i_n = 0
    while i_d < len(due_ids) or i_n < len(new_ids):
        for _ in range(3):
            if i_d < len(due_ids):
                session.append(due_ids[i_d])
                i_d += 1
        if i_n < len(new_ids):
            session.append(new_ids[i_n])
            i_n += 1
    return session


# ---------------------------
# UI
# ---------------------------

import tkinter as tk
from tkinter import ttk, messagebox


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Mandarin Flashcards")
        self.geometry("940x640")  # slightly taller to fit mnemonics

        # Runtime filters
        self.cefr_sel = tk.StringVar(value=CEFR_DEFAULT)  # "ALL", or one of CEFR_ORDER
        self.debug_var = tk.BooleanVar(value=False)

        # Mnemonic language toggles (default both ON)
        self.mn_en_var = tk.BooleanVar(value=True)
        self.mn_it_var = tk.BooleanVar(value=True)

        try:
            self.cards = load_or_build_deck(self.cefr_sel.get())
        except Exception as e:
            messagebox.showerror("Deck error", str(e))
            self.destroy()
            return

        self.id2 = {c.id: c for c in self.cards}

        self.daily = tk.IntVar(value=DAILY_NEW_LIMIT_DEFAULT)
        self.reverse = tk.BooleanVar(value=False)  # False: front=English; True: front=“汉字 — pinyin”
        self.session = build_session(self.cards, self.daily.get())
        self.idx = -1
        self.revealed = False
        self.reviews = 0

        self._build_widgets()
        self._bind_keys()
        self._next_card()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # --- UI build ---
    def _build_widgets(self) -> None:
        top = ttk.Frame(self)
        top.pack(fill="x", padx=12, pady=8)

        # CEFR dropdown (EXACT selection)
        ttk.Label(top, text="CEFR (exact):").pack(side="left", padx=(0, 4))
        cefr_values = ["ALL"] + CEFR_ORDER
        self.cefr_box = ttk.Combobox(
            top, width=6, textvariable=self.cefr_sel, values=cefr_values, state="readonly"
        )
        self.cefr_box.pack(side="left", padx=(0, 12))

        ttk.Label(top, text="Daily new:").pack(side="left")
        ttk.Spinbox(
            top, from_=0, to=200, width=6, textvariable=self.daily,
            command=self._rebuild_session, takefocus=0
        ).pack(side="left", padx=(4, 12))

        ttk.Checkbutton(
            top, text="Reverse (汉字 — pinyin first)",
            variable=self.reverse, command=self._refresh_view, takefocus=0
        ).pack(side="left", padx=(0, 12))

        # Mnemonic language toggles
        ttk.Label(top, text="Mnemonics:").pack(side="left", padx=(0, 6))
        ttk.Checkbutton(
            top, text="English", variable=self.mn_en_var,
            command=self._refresh_view, takefocus=0
        ).pack(side="left", padx=(0, 8))
        ttk.Checkbutton(
            top, text="Italian", variable=self.mn_it_var,
            command=self._refresh_view, takefocus=0
        ).pack(side="left", padx=(0, 12))

        ttk.Checkbutton(top, text="Debug Mode", variable=self.debug_var).pack(side="left")

        ttk.Button(
           top, text="Rebuild Deck (apply filters)",
            command=self._rebuild_deck, takefocus=0
        ).pack(side="right")
        ttk.Button(
            top, text="Rebuild Session",
            command=self._rebuild_session, takefocus=0
        ).pack(side="right", padx=(0, 8))

        box = ttk.LabelFrame(self, text="Card")
        box.pack(fill="both", expand=True, padx=12, pady=8)

        self.front_lbl = ttk.Label(
            box, font=("Helvetica", 19), wraplength=880,
            anchor="center", justify="center"
        )
        self.front_lbl.pack(expand=True, pady=(24, 10))

        self.back_lbl = ttk.Label(
            box, font=("Helvetica", 22, "bold"), foreground="#1a73e8",
            wraplength=880, anchor="center", justify="center"
        )
        self.back_lbl.pack(expand=True, pady=(0, 8))

        # Mnemonics label (shown under pinyin)
        self.mnemo_lbl = ttk.Label(
            box, font=("Helvetica", 12), foreground="#444",
            wraplength=880, anchor="center", justify="center"
        )
        self.mnemo_lbl.pack(expand=False, pady=(0, 10))

        self.meta_lbl = ttk.Label(box, font=("Helvetica", 11), foreground="#666")
        self.meta_lbl.pack()

        bottom = ttk.Frame(self)
        bottom.pack(fill="x", padx=12, pady=8)
        self.progress = tk.StringVar(value="")
        ttk.Label(bottom, textvariable=self.progress).pack(side="left")

        self.btn_copy = ttk.Button(bottom, text="📋 Copy Chinese (C)", command=self._copy_chinese, takefocus=0)
        self.btn_copy.pack(side="right", padx=(8, 0))
        self.btn_reveal = ttk.Button(bottom, text="Reveal (Space)", command=self._reveal_or_advance, takefocus=0)
        self.btn_reveal.pack(side="right")

        gb = ttk.Frame(bottom)
        gb.pack(side="right", padx=12)
        self.b_again = ttk.Button(gb, text="Again (1)", command=lambda: self._grade(0), takefocus=0)
        self.b_hard = ttk.Button(gb, text="Hard (2)", command=lambda: self._grade(3), takefocus=0)
        self.b_good = ttk.Button(gb, text="Good (3)", command=lambda: self._grade(4), takefocus=0)
        self.b_easy = ttk.Button(gb, text="Easy (4)", command=lambda: self._grade(5), takefocus=0)
        for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
            b.pack(side="left", padx=4)

    def _bind_keys(self) -> None:
        # Space/Enter behave exactly like clicking Reveal (stop propagation with "break")
        self.bind_all("<Key-space>", self._on_space)
        self.bind_all("<Key-Return>", self._on_enter)
        # Copy Hanzi
        self.bind_all("c", self._on_copy)
        self.bind_all("C", self._on_copy)
        # Prevent Space from "clicking" the Reveal button
        self.btn_reveal.bind("<Key-space>", lambda e: "break")
        # Numeric grading keys (top row + numpad)
        self.bind_all("<Key-1>", self._on_grade_1)
        self.bind_all("<Key-2>", self._on_grade_2)
        self.bind_all("<Key-3>", self._on_grade_3)
        self.bind_all("<Key-4>", self._on_grade_4)
        self.bind_all("<Key-KP_1>", self._on_grade_1)
        self.bind_all("<Key-KP_2>", self._on_grade_2)
        self.bind_all("<Key-KP_3>", self._on_grade_3)
        self.bind_all("<Key-KP_4>", self._on_grade_4)

    # Key handlers that ALWAYS return "break"
    def _on_space(self, event):
        self._reveal_or_advance()
        return "break"

    def _on_enter(self, event):
        self._reveal_or_advance()
        return "break"

    def _on_copy(self, event):
        self._copy_chinese()
        return "break"

    def _on_grade_1(self, e):
        self._grade(0)
        return "break"  # Again

    def _on_grade_2(self, e):
        self._grade(3)
        return "break"  # Hard

    def _on_grade_3(self, e):
        self._grade(4)
        return "break"  # Good

    def _on_grade_4(self, e):
        self._grade(5)
        return "break"  # Easy

    # --- Mnemonics formatting ---
    def _format_mnemonics(self, c: Card, pinyin_is_visible: bool) -> str:
        """
        Show mnemonics only when pinyin is visible on screen (as requested).
        If no language is selected or no mnemonics exist, return empty string.
        """
        if not pinyin_is_visible:
            return ""

        parts = []
        if self.mn_en_var.get():
            txt = (c.mnemonic_english or "").strip()
            if txt:
                parts.append(f"EN: {txt}")
        if self.mn_it_var.get():
            txt = (c.mnemonic_italian or "").strip()
            if txt:
                parts.append(f"IT: {txt}")

        return "\n\n".join(parts).strip()

    # --- Flow helpers ---
    def _render_current(self) -> None:
        """Render current card without changing idx."""
        if not (0 <= self.idx < len(self.session)):
            return

        c = self.id2[self.session[self.idx]]

        # Determine which side shows pinyin currently
        # - Normal mode: pinyin shows only after reveal (on back label).
        # - Reverse mode: pinyin is shown immediately on front label.
        if not self.reverse.get():
            # front = meaning, back = hanzi-pinyin when revealed
            self.front_lbl.config(text=c.meaning)
            if self.revealed:
                self.back_lbl.config(text=f"{c.hanzi} — {c.pinyin}")
                mn = self._format_mnemonics(c, pinyin_is_visible=True)
            else:
                self.back_lbl.config(text="")
                mn = self._format_mnemonics(c, pinyin_is_visible=False)
        else:
            # front = hanzi-pinyin always, back = meaning when revealed
            self.front_lbl.config(text=f"{c.hanzi} — {c.pinyin}")
            mn = self._format_mnemonics(c, pinyin_is_visible=True)
            if self.revealed:
                self.back_lbl.config(text=c.meaning)
            else:
                self.back_lbl.config(text="")

        self.mnemo_lbl.config(text=mn)

        self.meta_lbl.config(text=f"CEFR: {c.cefr or 'Unknown'} • POS: {c.pos} • Freq#: {c.freq}")
        self.progress.set(f"Card {self.idx + 1}/{len(self.session)}  • Reviews: {self.reviews}")

        # Buttons
        if self.revealed:
            for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
                b.config(state="normal")
            self.btn_reveal.config(state="normal")
            self.btn_copy.config(state="normal")
        else:
            for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
                b.config(state="disabled")
            self.btn_reveal.config(state="normal")
            self.btn_copy.config(state="normal")

        self.focus_set()  # avoid Space "clicking" focused button

    def _next_card(self) -> None:
        """Advance idx and render next card or session end."""
        self.idx += 1
        if self.idx >= len(self.session):
            self.front_lbl.config(text="🎉 All done for today")
            self.back_lbl.config(text="")
            self.mnemo_lbl.config(text="")
            self.meta_lbl.config(text="")
            self.progress.set(f"Session complete • Reviews: {self.reviews}")
            for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
                b.config(state="disabled")
            self.btn_reveal.config(state="disabled")
            self.btn_copy.config(state="disabled")
            return

        self.revealed = False
        self._render_current()

    def _reveal_or_advance(self) -> None:
        if not (0 <= self.idx < len(self.session)):
            return

        if not self.revealed:
            self.revealed = True
            self._render_current()
        else:
            self._next_card()

    def _grade(self, q: int) -> None:
        if not self.revealed:
            return
        c = self.id2[self.session[self.idx]]
        schedule_sm2(c, q)
        self.reviews += 1
        save_deck(self.cards)  # also triggers backups
        self._next_card()

    def _refresh_view(self) -> None:
        """Re-render current card without advancing."""
        if 0 <= self.idx < len(self.session):
            # if toggling reverse, keep revealed state but re-render appropriately
            self._render_current()

    # --- Deck & session rebuild ---
    def _rebuild_deck(self) -> None:
        """Apply EXACT CEFR selection and rebuild the deck; show debug if enabled."""
        try:
            cap = self.cefr_sel.get()  # "ALL" or A1..C2
            debug = self.debug_var.get()

            cards, report = load_cards_from_json(cap, debug=debug)
            save_deck(cards)
            self.cards = cards
            self.id2 = {c.id: c for c in self.cards}
            self._rebuild_session()

            if debug and report:
                print("\n" + report + "\n")  # console (IDE-friendly)
                self._show_debug_window(report)  # popup window
            else:
                messagebox.showinfo("Deck", f"Deck rebuilt (CEFR={cap}).")

        except Exception as e:
            messagebox.showerror("Rebuild failed", str(e))

    def _show_debug_window(self, text: str) -> None:
        win = tk.Toplevel(self)
        win.title("Debug Report")
        win.geometry("760x520")
        txt = tk.Text(win, wrap="word")
        txt.insert("1.0", text)
        txt.config(state="disabled")
        txt.pack(fill="both", expand=True)

    def _rebuild_session(self) -> None:
        self.session = build_session(self.cards, self.daily.get())
        self.idx = -1
        self.reviews = 0
        self._next_card()

    # --- Clipboard ---
    def _copy_chinese(self) -> None:
        if not (0 <= self.idx < len(self.session)):
            return
        c = self.id2[self.session[self.idx]]
        self.clipboard_clear()
        self.clipboard_append(c.hanzi)

    def _on_close(self) -> None:
        save_deck(self.cards)
        self.destroy()


if __name__ == "__main__":
    App().mainloop()