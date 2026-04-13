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
