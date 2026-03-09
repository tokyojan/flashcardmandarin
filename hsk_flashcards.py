#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mandarin Flashcards (JSON-based)
- Source: mandarin.json (word, romanization, english_translation, cefr_level, pos, useful_for_flashcard, word_frequency)
- Front: English • Reveal: “汉字 — pinyin” (Reverse toggle available)
- Audio removed
- Copy: Chinese-only (button + 'C' shortcut)
- Space/Enter behave exactly like the Reveal button (no double-trigger)
- SM-2 scheduling (Again/Hard/Good/Easy)
- Daily new limit interleaving (3 reviews : 1 new)
"""

from __future__ import annotations

import json, os, re, datetime as dt
from dataclasses import dataclass, asdict, field
from typing import List, Dict, Optional

# ---------------------------
# CONFIG
# ---------------------------

JSON_FILE = "mandarin.json"
DECK_FILE = "deck_mandarin.json"

DAILY_NEW_LIMIT_DEFAULT = 15
ONLY_FLASHCARD_TRUE = True
MAX_WORDS = 5000
MAX_CEFR: Optional[str] = "A1"  # "A1","A2","B1","B2","C1","C2" or None
EXCLUDE_POS = set()  # e.g., {"particle","interjection"}

CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]


# ---------------------------
# DATA
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
    # SM-2
    ease: float = 2.5
    interval: int = 0
    reps: int = 0
    lapses: int = 0
    due: str = field(default_factory=lambda: dt.date.today().isoformat())
    is_new: bool = True

    def as_dict(self) -> Dict: return asdict(self)

    @staticmethod
    def from_dict(d: Dict) -> "Card": return Card(**d)


# ---------------------------
# HELPERS
# ---------------------------

def cefr_leq(level: str, cap: str) -> bool:
    """True if CEFR level <= cap. Unknown -> treat as C2 (hard) so strict caps exclude them."""
    level = (level or "").strip().upper()
    cap = (cap or "").strip().upper()
    if cap not in CEFR_ORDER: return True
    if level not in CEFR_ORDER: level = "C2"
    return CEFR_ORDER.index(level) <= CEFR_ORDER.index(cap)


def normalize_pinyin(p: str) -> str:
    """Collapse extra spaces safely; keep as a general safeguard."""
    return re.sub(r"\s+", " ", (p or "").strip())


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
# DECK BUILD
# ---------------------------

def load_cards_from_json() -> List[Card]:
    if not os.path.exists(JSON_FILE):
        raise FileNotFoundError(JSON_FILE)
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = sorted(data, key=lambda r: (r.get("word_frequency", 10 ** 9)))
    out: List[Card] = []

    for r in rows:
        if ONLY_FLASHCARD_TRUE and not r.get("useful_for_flashcard"):
            continue

        lvl_raw = (r.get("cefr_level") or "").strip().upper()
        lvl = lvl_raw if lvl_raw in CEFR_ORDER else "C2"
        if MAX_CEFR and not cefr_leq(lvl, MAX_CEFR):
            continue

        pos = (r.get("pos") or "").strip().lower()
        if pos in EXCLUDE_POS:
            continue

        hanzi = (r.get("word") or "").strip()
        pinyin = normalize_pinyin(r.get("romanization") or "")
        # Minimal cleanup for meaning: whitespace collapse only (NO normalize_meaning anymore)
        meaning = " ".join((r.get("english_translation") or "").split())

        try:
            freq = int(r.get("word_frequency"))
        except Exception:
            freq = 10 ** 9

        if not (hanzi and pinyin and meaning):
            continue

        out.append(Card(
            id=0, hanzi=hanzi, pinyin=pinyin, meaning=meaning,
            cefr=lvl, pos=pos or "noun", freq=freq
        ))

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
    return final


def save_deck(cards: List[Card]) -> None:
    with open(DECK_FILE, "w", encoding="utf-8") as f:
        json.dump([c.as_dict() for c in cards], f, ensure_ascii=False, indent=2)


def load_or_build_deck() -> List[Card]:
    if os.path.exists(DECK_FILE):
        with open(DECK_FILE, "r", encoding="utf-8") as f:
            return [Card.from_dict(d) for d in json.load(f)]
    cards = load_cards_from_json()
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
            if i_d < len(due_ids): session.append(due_ids[i_d]); i_d += 1
        if i_n < len(new_ids): session.append(new_ids[i_n]); i_n += 1
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
        self.geometry("840x540")

        try:
            self.cards = load_or_build_deck()
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
        ttk.Label(top, text="Daily new:").pack(side="left")
        ttk.Spinbox(top, from_=0, to=200, width=6, textvariable=self.daily,
                    command=self._rebuild_session, takefocus=0).pack(side="left", padx=(4, 12))
        ttk.Checkbutton(top, text="Reverse (汉字 — pinyin first)",
                        variable=self.reverse, command=self._refresh_view, takefocus=0).pack(side="left")
        ttk.Button(top, text="Rebuild Session", command=self._rebuild_session, takefocus=0).pack(side="right")
        ttk.Button(top, text="Rebuild Deck (apply filters)", command=self._rebuild_deck, takefocus=0).pack(side="right",
                                                                                                           padx=(0, 8))

        box = ttk.LabelFrame(self, text="Card")
        box.pack(fill="both", expand=True, padx=12, pady=8)

        self.front_lbl = ttk.Label(box, font=("Helvetica", 19), wraplength=780,
                                   anchor="center", justify="center")
        self.front_lbl.pack(expand=True, pady=(24, 10))

        self.back_lbl = ttk.Label(box, font=("Helvetica", 22, "bold"), foreground="#1a73e8",
                                  wraplength=780, anchor="center", justify="center")
        self.back_lbl.pack(expand=True, pady=(0, 10))

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
        """Keyboard shortcuts (identical behavior to the buttons)."""

        # Reveal / Next (identical to clicking the Reveal button)
        self.bind_all("<Key-space>", self._on_space)  # Space
        self.bind_all("<Key-Return>", self._on_enter)  # Enter/Return

        # Copy Chinese-only
        self.bind_all("c", lambda e: (self._copy_chinese(), "break"))
        self.bind_all("C", lambda e: (self._copy_chinese(), "break"))

        # Prevent Space from "pressing" the focused Reveal button (Windows/Tk quirk)
        self.btn_reveal.bind("<Key-space>", lambda e: "break")

        # --- Grade with number keys ---
        # Top-row numbers
        self.bind_all("<Key-1>", lambda e: (self._grade(0), "break"))  # Again
        self.bind_all("<Key-2>", lambda e: (self._grade(3), "break"))  # Hard
        self.bind_all("<Key-3>", lambda e: (self._grade(4), "break"))  # Good
        self.bind_all("<Key-4>", lambda e: (self._grade(5), "break"))  # Easy

        # Numpad numbers (if you use the keypad)
        self.bind_all("<Key-KP_1>", lambda e: (self._grade(0), "break"))
        self.bind_all("<Key-KP_2>", lambda e: (self._grade(3), "break"))
        self.bind_all("<Key-KP_3>", lambda e: (self._grade(4), "break"))
        self.bind_all("<Key-KP_4>", lambda e: (self._grade(5), "break"))
    # Key handlers → identical to clicking Reveal button
    def _on_space(self, event):
        self._reveal_or_advance()
        return "break"

    def _on_enter(self, event):
        self._reveal_or_advance()
        return "break"

    # --- Flow ---
    def _rebuild_deck(self) -> None:
        try:
            self.cards = load_cards_from_json()
            save_deck(self.cards)
            self.id2 = {c.id: c for c in self.cards}
            self._rebuild_session()
            messagebox.showinfo("Deck", "Deck rebuilt with current filters.")
        except Exception as e:
            messagebox.showerror("Rebuild failed", str(e))

    def _rebuild_session(self) -> None:
        self.session = build_session(self.cards, self.daily.get())
        self.idx = -1
        self.reviews = 0
        self._next_card()

    def _next_card(self) -> None:
        self.idx += 1
        if self.idx >= len(self.session):
            self.front_lbl.config(text="🎉 All done for today")
            self.back_lbl.config(text="")
            self.meta_lbl.config(text="")
            self.progress.set(f"Session complete • Reviews: {self.reviews}")
            for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
                b.config(state="disabled")
            self.btn_reveal.config(state="disabled")
            self.btn_copy.config(state="disabled")
            return

        self.revealed = False
        c = self.id2[self.session[self.idx]]

        if not self.reverse.get():
            self.front_lbl.config(text=c.meaning)
            self.back_lbl.config(text="")
        else:
            self.front_lbl.config(text=f"{c.hanzi} — {c.pinyin}")
            self.back_lbl.config(text="")

        self.meta_lbl.config(text=f"CEFR: {c.cefr} • POS: {c.pos} • Freq#: {c.freq}")
        self.progress.set(f"Card {self.idx + 1}/{len(self.session)}  • Reviews: {self.reviews}")

        for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
            b.config(state="disabled")
        self.btn_reveal.config(state="normal")
        self.btn_copy.config(state="normal")

        # keep focus on the toplevel, not on a button → Space won't "click" a button
        self.focus_set()

    def _reveal_or_advance(self) -> None:
        if not (0 <= self.idx < len(self.session)): return
        c = self.id2[self.session[self.idx]]

        if not self.revealed:
            # Reveal
            if not self.reverse.get():
                self.back_lbl.config(text=f"{c.hanzi} — {c.pinyin}")
            else:
                self.back_lbl.config(text=c.meaning)
            self.revealed = True
            for b in (self.b_again, self.b_hard, self.b_good, self.b_easy):
                b.config(state="normal")
        else:
            # Advance
            self._next_card()

    def _grade(self, q: int) -> None:
        if not self.revealed: return
        c = self.id2[self.session[self.idx]]
        schedule_sm2(c, q)
        self.reviews += 1
        save_deck(self.cards)
        self._next_card()

    def _refresh_view(self) -> None:
        if 0 <= self.idx < len(self.session):
            self.revealed = False
            self._next_card()

    def _copy_chinese(self) -> None:
        if not (0 <= self.idx < len(self.session)): return
        c = self.id2[self.session[self.idx]]
        self.clipboard_clear()
        self.clipboard_append(c.hanzi)

    def _on_close(self) -> None:
        save_deck(self.cards)
        self.destroy()


if __name__ == "__main__":
    App().mainloop()
 