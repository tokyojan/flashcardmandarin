#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HSK/Mandarin Flashcards (JSON-based)
Download: https://github.com/vbvss199/Language-Learning-decks/blob/main/mandarin/mandarin.json
Save it inside the project folder.
"""

from __future__ import annotations

import json
import os
import re
import datetime as dt
from dataclasses import dataclass, asdict, field
from typing import List, Dict, Optional

# ---------------------------
# Config
# ---------------------------

JSON_FILE = "mandarin.json"
DECK_FILE = "deck_mandarin.json"
FILTER_FINGERPRINT_FILE = "deck_filters.txt"

# Session controls
DAILY_NEW_LIMIT_DEFAULT = 25            # 3 reviews : 1 new interleave

# Dataset filters
ONLY_FLASHCARD_TRUE = True              # only include entries marked useful_for_flashcard == True
MAX_WORDS = 5000                        # cap items after filtering
MAX_CEFR: Optional[str] = "A1"          # e.g., "A1", "A2", "B1", ... or None for all
EXCLUDE_POS = set()                     # e.g., {"particle", "interjection"}

CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]


# ---------------------------
# Data model
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

    # SM-2 scheduling
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
        return Card(**d)


# ---------------------------
# Utility helpers
# ---------------------------

def _fingerprint() -> str:
    """A small text fingerprint so we can auto-rebuild the deck if filters changed."""
    parts = [
        f"ONLY_FLASHCARD_TRUE={ONLY_FLASHCARD_TRUE}",
        f"MAX_WORDS={MAX_WORDS}",
        f"MAX_CEFR={MAX_CEFR or 'None'}",
        f"EXCLUDE_POS={','.join(sorted(EXCLUDE_POS)) if EXCLUDE_POS else 'None'}",
        f"JSON_FILE_MTIME={os.path.getmtime(JSON_FILE) if os.path.exists(JSON_FILE) else 'NA'}",
    ]
    return "|".join(parts)

def _read_fingerprint_file() -> str:
    try:
        with open(FILTER_FINGERPRINT_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""

def _write_fingerprint_file(sig: str) -> None:
    with open(FILTER_FINGERPRINT_FILE, "w", encoding="utf-8") as f:
        f.write(sig)

def cefr_leq(level: str, cap: str) -> bool:
    """True if CEFR level <= cap. Unknown levels are treated as C2 (exclude under strict caps)."""
    level = (level or "").strip().upper()
    cap = (cap or "").strip().upper()
    # Map unknown to "C2" so strict caps don't accidentally include them
    if level not in CEFR_ORDER:
        level = "C2"
    if cap not in CEFR_ORDER:
        return True  # no valid cap
    return CEFR_ORDER.index(level) <= CEFR_ORDER.index(cap)

def normalize_pinyin(p: str) -> str:
    return re.sub(r"\s+", " ", (p or "").strip())

def normalize_meaning(m: str) -> str:
    m = re.sub(r"\s+", " ", (m or "").strip())
    fixes = {
        "notbig": "not big",
        "torain": "to rain",
        "lasttime": "last time",
        "nexttime": "next time",
        "pleasecomein": "please come in",
        "pleasehaveaseat": "please have a seat",
    }
    for bad, good in fixes.items():
        m = m.replace(bad, good)
    return m


# ---------------------------
# SM-2 scheduling
# ---------------------------

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
# Build deck
# ---------------------------

def load_cards_from_json() -> List[Card]:
    if not os.path.exists(JSON_FILE):
        raise FileNotFoundError(f"Missing dataset: {JSON_FILE}")

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Sort by frequency (assumed ascending rank)
    rows = sorted(data, key=lambda r: (r.get("word_frequency", 10**9)))

    cards: List[Card] = []
    for r in rows:
        if ONLY_FLASHCARD_TRUE and (r.get("useful_for_flashcard") is not True):
            continue

        lvl_raw = (r.get("cefr_level") or "").strip().upper()
        lvl = lvl_raw if lvl_raw in CEFR_ORDER else "C2"  # default unknown to C2
        if MAX_CEFR and not cefr_leq(lvl, MAX_CEFR):
            continue

        pos = (r.get("pos") or "").strip().lower()
        if pos in EXCLUDE_POS:
            continue

        hanzi = (r.get("word") or "").strip()
        pinyin = normalize_pinyin(r.get("romanization") or "")
        meaning = normalize_meaning(r.get("english_translation") or "")

        try:
            freq = int(r.get("word_frequency"))
        except Exception:
            freq = 10**9

        if not (hanzi and pinyin and meaning):
            continue

        cards.append(Card(
            id=0, hanzi=hanzi, pinyin=pinyin, meaning=meaning,
            cefr=lvl, pos=pos or "noun", freq=freq
        ))

        if len(cards) >= MAX_WORDS:
            break

    # Deduplicate on (hanzi, pinyin)
    out: List[Card] = []
    seen = set()
    for c in cards:
        key = (c.hanzi, c.pinyin)
        if key not in seen:
            seen.add(key)
            out.append(c)

    # Renumber ids
    for i, c in enumerate(out, 1):
        c.id = i

    return out


def save_deck(cards: List[Card]) -> None:
    with open(DECK_FILE, "w", encoding="utf-8") as f:
        json.dump([c.as_dict() for c in cards], f, ensure_ascii=False, indent=2)


def load_or_build_deck(force_rebuild: bool = False) -> List[Card]:
    sig = _fingerprint()
    prev_sig = _read_fingerprint_file()

    if force_rebuild or (sig != prev_sig) or (not os.path.exists(DECK_FILE)):
        cards = load_cards_from_json()
        save_deck(cards)
        _write_fingerprint_file(sig)
        return cards

    with open(DECK_FILE, "r", encoding="utf-8") as f:
        return [Card.from_dict(d) for d in json.load(f)]


def build_session(cards: List[Card], daily_new_limit: int) -> List[int]:
    today = dt.date.today().isoformat()
    due_ids = [c.id for c in cards if c.due <= today and not c.is_new]
    new_ids = [c.id for c in cards if c.is_new][:max(0, daily_new_limit)]

    # Prioritize by frequency rank
    due_ids.sort(key=lambda cid: (cards[cid - 1].freq, cid))
    new_ids.sort(key=lambda cid: (cards[cid - 1].freq, cid))

    session: List[int] = []
    i_due = i_new = 0
    while i_due < len(due_ids) or i_new < len(new_ids):
        for _ in range(3):
            if i_due < len(due_ids):
                session.append(due_ids[i_due]); i_due += 1
        if i_new < len(new_ids):
            session.append(new_ids[i_new]); i_new += 1
    return session


# ---------------------------
# UI
# ---------------------------

import tkinter as tk
from tkinter import ttk, messagebox

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Mandarin Flashcards — CEFR Filtered")
        self.geometry("840x540")

        try:
            self.cards: List[Card] = load_or_build_deck(force_rebuild=False)
        except Exception as e:
            messagebox.showerror("Deck error", str(e))
            self.destroy(); return

        self.id2card: Dict[int, Card] = {c.id: c for c in self.cards}

        # State
        self.daily_new = tk.IntVar(value=DAILY_NEW_LIMIT_DEFAULT)
        self.reverse = tk.BooleanVar(value=False)   # False: front=English; True: front=“汉字 — pinyin”
        self.session_ids: List[int] = build_session(self.cards, self.daily_new.get())
        self.idx = -1
        self.revealed = False
        self.reviews_done = 0

        self._build_widgets()
        self._bind_keys()       # <- renamed to avoid clashing with Tk's internal _bind
        self._next_card()

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # -------- UI ----------
    def _build_widgets(self) -> None:
        top = ttk.Frame(self); top.pack(fill="x", padx=12, pady=8)

        ttk.Label(top, text="Daily new:").pack(side="left")
        ttk.Spinbox(top, from_=0, to=200, width=6,
                    textvariable=self.daily_new,
                    command=self._rebuild_session).pack(side="left", padx=(4, 12))

        ttk.Checkbutton(top, text="Reverse (汉字 — pinyin first)",
                        variable=self.reverse, command=self._refresh_card_view).pack(side="left")

        ttk.Button(top, text="Rebuild deck (apply filters)", command=self._rebuild_deck).pack(side="right")
        ttk.Button(top, text="Rebuild today’s session", command=self._rebuild_session).pack(side="right", padx=(0, 8))

        # Card area
        box = ttk.LabelFrame(self, text="Card")
        box.pack(fill="both", expand=True, padx=12, pady=8)

        self.front_label = ttk.Label(box, font=("Helvetica", 19), wraplength=780,
                                     anchor="center", justify="center")
        self.front_label.pack(expand=True, pady=(24, 10))

        self.back_label = ttk.Label(box, font=("Helvetica", 22, "bold"), foreground="#1a73e8",
                                    wraplength=780, anchor="center", justify="center")
        self.back_label.pack(expand=True, pady=(0, 10))

        self.meta_label = ttk.Label(box, font=("Helvetica", 11), foreground="#666")
        self.meta_label.pack()

        bottom = ttk.Frame(self); bottom.pack(fill="x", padx=12, pady=8)

        self.progress = tk.StringVar(value="")
        ttk.Label(bottom, textvariable=self.progress).pack(side="left")

        self.btn_copy = ttk.Button(bottom, text="📋 Copy Character (C)", command=self._copy_hanzi)
        self.btn_copy.pack(side="right", padx=(8, 0))

        self.btn_reveal = ttk.Button(bottom, text="Reveal (Space)", command=self._toggle_reveal)
        self.btn_reveal.pack(side="right")

        gb = ttk.Frame(bottom); gb.pack(side="right", padx=12)
        self.btn_again = ttk.Button(gb, text="Again (1)", command=lambda: self._grade(0))
        self.btn_hard  = ttk.Button(gb, text="Hard (2)",  command=lambda: self._grade(3))
        self.btn_good  = ttk.Button(gb, text="Good (3)",  command=lambda: self._grade(4))
        self.btn_easy  = ttk.Button(gb, text="Easy (4)",  command=lambda: self._grade(5))
        for b in (self.btn_again, self.btn_hard, self.btn_good, self.btn_easy):
            b.pack(side="left", padx=4)

    def _bind_keys(self) -> None:
        """Keyboard shortcuts (avoid naming this `_bind`, which collides with Tk internals)."""
        self.bind("<space>",  lambda e: self._toggle_reveal())
        self.bind("<Return>", lambda e: self._toggle_reveal())
        self.bind("1",        lambda e: self._grade(0))
        self.bind("2",        lambda e: self._grade(3))
        self.bind("3",        lambda e: self._grade(4))
        self.bind("4",        lambda e: self._grade(5))
        self.bind("c",        lambda e: self._copy_hanzi())
        self.bind("C",        lambda e: self._copy_hanzi())

    # -------- Deck/session flow ----------
    def _rebuild_deck(self) -> None:
        """Force deck rebuild (e.g., after changing MAX_CEFR)."""
        try:
            self.cards = load_or_build_deck(force_rebuild=True)
            self.id2card = {c.id: c for c in self.cards}
            self._rebuild_session()
            messagebox.showinfo("Deck", "Deck rebuilt with current filters.")
        except Exception as e:
            messagebox.showerror("Deck rebuild failed", str(e))

    def _rebuild_session(self) -> None:
        self.session_ids = build_session(self.cards, self.daily_new.get())
        self.idx = -1
        self.reviews_done = 0
        self._next_card()

    def _next_card(self) -> None:
        self.idx += 1
        if self.idx >= len(self.session_ids):
            self.front_label.config(text="🎉 All done for today")
            self.back_label.config(text="")
            self.meta_label.config(text="")
            self.progress.set(f"Session complete • Reviews: {self.reviews_done}")
            for b in (self.btn_again, self.btn_hard, self.btn_good, self.btn_easy):
                b.config(state="disabled")
            self.btn_reveal.config(state="disabled")
            self.btn_copy.config(state="disabled")
            return

        self.revealed = False
        card = self.id2card[self.session_ids[self.idx]]

        if not self.reverse.get():
            # Front: English; Reveal: “汉字 — pinyin”
            self.front_label.config(text=card.meaning)
            self.back_label.config(text="")
        else:
            # Front: “汉字 — pinyin”; Reveal: English
            self.front_label.config(text=f"{card.hanzi} — {card.pinyin}")
            self.back_label.config(text="")

        self.meta_label.config(text=f"CEFR: {card.cefr} • POS: {card.pos} • Freq#: {card.freq}")
        self.progress.set(f"Card {self.idx+1}/{len(self.session_ids)} • Reviews: {self.reviews_done}")

        # Disable grade until reveal; copy is always available
        for b in (self.btn_again, self.btn_hard, self.btn_good, self.btn_easy):
            b.config(state="disabled")
        self.btn_reveal.config(state="normal")
        self.btn_copy.config(state="normal")

    def _toggle_reveal(self) -> None:
        """SPACE/ENTER: first press reveals; second press advances."""
        if not (0 <= self.idx < len(self.session_ids)):
            return
        card = self.id2card[self.session_ids[self.idx]]

        if not self.revealed:
            # FIRST press → REVEAL
            if not self.reverse.get():
                self.back_label.config(text=f"{card.hanzi} — {card.pinyin}")
            else:
                self.back_label.config(text=card.meaning)
            self.revealed = True
            for b in (self.btn_again, self.btn_hard, self.btn_good, self.btn_easy):
                b.config(state="normal")
        else:
            # SECOND press → NEXT
            self._next_card()

    def _grade(self, q: int) -> None:
        if not self.revealed:
            return
        card = self.id2card[self.session_ids[self.idx]]
        schedule_sm2(card, q)
        self.reviews_done += 1
        save_deck(self.cards)
        self._next_card()

    def _refresh_card_view(self) -> None:
        if 0 <= self.idx < len(self.session_ids):
            self.revealed = False
            self._next_card()

    # -------- Copy helpers ----------
    def _copy_hanzi(self) -> None:
        if not (0 <= self.idx < len(self.session_ids)):
            return
        card = self.id2card[self.session_ids[self.idx]]
        self.clipboard_clear()
        self.clipboard_append(card.hanzi)

    def _on_close(self) -> None:
        save_deck(self.cards)
        self.destroy()

    # Keep old name for compatibility if something calls it; delegate to _on_close
    def _on_close_compat(self) -> None:
        self._on_close()

    # Alias used in __init__
    def _on_close(self) -> None:
        save_deck(self.cards)
        self.destroy()


# ---------------------------
# Entrypoint
# ---------------------------

if __name__ == "__main__":
    # Build and run
    App().mainloop()
