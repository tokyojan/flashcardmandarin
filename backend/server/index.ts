import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { auth } from "../auth";
import { initDb, getAllUserData, setUserData, deleteUserData } from "./db";

const app = new Hono<{
  Variables: { userId: string };
}>();

app.use(
  "/api/*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

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
