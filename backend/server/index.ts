import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { auth } from "../auth";
import { initDb, getAllUserData, setUserData, deleteUserData } from "./db";

type RawEntry = {
  word: string;
  romanization: string;
  english_translation: string;
  cefr_level: string;
  pos: string;
  word_frequency: number | string;
  useful_for_flashcard: boolean;
  english?: string;
  italian?: string;
};

const RAW_DECK: RawEntry[] = JSON.parse(readFileSync("./mandarin.json", "utf-8"));
const CEFR_ORDER = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

const app = new Hono<{
  Variables: { userId: string };
}>();

app.use("*", compress());

app.use(
  "/api/*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// --- Hanzi index (computed once, cached) ---
interface HanziIndexEntry {
  char: string;
  pinyins: string[];
  cefrFirst: string;
  freqMin: number;
  appearsIn: number;
}
let HANZI_INDEX: HanziIndexEntry[] | null = null;
function buildHanziIndex(): HanziIndexEntry[] {
  const map = new Map<string, { pinyins: Set<string>; cefr: string; freq: number; appears: number }>();
  const cefrRank = (l: string) => ["A1", "A2", "B1", "B2", "C1", "C2"].indexOf(l) + 1 || 99;
  for (const row of RAW_DECK) {
    if (!row.useful_for_flashcard) continue;
    const word = (row.word ?? "").trim();
    const py = (row.romanization ?? "").trim();
    const lvl = (row.cefr_level ?? "").trim().toUpperCase();
    const freq = typeof row.word_frequency === "number" ? row.word_frequency : 1e9;
    const sylls = py.split(/\s+/);
    const chars = Array.from(word);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!/\p{Script=Han}/u.test(ch)) continue;
      const existing = map.get(ch);
      const sy = sylls[i] ?? "";
      if (existing) {
        if (sy) existing.pinyins.add(sy);
        if (cefrRank(lvl) < cefrRank(existing.cefr)) existing.cefr = lvl;
        if (freq < existing.freq) existing.freq = freq;
        existing.appears++;
      } else {
        map.set(ch, { pinyins: new Set(sy ? [sy] : []), cefr: lvl, freq, appears: 1 });
      }
    }
  }
  return [...map.entries()]
    .map(([char, v]) => ({ char, pinyins: [...v.pinyins], cefrFirst: v.cefr, freqMin: v.freq, appearsIn: v.appears }))
    .sort((a, b) => a.freqMin - b.freqMin);
}

app.get("/api/hanzi-index", (c) => {
  if (!HANZI_INDEX) HANZI_INDEX = buildHanziIndex();
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(HANZI_INDEX);
});

app.get("/api/grammar", (c) => {
  try {
    const data = JSON.parse(readFileSync("./data/grammar.json", "utf-8"));
    c.header("Cache-Control", "public, max-age=3600");
    return c.json(data);
  } catch {
    return c.json([]);
  }
});

// --- Raw deck (public, filtered by CEFR) ---
app.get("/api/raw-deck", (c) => {
  const cefr = (c.req.query("cefr") ?? "ALL").toUpperCase();
  const exact = CEFR_ORDER.has(cefr);
  const rows = RAW_DECK.filter((r) => {
    if (!r.useful_for_flashcard) return false;
    if (!exact) return true;
    return (r.cefr_level ?? "").trim().toUpperCase() === cefr;
  });
  c.header("Cache-Control", "public, max-age=3600");
  return c.json(rows);
});

// --- Auth ---
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// --- Auth middleware for user-data ---
app.use("/api/user-data/*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("userId", session.user.id);
  await next();
});

// --- User data CRUD ---
app.get("/api/user-data", async (c) => {
  const data = await getAllUserData(c.get("userId"));
  return c.json(data);
});

app.put("/api/user-data/:key", async (c) => {
  const body = await c.req.json();
  await setUserData(c.get("userId"), c.req.param("key"), body);
  return c.json({ ok: true });
});

app.delete("/api/user-data/:key", async (c) => {
  await deleteUserData(c.get("userId"), c.req.param("key"));
  return c.json({ ok: true });
});

// --- Start ---
const port = Number(process.env.AUTH_PORT) || 3000;

initDb().then(() => {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
