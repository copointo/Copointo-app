import { Router } from "express";
import { cafes, users, type Cafe } from "../store";
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
    subscriptionAmount: 300,
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
