import { Router } from "express";
import { cafes, users, broadcasts, type Cafe, type Broadcast } from "../store";
import { geocodeAddress } from "../utils/geocode";

const router = Router();

// ── GET /api/admin/cafes ────────────────────
router.get("/cafes", (_req, res) => {
  res.json({ cafes });
});

// ── POST /api/admin/cafes ───────────────────
router.post("/cafes", async (req, res) => {
  const { name, ownerName, ownerPhone, logo, openTime, closeTime, managerPassword, address, tags, subscriptionStart, subscriptionEnd, website, lat, lng } = req.body;
  if (!name || !ownerPhone || !openTime || !closeTime || !managerPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  const today = new Date().toISOString().split("T")[0];
  const oneYear = new Date(); oneYear.setFullYear(oneYear.getFullYear() + 1);
  const finalAddress = address || "عُمان";

  // Coordinates: only use BOTH manual values if valid; otherwise geocode
  const manualLat = lat !== undefined && lat !== null && lat !== "" ? Number(lat) : NaN;
  const manualLng = lng !== undefined && lng !== null && lng !== "" ? Number(lng) : NaN;
  let finalLat: number | undefined;
  let finalLng: number | undefined;
  if (Number.isFinite(manualLat) && Number.isFinite(manualLng)) {
    finalLat = manualLat; finalLng = manualLng;
  } else if (finalAddress) {
    const geo = await geocodeAddress(finalAddress);
    if (geo) { finalLat = geo.lat; finalLng = geo.lng; }
  }

  const newCafe: Cafe = {
    id: Date.now().toString(),
    name,
    ownerName: ownerName || "",
    ownerPhone,
    logo: logo || "",
    image: req.body.image || "",
    openTime,
    closeTime,
    managerPassword,
    active: true,
    subscriptionPaid: true,
    subscriptionAmount: req.body.subscriptionAmount != null && !Number.isNaN(Number(req.body.subscriptionAmount))
      ? Number(req.body.subscriptionAmount)
      : 300,
    subscriptionStart: subscriptionStart || today,
    subscriptionEnd:   subscriptionEnd   || oneYear.toISOString().split("T")[0],
    website: website || "",
    createdAt: new Date().toISOString(),
    rating: 4.5,
    tags: tags || [],
    address: finalAddress,
    lat: finalLat,
    lng: finalLng,
  };
  cafes.push(newCafe);
  res.status(201).json({ cafe: newCafe });
});

// ── PATCH /api/admin/cafes/:id/toggle ──────
router.patch("/cafes/:id/toggle", (req, res) => {
  const cafe = cafes.find(c => c.id === req.params.id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });
  cafe.active = !cafe.active;
  res.json({ cafe });
});

// ── DELETE /api/admin/cafes/:id ────────────
router.delete("/cafes/:id", (req, res) => {
  const idx = cafes.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Cafe not found" });
  cafes.splice(idx, 1);
  res.json({ success: true });
});

// ── GET /api/admin/users ────────────────────
router.get("/users", (_req, res) => {
  res.json({ users });
});

// ── PATCH /api/admin/users/:id/ban ─────────
router.patch("/users/:id/ban", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.banned = !user.banned;
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-ban ─────
// Body: { reason: string }
// Permanently bans user from the game (ranking hidden, game tab blocked).
// Cafe ordering & points keep working.
router.post("/users/:id/game-ban", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const reason = String(req.body?.reason ?? "").trim();
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  user.gameBanned = true;
  user.gameSuspendedUntil = null;
  user.gameSuspendReason = reason;
  user.gameSuspendedAt = new Date().toISOString();
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-suspend ─
// Body: { days: number, reason: string }
// Temporarily suspends the user from the game for `days` days.
router.post("/users/:id/game-suspend", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const days   = Number(req.body?.days);
  const reason = String(req.body?.reason ?? "").trim();
  if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: "Invalid days" });
  if (!reason) return res.status(400).json({ error: "Reason is required" });
  const until = new Date();
  until.setDate(until.getDate() + Math.floor(days));
  user.gameBanned = false;
  user.gameSuspendedUntil = until.toISOString();
  user.gameSuspendReason = reason;
  user.gameSuspendedAt = new Date().toISOString();
  res.json({ user });
});

// ── POST /api/admin/users/:id/game-clear ───
// Lifts any active game ban or suspension.
router.post("/users/:id/game-clear", (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  user.gameBanned = false;
  user.gameSuspendedUntil = null;
  user.gameSuspendReason = null;
  user.gameSuspendedAt = null;
  res.json({ user });
});

// ── POST /api/admin/broadcasts ─────────────
// Body: { message: string }
// Super-admin sends a broadcast to all game users (system notification from Copointo).
router.post("/broadcasts", (req, res): any => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "الرسالة مطلوبة" });
  if (message.length > 500) return res.status(400).json({ error: "الرسالة طويلة جداً (الحد الأقصى 500 حرف)" });
  const b: Broadcast = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    message,
    createdAt: new Date().toISOString(),
  };
  broadcasts.unshift(b);
  res.json({ broadcast: b });
});

// ── GET /api/admin/broadcasts ──────────────
// Returns broadcast history (newest first) for the super-admin panel.
router.get("/broadcasts", (_req, res) => {
  res.json({ broadcasts });
});

// ── DELETE /api/admin/broadcasts/:id ───────
router.delete("/broadcasts/:id", (req, res): any => {
  const i = broadcasts.findIndex(b => b.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Broadcast not found" });
  broadcasts.splice(i, 1);
  res.json({ ok: true });
});

// ── GET /api/admin/stats ────────────────────
router.get("/stats", (_req, res) => {
  const totalCafes   = cafes.length;
  const activeCafes  = cafes.filter(c => c.active).length;
  const totalRevenue = cafes.filter(c => c.subscriptionPaid).length * 300;
  const totalUsers   = users.length;
  const bannedUsers  = users.filter(u => u.banned).length;
  res.json({ totalCafes, activeCafes, totalRevenue, totalUsers, bannedUsers });
});

// ── GET /api/cafes (public — mobile app) ────
router.get("/public", (_req, res) => {
  const publicCafes = cafes.filter(c => c.active).map(c => ({
    id: c.id, name: c.name, logo: c.logo, image: c.image,
    openTime: c.openTime, closeTime: c.closeTime,
    rating: c.rating, tags: c.tags, address: c.address,
  }));
  res.json({ cafes: publicCafes });
});

export default router;
