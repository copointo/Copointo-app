import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "node:crypto";
import {
  unoSessions,
  persistStore,
  users,
  friendsOf,
  type UnoGame,
} from "../store";
import {
  createGame,
  joinGame,
  leaveGame,
  hasOpenSeat,
  tick,
  redact,
  applyPlay,
  applyDraw,
  applyPass,
  sayUno,
  type UnoColor,
  type UnoMode,
} from "../uno/engine";

const router: IRouter = Router();

// ── tiny manual validation (the server avoids a schema lib elsewhere) ────────
function str(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}
function mode(v: unknown): UnoMode | null {
  return v === "1v1" || v === "2v2" ? v : null;
}
function color(v: unknown): UnoColor | undefined {
  return v === "red" || v === "yellow" || v === "green" || v === "blue" ? v : undefined;
}

// Stale-session sweeper: drop finished/abandoned matches so the persisted
// collection doesn't grow unbounded. Cheap, runs opportunistically.
const TWO_HOURS = 2 * 60 * 60 * 1000;
function sweep(now: number) {
  for (let i = unoSessions.length - 1; i >= 0; i--) {
    const g = unoSessions[i]!;
    const dead =
      (g.status === "finished" && now - g.createdAt > 10 * 60_000) ||
      now - g.createdAt > TWO_HOURS;
    if (dead) unoSessions.splice(i, 1);
  }
}

function findGame(id: string): UnoGame | undefined {
  return unoSessions.find(g => g.id === id);
}

function seatOf(g: UnoGame, userId: string): number {
  return g.players.find(p => p.userId === userId)?.seat ?? -1;
}

function displayName(userId: string, fallback?: string): { name: string; avatar?: string } {
  const u = users.find(x => x.id === userId);
  if (u) return { name: u.name || u.username || fallback || "لاعب", avatar: u.avatar };
  return { name: fallback || "لاعب" };
}

/** Run lazy advancement and persist if anything changed. */
function tickAndSave(g: UnoGame, now: number): void {
  if (tick(g, now)) persistStore();
}

function bodyIdentity(req: Request): { userId: string; name?: string; avatar?: string } | null {
  const userId = str(req.body?.userId, 200);
  if (!userId) return null;
  const name = str(req.body?.name, 40) ?? undefined;
  const avatar = str(req.body?.avatar, 2000) ?? undefined;
  return { userId, name, avatar };
}

// ── create ─────────────────────────────────────────────────────────────────
router.post("/sessions", (req, res) => {
  const id = bodyIdentity(req);
  const m = mode(req.body?.mode);
  if (!id || !m) return res.status(400).json({ error: "BAD_INPUT" });
  const now = Date.now();
  sweep(now);
  const who = displayName(id.userId, id.name);
  const g = createGame({
    id: randomUUID(),
    mode: m,
    isPublic: req.body?.isPublic !== false,
    host: { userId: id.userId, name: who.name, avatar: id.avatar ?? who.avatar },
  });
  unoSessions.push(g);
  persistStore();
  return res.json({ id: g.id, view: redact(g, id.userId, now) });
});

// ── quickmatch (random) ─────────────────────────────────────────────────────
router.post("/quickmatch", (req, res) => {
  const id = bodyIdentity(req);
  const m = mode(req.body?.mode);
  if (!id || !m) return res.status(400).json({ error: "BAD_INPUT" });
  const now = Date.now();
  sweep(now);
  const who = displayName(id.userId, id.name);
  // Already in a live/waiting game? Re-enter it.
  const existing = unoSessions.find(
    g => g.status !== "finished" && g.players.some(p => p.userId === id.userId),
  );
  if (existing) return res.json({ id: existing.id, view: redact(existing, id.userId, now) });
  // Find an open public lobby of the same mode, else create one.
  let g = unoSessions.find(
    s => s.isPublic && s.mode === m && hasOpenSeat(s) && !s.players.some(p => p.userId === id.userId),
  );
  if (g) {
    joinGame(g, { userId: id.userId, name: who.name, avatar: id.avatar ?? who.avatar });
  } else {
    g = createGame({
      id: randomUUID(),
      mode: m,
      isPublic: true,
      host: { userId: id.userId, name: who.name, avatar: id.avatar ?? who.avatar },
    });
    unoSessions.push(g);
  }
  persistStore();
  return res.json({ id: g.id, view: redact(g, id.userId, now) });
});

// ── join a specific session ─────────────────────────────────────────────────
router.post("/sessions/:id/join", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const now = Date.now();
  const who = displayName(id.userId, id.name);
  const r = joinGame(g, { userId: id.userId, name: who.name, avatar: id.avatar ?? who.avatar });
  if (!r.ok) return res.status(409).json({ error: r.reason ?? "CANNOT_JOIN" });
  tickAndSave(g, now);
  persistStore();
  return res.json({ id: g.id, view: redact(g, id.userId, now) });
});

// ── invite a friend ─────────────────────────────────────────────────────────
router.post("/sessions/:id/invite", (req, res) => {
  const id = bodyIdentity(req);
  const toUserId = str(req.body?.toUserId, 200);
  if (!id || !toUserId) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  if (seatOf(g, id.userId) < 0) return res.status(403).json({ error: "NOT_IN_GAME" });
  if (g.status !== "waiting") return res.status(409).json({ error: "STARTED" });
  if (g.players.some(p => p.userId === toUserId)) return res.json({ ok: true });
  if (!g.invites.some(iv => iv.toUserId === toUserId)) {
    const from = displayName(id.userId, id.name);
    g.invites.push({ toUserId, fromUserId: id.userId, fromName: from.name, at: Date.now() });
    persistStore();
  }
  return res.json({ ok: true });
});

// ── my pending invites ───────────────────────────────────────────────────────
router.get("/invites", (req, res) => {
  const userId = str(req.query.userId, 200);
  if (!userId) return res.status(400).json({ error: "BAD_INPUT" });
  const now = Date.now();
  sweep(now);
  const list = unoSessions
    .filter(g => g.status === "waiting" && hasOpenSeat(g) && g.invites.some(iv => iv.toUserId === userId))
    .map(g => {
      const iv = g.invites.find(x => x.toUserId === userId)!;
      return {
        sessionId: g.id,
        mode: g.mode,
        fromName: iv.fromName,
        at: iv.at,
        players: g.players.length,
        capacity: g.capacity,
        countdownMs: Math.max(0, g.startsAt - now),
      };
    });
  return res.json({ invites: list });
});

// ── decline an invite ────────────────────────────────────────────────────────
router.post("/sessions/:id/decline", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (g) {
    g.invites = g.invites.filter(iv => iv.toUserId !== id.userId);
    persistStore();
  }
  return res.json({ ok: true });
});

// ── friends list (for the invite picker) ─────────────────────────────────────
router.get("/friends", (req, res) => {
  const userId = str(req.query.userId, 200);
  if (!userId) return res.status(400).json({ error: "BAD_INPUT" });
  const friends = friendsOf(userId).map(fid => {
    const u = users.find(x => x.id === fid);
    return {
      id: fid,
      name: u?.name || u?.username || "صديق",
      avatar: u?.avatar,
      level: u?.level,
    };
  });
  return res.json({ friends });
});

// ── leave / forfeit ──────────────────────────────────────────────────────────
router.post("/sessions/:id/leave", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.json({ ok: true });
  const r = leaveGame(g, id.userId);
  if (r.deleted) {
    const i = unoSessions.findIndex(x => x.id === g.id);
    if (i >= 0) unoSessions.splice(i, 1);
  }
  persistStore();
  return res.json({ ok: true });
});

// ── poll redacted state ──────────────────────────────────────────────────────
router.get("/sessions/:id", (req, res) => {
  const userId = str(req.query.userId, 200);
  if (!userId) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const now = Date.now();
  tickAndSave(g, now);
  return res.json({ view: redact(g, userId, now) });
});

// ── play a card ──────────────────────────────────────────────────────────────
router.post("/sessions/:id/play", (req, res) => {
  const id = bodyIdentity(req);
  const cardId = str(req.body?.cardId, 64);
  if (!id || !cardId) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const now = Date.now();
  tick(g, now);
  const seat = seatOf(g, id.userId);
  if (seat < 0) return res.status(403).json({ error: "NOT_IN_GAME" });
  const r = applyPlay(g, seat, cardId, color(req.body?.color), now);
  if (!r.ok) return res.status(409).json({ error: r.reason ?? "ILLEGAL" });
  tick(g, now);
  persistStore();
  return res.json({ view: redact(g, id.userId, now) });
});

// ── draw a card ──────────────────────────────────────────────────────────────
router.post("/sessions/:id/draw", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const now = Date.now();
  tick(g, now);
  const seat = seatOf(g, id.userId);
  if (seat < 0) return res.status(403).json({ error: "NOT_IN_GAME" });
  const r = applyDraw(g, seat, now);
  if (!r.ok) return res.status(409).json({ error: r.reason ?? "ILLEGAL" });
  tick(g, now);
  persistStore();
  return res.json({ view: redact(g, id.userId, now) });
});

// ── pass (after drawing) ─────────────────────────────────────────────────────
router.post("/sessions/:id/pass", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const now = Date.now();
  tick(g, now);
  const seat = seatOf(g, id.userId);
  if (seat < 0) return res.status(403).json({ error: "NOT_IN_GAME" });
  const r = applyPass(g, seat, now);
  if (!r.ok) return res.status(409).json({ error: r.reason ?? "ILLEGAL" });
  tick(g, now);
  persistStore();
  return res.json({ view: redact(g, id.userId, now) });
});

// ── declare UNO ──────────────────────────────────────────────────────────────
router.post("/sessions/:id/uno", (req, res) => {
  const id = bodyIdentity(req);
  if (!id) return res.status(400).json({ error: "BAD_INPUT" });
  const g = findGame(req.params.id);
  if (!g) return res.status(404).json({ error: "NOT_FOUND" });
  const seat = seatOf(g, id.userId);
  if (seat < 0) return res.status(403).json({ error: "NOT_IN_GAME" });
  sayUno(g, seat);
  persistStore();
  return res.json({ view: redact(g, id.userId, Date.now()) });
});

export default router;
