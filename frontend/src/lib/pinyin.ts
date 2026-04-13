/**
 * Pinyin parsing and tone-aware grading.
 *
 * Two input forms are supported:
 *  - Diacritic ("nǐ hǎo")  — used by the dataset
 *  - Numeric  ("ni3 hao3") — what the user types
 *
 * Both convert to a canonical Syllable[] form so they can be compared.
 * `ü` is normalized to `v` (common keyboard convention).
 * Neutral tone is `5` (also accepted as `0` or no digit on input).
 */

export type Syllable = { base: string; tone: number };

const TONE_MAP: Record<string, [string, number]> = {
  "ā": ["a", 1], "á": ["a", 2], "ǎ": ["a", 3], "à": ["a", 4],
  "ē": ["e", 1], "é": ["e", 2], "ě": ["e", 3], "è": ["e", 4],
  "ī": ["i", 1], "í": ["i", 2], "ǐ": ["i", 3], "ì": ["i", 4],
  "ō": ["o", 1], "ó": ["o", 2], "ǒ": ["o", 3], "ò": ["o", 4],
  "ū": ["u", 1], "ú": ["u", 2], "ǔ": ["u", 3], "ù": ["u", 4],
  "ǖ": ["v", 1], "ǘ": ["v", 2], "ǚ": ["v", 3], "ǜ": ["v", 4],
};

function parseDiacriticSyllable(syl: string): Syllable {
  let base = "";
  let tone = 5;
  for (const ch of syl) {
    const mapped = TONE_MAP[ch];
    if (mapped) {
      base += mapped[0];
      tone = mapped[1];
    } else if (ch === "ü") {
      base += "v";
    } else {
      base += ch;
    }
  }
  return { base, tone };
}

export function parseDiacriticPinyin(pinyin: string): Syllable[] {
  return pinyin
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseDiacriticSyllable);
}

/**
 * Parse user input. Accepts spaces or no spaces between syllables.
 * Examples: "ni3hao3", "ni3 hao3", "ni hao", "ni3 hao".
 */
export function parseNumberedPinyin(input: string): Syllable[] {
  const cleaned = input.toLowerCase().trim().replace(/ü/g, "v").replace(/u:/g, "v");
  if (!cleaned) return [];

  const tokens: string[] = [];
  let current = "";
  for (const ch of cleaned) {
    if (/\s/.test(ch)) {
      if (current) { tokens.push(current); current = ""; }
    } else if (/\d/.test(ch)) {
      current += ch;
      tokens.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return tokens.map((t) => {
    const m = t.match(/^([a-zv]+)(\d?)$/);
    if (!m) return { base: t, tone: 0 };
    const tone = m[2] === "" ? 5 : Number(m[2]) === 0 ? 5 : Number(m[2]);
    return { base: m[1], tone };
  });
}

export type SyllableEval = {
  expected: Syllable;
  got: Syllable;
  baseCorrect: boolean;
  toneCorrect: boolean;
};

export type PinyinEval = {
  syllables: SyllableEval[];
  charactersCorrect: boolean;
  tonesCorrect: boolean;
  fullyCorrect: boolean;
};

export function evaluatePinyin(input: string, expected: string): PinyinEval {
  const got = parseNumberedPinyin(input);
  const exp = parseDiacriticPinyin(expected);
  const len = Math.max(got.length, exp.length);

  const syllables: SyllableEval[] = [];
  let charactersCorrect = exp.length === got.length;
  let tonesCorrect = exp.length === got.length;

  for (let i = 0; i < len; i++) {
    const e = exp[i] ?? { base: "", tone: 0 };
    const g = got[i] ?? { base: "", tone: 0 };
    const baseCorrect = !!e.base && e.base === g.base;
    const toneCorrect = baseCorrect && e.tone === g.tone;
    if (!baseCorrect) charactersCorrect = false;
    if (!toneCorrect) tonesCorrect = false;
    syllables.push({ expected: e, got: g, baseCorrect, toneCorrect });
  }

  return {
    syllables,
    charactersCorrect,
    tonesCorrect,
    fullyCorrect: charactersCorrect && tonesCorrect,
  };
}

/** Render a syllable as a display string (e.g. {base:"ni",tone:3} → "nǐ") */
const TONE_VOWELS: Record<string, string[]> = {
  // [neutral, 1st, 2nd, 3rd, 4th]
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  v: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

export function syllableToDiacritic(s: Syllable): string {
  if (!s.base) return "";
  if (s.tone < 1 || s.tone > 4) {
    // neutral — render `v` as `ü`
    return s.base.replace(/v/g, "ü");
  }
  // Choose vowel to mark per standard rules: a > o > e > (i/u: last one wins)
  const base = s.base;
  const order = ["a", "o", "e"];
  let target = -1;
  for (const v of order) {
    const idx = base.indexOf(v);
    if (idx !== -1) { target = idx; break; }
  }
  if (target === -1) {
    // i or u or v — pick the LAST one
    for (let i = base.length - 1; i >= 0; i--) {
      if ("iuv".includes(base[i])) { target = i; break; }
    }
  }
  if (target === -1) return base.replace(/v/g, "ü");
  const ch = base[target];
  const replacement = TONE_VOWELS[ch]?.[s.tone] ?? ch;
  return (base.slice(0, target) + replacement + base.slice(target + 1)).replace(/v/g, "ü");
}

export function pinyinToDiacritic(syllables: Syllable[]): string {
  return syllables.map(syllableToDiacritic).join(" ");
}

/** Confusion-key for tone errors. e.g. expected 3, got 1 → "3->1". */
export function toneConfusionKey(expected: number, got: number): string {
  return `${expected}->${got}`;
}
