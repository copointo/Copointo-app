import { Router } from "express";
import path from "node:path";
import fs from "node:fs";
import {
  cafes, users, broadcasts, chatMessages, friendScope, persistStore, flushNow, reports,
  purgeUserData, purgeCafeData, reels, wipeAllData,
  communities, communityInvites, orders, freeCoffees, progressAdjustments,
  copointoRedemptions,
  type Cafe, type Broadcast, type ChatMsg, type Report, type ProgressAdjustment,
  type AppUser,
} from "../store";
import { awardMilestoneCoffees } from "./cafe-dashboard";
import { deleteReelFile } from "../lib/objectStorage";
import { geocodeAddress } from "../utils/geocode";
import { sendPushToUser, sendPushToAll } from "../lib/push";

// ── Copointo Code helpers (per-cafe referral) ───────────────────────────
// Codes are exactly 3 chars from an unambiguous A-Z/2-9 alphabet (no I,O,0,1),
// stored UPPER-CASE, and unique across all cafes (case-insensitive). Returns
// the normalized code or an error message for the super-admin to surface.
const COPOINTO_CODE_RE = /^[A-Z2-9]{3}$/;
function normalizeCopointoCode(raw: unknown): string {
  return String(raw ?? "").trim().toUpperCase();
}
/** Validate a desired code for `cafeId` (omit cafeId when adding). Returns an
 *  Arabic error string when invalid/taken, or null when OK. */
function validateCopointoCode(code: string, cafeId: string | null): string | null {
  if (!COPOINTO_CODE_RE.test(code)) {
    return "كود Copointo يجب أن يكون 3 أحرف/أرقام (A-Z، 2-9)";
  }
  const taken = cafes.some(
    c => c.id !== cafeId && (c.copointoCode ?? "").toUpperCase() === code,
  );
  if (taken) return "هذا الكود مستخدم من قبل كوفي آخر، اختر كوداً مختلفاً";
  return null;
}

// Same on-disk reels folder used by the cafe-dashboard upload route.
// Kept here so the super-admin "delete cafe" path can clean up legacy
// `file:` reel uploads without round-tripping through the cafe routes.
const REELS_DIR = path.join(process.cwd(), "uploads", "reels");

// Special "sender id" used when the super-admin direct-messages a user.
// The mobile app recognizes this id and renders the conversation as
// coming from "Copointo" with a brand avatar.
export const COPOINTO_ADMIN_ID = "copointo-admin";

const router = Router();

const emptyOwnedItems = (): NonNullable<AppUser["ownedItems"]> => ({
  frames: [], badges: [], backgrounds: [],
  characters: [], usernameColors: [], textStyles: [],
});

const normPhone = (p: unknown): string => String(p ?? "").replace(/\D+/g, "");

/** Wipe a user's "earnings": coins → 0, owned cosmetics → empty, and ALL of
 *  their free coffees (redeemed + unredeemed). Bumps `syncVersion` so the
 *  mobile client overwrites its local AsyncStorage on the next status poll.
 *  Returns the number of free coffees removed. */
function wipeUserEarnings(user: AppUser): number {
  user.coins = 0;
  user.ownedItems = emptyOwnedItems();
  user.syncVersion = (user.syncVersion ?? 0) + 1;
  const phoneN = normPhone(user.phone);
  let removed = 0;
  for (let i = freeCoffees.length - 1; i >= 0; i--) {
    if (normPhone(freeCoffees[i].userPhone) === phoneN) {
      freeCoffees.splice(i, 1);
      removed++;
    }
  }
  return removed;
}

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

  // Copointo Code (optional, per-cafe referral). When the feature is enabled the
  // code MUST be a valid, unique 3-char code — an empty/short code with the
  // toggle on is rejected (never persist an "enabled but unusable" state).
  const codeEnabled = req.body.copointoCodeEnabled === true;
  const code = normalizeCopointoCode(req.body.copointoCode);
  if (codeEnabled) {
    const codeErr = validateCopointoCode(code, null);
    if (codeErr) return res.status(409).json({ error: codeErr });
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
    copointoCodeEnabled: codeEnabled,
    copointoCode: codeEnabled ? code : "",
    // Anchor the monthly settlement cycle the moment the code goes live.
    copointoCodeEnabledAt: codeEnabled ? new Date().toISOString() : undefined,
  };
  cafes.push(newCafe);
  // Synchronous flush — without this the new cafe lives only in memory
  // and gets lost on autoscale instance restart / redeploy before the 5s
  // safety-net interval fires. Same pattern as POST /users/register.
  try { await flushNow(); } catch { /* persistStore safety net will retry */ }
  res.status(201).json({ cafe: newCafe });
});

// ── PATCH /api/admin/cafes/:id/toggle ──────
router.patch("/cafes/:id/toggle", async (req, res): Promise<any> => {
  const cafe = cafes.find(c => c.id === req.params.id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });
  cafe.active = !cafe.active;
  try { await flushNow(); } catch { /* persistStore safety net will retry */ }
  res.json({ cafe });
});

// ── PATCH /api/admin/cafes/:id ─────────────
// Super-admin updates editable cafe fields. Any field omitted (or empty
// for managerPassword) is left unchanged. Immutable: id, createdAt.
router.patch("/cafes/:id", async (req, res): Promise<any> => {
  const cafe = cafes.find(c => c.id === req.params.id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });

  const b = req.body ?? {};
  // Plain string/number fields — only assign when caller actually provided them.
  const assignIfPresent = <K extends keyof Cafe>(key: K, v: any) => {
    if (v !== undefined && v !== null) (cafe as any)[key] = v;
  };
  assignIfPresent("name",      typeof b.name      === "string" ? b.name      : undefined);
  assignIfPresent("ownerName", typeof b.ownerName === "string" ? b.ownerName : undefined);
  assignIfPresent("ownerPhone",typeof b.ownerPhone=== "string" ? b.ownerPhone: undefined);
  assignIfPresent("openTime",  typeof b.openTime  === "string" ? b.openTime  : undefined);
  assignIfPresent("closeTime", typeof b.closeTime === "string" ? b.closeTime : undefined);
  assignIfPresent("website",   typeof b.website   === "string" ? b.website   : undefined);
  assignIfPresent("subscriptionStart", typeof b.subscriptionStart === "string" ? b.subscriptionStart : undefined);
  assignIfPresent("subscriptionEnd",   typeof b.subscriptionEnd   === "string" ? b.subscriptionEnd   : undefined);
  if (b.subscriptionAmount !== undefined && b.subscriptionAmount !== null && !Number.isNaN(Number(b.subscriptionAmount))) {
    cafe.subscriptionAmount = Number(b.subscriptionAmount);
  }
  if (Array.isArray(b.tags)) cafe.tags = b.tags;

  // Copointo Code (per-cafe referral). Only touched when the client actually
  // sends the toggle, so older clients that omit it leave the code untouched.
  if (typeof b.copointoCodeEnabled === "boolean") {
    if (b.copointoCodeEnabled) {
      // Enabling REQUIRES a valid, unique 3-char code — reject empty/short so we
      // never persist an "enabled but unusable" state.
      const code = normalizeCopointoCode(b.copointoCode);
      const codeErr = validateCopointoCode(code, cafe.id);
      if (codeErr) return res.status(409).json({ error: codeErr });
      cafe.copointoCode = code;
      cafe.copointoCodeEnabled = true;
      // Anchor the monthly settlement cycle the first time the code goes live;
      // keep the original anchor across later disable / re-enable cycles.
      if (!cafe.copointoCodeEnabledAt) cafe.copointoCodeEnabledAt = new Date().toISOString();
    } else {
      // Disabled — keep the stored code string but stop honoring it. (We clear
      // it so the unique-code pool frees up immediately.)
      cafe.copointoCodeEnabled = false;
      cafe.copointoCode = "";
    }
  }

  // Images — empty string from the client means "clear it".
  if (typeof b.logo  === "string") cafe.logo  = b.logo;
  if (typeof b.image === "string") cafe.image = b.image;
  // Password — only update when a non-empty value is provided.
  if (typeof b.managerPassword === "string" && b.managerPassword.trim() !== "") {
    cafe.managerPassword = b.managerPassword;
  }

  // Address + coordinates: same logic as POST. If lat/lng provided & valid,
  // use them. Otherwise, when the address actually changed, re-geocode it.
  // Capture the OLD address BEFORE mutating it so the change-detection
  // works correctly.
  const oldAddress = cafe.address;
  const newAddress = (typeof b.address === "string" && b.address.trim() !== "")
    ? b.address
    : oldAddress;
  if (newAddress !== oldAddress) cafe.address = newAddress;

  const manualLat = b.lat !== undefined && b.lat !== null && b.lat !== "" ? Number(b.lat) : NaN;
  const manualLng = b.lng !== undefined && b.lng !== null && b.lng !== "" ? Number(b.lng) : NaN;
  if (Number.isFinite(manualLat) && Number.isFinite(manualLng)) {
    cafe.lat = manualLat; cafe.lng = manualLng;
  } else if (newAddress !== oldAddress) {
    // Address changed and no manual coords supplied — re-geocode.
    const geo = await geocodeAddress(newAddress);
    if (geo) { cafe.lat = geo.lat; cafe.lng = geo.lng; }
  }

  try { await flushNow(); } catch { /* persistStore safety net will retry */ }
  res.json({ cafe });
});

// ── DELETE /api/admin/cafes/:id ────────────
// Super-admin permanently deletes a cafe AND every record that references
// it: menu, tables, orders, bookings, invoices, expenses, inventory,
// discount codes, reels (+ likes/comments/views & their video files),
// chat info, invoice templates, gift vouchers, ratings, cafe-views, and
// cafe-targeted reports. After this the cafe leaves no trace and the same
// owner phone or cafe name is free to register again as a fresh cafe with
// a brand-new id and zero residual data.
router.delete("/cafes/:id", (req, res) => {
  const id = req.params.id;
  const cafe = cafes.find(c => c.id === id);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });

  // Snapshot reel video keys BEFORE the in-memory purge so we can still
  // best-effort delete the underlying files (GCS objects + legacy on-disk
  // uploads) after the rows are gone.
  const reelVideoUrls: string[] = reels
    .filter(r => r.cafeId === id)
    .map(r => r.videoUrl);

  const ok = purgeCafeData(id);
  if (!ok) return res.status(404).json({ error: "Cafe not found" });

  for (const url of reelVideoUrls) {
    if (url?.startsWith("gcs:")) {
      void deleteReelFile(url.slice(4));
    } else if (url?.startsWith("file:")) {
      const safe = path.basename(url.slice(5));
      if (safe && safe !== "." && safe !== "..") {
        const filePath = path.resolve(REELS_DIR, safe);
        if (filePath.startsWith(path.resolve(REELS_DIR) + path.sep)) {
          try { fs.unlinkSync(filePath); } catch { /* ignore */ }
        }
      }
    }
  }

  res.json({ success: true });
});

// ── Copointo "Store Purchases" (super-admin) ────────────────────────────
// Single source: the copointoRedemptions ledger (every coin purchase, code or
// not). Showcase/demo rows are excluded from all financial views.
const isReal = (r: { showcaseOnly?: boolean }) => !r.showcaseOnly;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// GET /api/admin/copointo-purchases
// View 1 — "مشتريات المتجر Copointo": EVERY user coin purchase with full buyer
// details, coins, price, the cafe code used (if any) and Copointo's profit
// (price minus any cafe commission). Newest first.
router.get("/copointo-purchases", (_req, res) => {
  const rows = copointoRedemptions
    .filter(isReal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => {
      const commission = r.commission ?? 0;
      const priceOmr = r.priceOmr ?? 0;
      return {
        id: r.id,
        createdAt: r.createdAt,
        userId: r.userId ?? null,
        buyerName: r.buyerName ?? null,
        buyerPhone: r.buyerPhone ?? null,
        coinsBase: r.coinsBase ?? 0,
        coinsBonus: r.coinsBonus ?? 0,
        coinsTotal: r.coinsTotal ?? 0,
        priceOmr: round3(priceOmr),
        priceUsd: r.priceUsd ?? null,
        code: r.code ?? null,
        cafeId: r.cafeId ?? null,
        cafeName: r.cafeName ?? null,
        commission: round3(commission),
        // Copointo keeps the whole price on a code-less sale, and price minus
        // the cafe's 10% on a code sale.
        profit: round3(priceOmr - commission),
        platform: r.platform ?? null,
      };
    });
  const totalRevenue = round3(rows.reduce((s, r) => s + r.priceOmr, 0));
  const totalProfit = round3(rows.reduce((s, r) => s + r.profit, 0));
  const totalCommission = round3(rows.reduce((s, r) => s + r.commission, 0));
  res.json({
    purchases: rows,
    count: rows.length,
    totalRevenue,
    totalProfit,
    totalCommission,
  });
});

// GET /api/admin/copointo-cafes
// Views 2 & 3 — per code-enabled cafe: its code purchases, the accumulated due
// (commission since the last settlement), the monthly cycle dates and how many
// days remain in the current cycle. A cafe is listed if its code is currently
// enabled OR it still has past code purchases (so dues never disappear when a
// code is later disabled).
router.get("/copointo-cafes", (_req, res) => {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const summaries = cafes
    .filter(c => !c.showcaseOnly)
    .map(cafe => {
      const rows = copointoRedemptions
        .filter(r => r.cafeId === cafe.id && isReal(r))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (!cafe.copointoCodeEnabled && rows.length === 0) return null;

      // Cycle anchor: last settlement if any, else when the code went live, else
      // the cafe's creation date (legacy cafes enabled before enabledAt existed).
      const enabledAt = cafe.copointoCodeEnabledAt ?? null;
      const settledAt = cafe.copointoSettledAt ?? null;
      const cycleStartIso = settledAt ?? enabledAt ?? cafe.createdAt;
      const cycleStartMs = Date.parse(cycleStartIso) || now;
      // Next bill = anchor + 1 calendar month.
      const nextBill = new Date(cycleStartMs);
      nextBill.setMonth(nextBill.getMonth() + 1);
      const nextBillMs = nextBill.getTime();
      const daysLeft = Math.max(0, Math.ceil((nextBillMs - now) / DAY));
      const overdue = nextBillMs <= now;

      // Outstanding due = commission for purchases AFTER the cycle anchor.
      let accumulatedDue = 0;
      let dueCount = 0;
      let totalCommission = 0;
      for (const r of rows) {
        const c = r.commission ?? 0;
        totalCommission += c;
        if (Date.parse(r.createdAt) >= cycleStartMs) {
          accumulatedDue += c;
          dueCount += 1;
        }
      }

      return {
        cafeId: cafe.id,
        cafeName: cafe.name,
        code: (cafe.copointoCode ?? "").toUpperCase() || null,
        codeEnabled: !!cafe.copointoCodeEnabled,
        enabledAt,
        settledAt,
        cycleStartAt: cycleStartIso,
        nextBillAt: nextBill.toISOString(),
        daysLeft,
        overdue,
        accumulatedDue: round3(accumulatedDue),
        dueCount,
        totalCommission: round3(totalCommission),
        purchaseCount: rows.length,
        purchases: rows.map(r => ({
          id: r.id,
          createdAt: r.createdAt,
          buyerName: r.buyerName ?? null,
          buyerPhone: r.buyerPhone ?? null,
          code: r.code ?? null,
          coinsTotal: r.coinsTotal ?? 0,
          priceOmr: round3(r.priceOmr ?? 0),
          commission: round3(r.commission ?? 0),
          platform: r.platform ?? null,
        })),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.accumulatedDue - a.accumulatedDue);

  const totalDue = round3(summaries.reduce((s, c) => s + c.accumulatedDue, 0));
  res.json({ cafes: summaries, totalDue, count: summaries.length });
});

// POST /api/admin/copointo-cafes/:cafeId/settle
// View 3 — "تم الدفع": records that the cafe's outstanding due was paid out by
// stamping copointoSettledAt = now. The accumulated due resets to zero (future
// commission accrues against the new anchor); the full purchase history is
// preserved.
router.post("/copointo-cafes/:cafeId/settle", async (req, res): Promise<any> => {
  const cafe = cafes.find(c => c.id === req.params.cafeId);
  if (!cafe) return res.status(404).json({ error: "Cafe not found" });
  cafe.copointoSettledAt = new Date().toISOString();
  try { await flushNow(); } catch { /* persistStore safety net will retry */ }
  res.json({ ok: true, settledAt: cafe.copointoSettledAt });
});

// ── POST /api/admin/wipe-everything ───────
// DESTRUCTIVE super-admin reset: empties EVERY collection (users, cafes,
// orders, bookings, leaderboard/usernameRegistry, friends, chats, reels,
// invoices, reports, broadcasts, gift vouchers, free coffees — all of it)
// in BOTH memory and the kv_store table, so the platform restarts clean.
//
// Guarded by a server-side bearer token that must equal `SESSION_SECRET`
// (already set in env). The token NEVER appears in client code or logs;
// the operator passes it manually as `Authorization: Bearer <token>`.
//
// There is no undo — this is meant for the platform owner only, e.g. a
// fresh launch reset after testing.
router.post("/wipe-everything", async (req, res): Promise<any> => {
  const expected = process.env.SESSION_SECRET;
  if (!expected) {
    return res.status(500).json({ error: "SESSION_SECRET not configured" });
  }
  const auth = String(req.headers.authorization ?? "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await wipeAllData();
    return res.json({ success: true, wipedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

// ── GET /api/admin/users ────────────────────
router.get("/users", (_req, res) => {
  // `freeCoffees` is returned alongside so the admin UI can group every
  // user's earned coffees (redeemed + unredeemed) by phone without a
  // second round-trip. `coins`/`ownedItems` already live on each user.
  res.json({ users, freeCoffees });
});

// ── POST /api/admin/users/:id/set-coins ──
// Super-admin sets a user's coin balance to an ABSOLUTE value and bumps
// syncVersion so the mobile client overwrites its local balance on the
// next status poll.
router.post("/users/:id/set-coins", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const coins = Math.floor(Number(req.body?.coins ?? NaN));
  if (!Number.isFinite(coins)) return res.status(400).json({ error: "coins required" });
  user.coins = Math.max(0, coins);
  user.syncVersion = (user.syncVersion ?? 0) + 1;
  persistStore();
  res.json({ ok: true, user });
});

// ── POST /api/admin/users/:id/set-items ──
// Super-admin replaces a user's owned cosmetics wholesale (per category)
// and bumps syncVersion.
router.post("/users/:id/set-items", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const body = req.body?.ownedItems ?? {};
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? Array.from(new Set(v.map(String))) : [];
  user.ownedItems = {
    frames:         arr(body.frames),
    badges:         arr(body.badges),
    backgrounds:    arr(body.backgrounds),
    characters:     arr(body.characters),
    usernameColors: arr(body.usernameColors),
    textStyles:     arr(body.textStyles),
  };
  user.syncVersion = (user.syncVersion ?? 0) + 1;
  persistStore();
  res.json({ ok: true, user });
});

// ── POST /api/admin/users/:id/delete-free-coffees ──
// Deletes a user's free coffees. With `{ id }` removes a single coffee;
// without it removes ALL of the user's coffees (redeemed + unredeemed).
router.post("/users/:id/delete-free-coffees", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const phoneN = normPhone(user.phone);
  const codeId = typeof req.body?.id === "string" ? req.body.id : null;
  let removed = 0;
  for (let i = freeCoffees.length - 1; i >= 0; i--) {
    const f = freeCoffees[i];
    if (normPhone(f.userPhone) !== phoneN) continue;
    if (codeId && f.id !== codeId) continue;
    freeCoffees.splice(i, 1);
    removed++;
  }
  persistStore();
  res.json({ ok: true, removed });
});

// ── POST /api/admin/users/:id/wipe-earnings ──
// Explicit "delete all earnings" button: coins → 0, owned cosmetics →
// empty, free coffees → deleted. Bumps syncVersion.
router.post("/users/:id/wipe-earnings", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const removed = wipeUserEarnings(user);
  persistStore();
  res.json({ ok: true, removed, user });
});

// ── DELETE /api/admin/users/:id ────────────
// Super-admin permanently removes a user and ALL of their identifying
// data. After this, the same phone number can register fresh as a brand
// new account. Business records (orders, bookings, invoices) are kept for
// the cafes' revenue history but anonymized — customer name becomes
// "مستخدم محذوف" and customerPhone is cleared. This is different from
// banning, which keeps everything but blocks login.
router.delete("/users/:id", (req, res): any => {
  const ok = purgeUserData(req.params.id);
  if (!ok) return res.status(404).json({ error: "User not found" });
  res.json({ ok: true });
});

// ── PATCH /api/admin/users/:id/ban ─────────
// Body: { reason?: string }
// Banning REQUIRES a reason (shown to the user in the mobile app). Unbanning
// (toggling off) clears the reason and bannedAt timestamp. Kept as PATCH +
// toggle for backwards compatibility with the existing admin UI.
router.patch("/users/:id/ban", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.banned) {
    // Already banned → unban (no reason required)
    user.banned = false;
    user.banReason = null;
    user.bannedAt = null;
  } else {
    const reason = String(req.body?.reason ?? "").trim();
    if (!reason) return res.status(400).json({ error: "سبب الحظر مطلوب" });
    if (reason.length > 500) return res.status(400).json({ error: "سبب الحظر طويل جداً (الحد الأقصى 500 حرف)" });
    user.banned = true;
    user.banReason = reason;
    user.bannedAt = new Date().toISOString();
  }
  persistStore();
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

// ── GET /api/admin/users/:id/cafe-breakdown ──
// Per-cafe stats for ONE user — shows where they've ordered and how many
// drinks they've had at each cafe. Used by the super-admin "adjust progress"
// modal so the operator can see the user's history before changing numbers
// AND choose which cafe a milestone-triggered free coffee belongs to.
//
// `drinksHere` counts only hot/cold drinks (matching the loyalty allow-list
// in `awardOrderProgress` so what the admin sees matches what actually counts
// toward the 6-drink free-coffee milestone). `ordersHere` is the raw count
// of orders the user has at that cafe regardless of category.
//
// Phone normalization (digits-only) is used to match orders to the user so
// country-code/format mismatches don't cause cafes to disappear from the list.
router.get("/users/:id/cafe-breakdown", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const norm = (p: any) => String(p ?? "").replace(/\D+/g, "");
  const userPhoneN = norm(user.phone);
  if (!userPhoneN) {
    return res.json({ breakdown: [], freeCoffees: { total: 0, redeemed: 0 } });
  }
  const byCafe = new Map<string, { cafeId: string; cafeName: string; ordersHere: number; drinksHere: number }>();
  for (const o of orders) {
    if (norm(o.customerPhone) !== userPhoneN) continue;
    const cafe = cafes.find(c => c.id === o.cafeId);
    const cafeName = cafe?.name ?? "كافيه محذوف";
    const drinks = Array.isArray(o.items)
      ? o.items.reduce((s: number, it: any) => {
          const cat = String(it.category ?? "");
          const isDrink = cat === "مشروب ساخن" || cat === "مشروبات ساخنة"
                       || cat === "مشروبات باردة" || cat === "مشروب بارد";
          if (!isDrink) return s;
          const n = Number(it.qty);
          return s + (Number.isFinite(n) ? Math.min(99, Math.max(0, Math.floor(n))) : 0);
        }, 0)
      : 0;
    const cur = byCafe.get(o.cafeId) ?? { cafeId: o.cafeId, cafeName, ordersHere: 0, drinksHere: 0 };
    cur.ordersHere += 1;
    cur.drinksHere += drinks;
    byCafe.set(o.cafeId, cur);
  }
  const breakdown = Array.from(byCafe.values()).sort((a, b) => b.drinksHere - a.drinksHere);
  const userFc = freeCoffees.filter(f => norm(f.userPhone) === userPhoneN);
  res.json({
    breakdown,
    freeCoffees: {
      total: userFc.length,
      redeemed: userFc.filter(f => !!f.redeemedAt).length,
    },
  });
});

// ── POST /api/admin/users/:id/adjust-progress ──
// Body: { levelDelta?: number, ordersDelta?: number, awardCafeId?: string }
// Super-admin manual adjustment of a user's game level and/or coffee count.
// Each field is INDEPENDENT — adjusting `levelDelta` does NOT touch
// `totalOrders`, and adjusting `ordersDelta` does NOT touch `level`. This is
// intentional: the cashier asked for separate controls so they can fix a
// drift in one without affecting the other.
// Deltas can be positive (increase) or negative (decrease). Both fields are
// clamped to be >= 0 after applying, and `level` is also capped at 999 to
// match the in-game level cap used everywhere else.
//
// Milestone free-coffees: when the admin INCREASES totalOrders, milestone
// free coffees ARE issued for any newly-crossed multiple of 6 — so the user
// actually progresses and earns the rewards (which was the explicit ask).
// The `awardCafeId` body field selects which cafe the new free coffees are
// redeemable at (free coffees are cafe-specific). If omitted, the cafe with
// the user's highest historical drink count is used; if the user has no
// order history, the free coffees are issued with a null cafe binding (still
// visible in the user's account but with no preset redemption cafe).
// Decreases never revoke previously-issued free coffees.
router.post("/users/:id/adjust-progress", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const awardCafeId = typeof req.body?.awardCafeId === "string" ? req.body.awardCafeId : null;

  // ── Absolute "set" mode (current admin form) ──────────────────────────
  // Body: { awardCafeId, setLevel, setOrders } sets the user's per-cafe
  // progress for awardCafeId to ABSOLUTE values. Replaces the legacy delta
  // mode which couldn't decrease values reliably (mobile Math.max merge).
  const DRINKS_PER_LEVEL = 7;
  const hasSet = req.body?.setLevel != null || req.body?.setOrders != null;
  if (hasSet) {
    if (!awardCafeId) {
      return res.status(400).json({ error: "awardCafeId required for set mode" });
    }
    const cafeExists = cafes.find(c => c.id === awardCafeId);
    if (!cafeExists) {
      return res.status(404).json({ error: "Cafe not found" });
    }
    let setLevel  = Math.trunc(Number(req.body?.setLevel  ?? NaN));
    let setOrders = Math.trunc(Number(req.body?.setOrders ?? NaN));
    if (!Number.isFinite(setLevel))  setLevel  = Math.floor(setOrders / DRINKS_PER_LEVEL);
    if (!Number.isFinite(setOrders)) setOrders = setLevel * DRINKS_PER_LEVEL;
    setLevel  = Math.max(0, Math.min(999, setLevel));
    setOrders = Math.max(0, setOrders);
    const prog = (user.cafeProgress ??= {});
    const prev = prog[awardCafeId] ?? { totalOrders: 0, level: 0 };
    // ── Preserve legacy un-tracked progress on FIRST per-cafe set ──
    // If the user has a non-zero global (from before per-cafe tracking
    // existed) but their cafeProgress is empty or missing this cafe, the
    // diff between the existing global and the sum of tracked cafes is
    // "legacy untracked drinks" we don't want to wipe out. Stash it under
    // a synthetic "__legacy__" cafe key so future recomputes keep it.
    const trackedOrdersBefore = Object.entries(prog)
      .filter(([k]) => k !== awardCafeId)
      .reduce((s, [, c]) => s + (c.totalOrders ?? 0), 0);
    const trackedLevelsBefore = Object.entries(prog)
      .filter(([k]) => k !== awardCafeId)
      .reduce((m, [, c]) => Math.max(m, c.level ?? 0), 0);
    const legacyOrders = Math.max(0, (user.totalOrders ?? 0) - trackedOrdersBefore - (prev.totalOrders ?? 0));
    const legacyLevel  = Math.max(0, (user.level       ?? 0) - 0); // global max only
    if (legacyOrders > 0 && !prog["__legacy__"]) {
      prog["__legacy__"] = {
        level: Math.max(0, legacyLevel - trackedLevelsBefore),
        totalOrders: legacyOrders,
      };
    }
    prog[awardCafeId] = { level: setLevel, totalOrders: setOrders };
    // Recompute GLOBAL totals from the union of all cafe progresses so
    // decreases actually take effect. Without this, the mobile sync's
    // Math.max(local, server) merge would pull the global level back up
    // to its old (now stale) server value and undo the admin's decrease.
    // Per product spec: global level == global totalOrders == Σ per-cafe
    // levels == Σ per-cafe totalOrders. Both globals must be sums (not
    // max) so that admin-set changes across multiple cafes accumulate
    // instead of just reflecting the single highest cafe.
    const allCafeLvls = Object.values(prog).map(c => c.level ?? 0);
    const allCafeOrds = Object.values(prog).map(c => c.totalOrders ?? 0);
    user.level       = allCafeLvls.reduce((s, n) => s + n, 0);
    user.totalOrders = allCafeOrds.reduce((s, n) => s + n, 0);
    // Milestone free coffees: only if THIS cafe's coffees crossed upward
    // through a new multiple of 6. (No-op for decreases.)
    let newlyAwardedSet = 0;
    if (setOrders > (prev.totalOrders ?? 0) && user.phone) {
      const norm = (p: any) => String(p ?? "").replace(/\D+/g, "");
      const userPhoneN = norm(user.phone);
      const alreadyAwarded = freeCoffees.filter(f => norm(f.userPhone) === userPhoneN).length;
      // Free coffee every 6 drinks (levels 6, 12, 18, …) — must stay in
      // lockstep with DRINKS_PER_FREE_COFFEE in cafe-dashboard.ts.
      const willHave = Math.floor((user.totalOrders ?? 0) / 6);
      newlyAwardedSet = Math.max(0, willHave - alreadyAwarded);
      if (newlyAwardedSet > 0) {
        awardMilestoneCoffees(
          user.phone, user.username, user.totalOrders,
          cafeExists.id, cafeExists.name,
        );
      }
    }
    // Editing a user's level / cafe count WIPES their earnings (coins +
    // owned cosmetics + every free coffee). The milestone-award block above
    // may have queued new coffees on an increase; wiping deletes those too
    // so the final state is a clean slate. syncVersion is bumped inside
    // wipeUserEarnings so the mobile client overwrites local storage.
    const wipedFreeCoffeesSet = wipeUserEarnings(user);
    newlyAwardedSet = 0;
    const adjSet: ProgressAdjustment = {
      id:          `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId:      user.id,
      mode:        "set",
      levelDelta:  0,
      ordersDelta: 0,
      setLevel,
      setOrders,
      awardCafeId,
      createdAt:   new Date().toISOString(),
      claimedAt:   null,
    };
    progressAdjustments.unshift(adjSet);
    persistStore();
    return res.json({ user, newlyAwardedFreeCoffees: 0, wipedFreeCoffees: wipedFreeCoffeesSet, adjustment: adjSet });
  }

  // ── Legacy delta mode (kept for backward compat) ──────────────────────
  const levelDelta  = req.body?.levelDelta  != null ? Number(req.body.levelDelta)  : 0;
  const ordersDelta = req.body?.ordersDelta != null ? Number(req.body.ordersDelta) : 0;
  if (!Number.isFinite(levelDelta) || !Number.isFinite(ordersDelta)) {
    return res.status(400).json({ error: "Invalid delta" });
  }
  if (levelDelta === 0 && ordersDelta === 0) {
    return res.status(400).json({ error: "No change requested" });
  }
  if (levelDelta !== 0) {
    user.level = Math.max(0, Math.min(999, (user.level ?? 0) + Math.trunc(levelDelta)));
  }
  const couplingOrdersDelta = Math.trunc(levelDelta) * DRINKS_PER_LEVEL;
  if (awardCafeId) {
    const cafeExists = cafes.find(c => c.id === awardCafeId);
    if (cafeExists) {
      const prog = (user.cafeProgress ??= {});
      const curr = prog[awardCafeId] ?? { totalOrders: 0, level: 0 };
      const nextLevel  = Math.max(0, Math.min(999, curr.level + Math.trunc(levelDelta)));
      const nextOrders = Math.max(0, curr.totalOrders + Math.trunc(ordersDelta) + couplingOrdersDelta);
      prog[awardCafeId] = { level: nextLevel, totalOrders: nextOrders };
    }
  }
  let newlyAwarded = 0;
  const effectiveOrdersDelta = Math.trunc(ordersDelta) + couplingOrdersDelta;
  if (effectiveOrdersDelta !== 0) {
    const before = user.totalOrders ?? 0;
    user.totalOrders = Math.max(0, before + effectiveOrdersDelta);
    if (user.totalOrders > before && user.phone) {
      const norm = (p: any) => String(p ?? "").replace(/\D+/g, "");
      const userPhoneN = norm(user.phone);
      const alreadyAwarded = freeCoffees.filter(f => norm(f.userPhone) === userPhoneN).length;
      // Free coffee every 6 drinks (levels 6, 12, 18, …) — must stay in
      // lockstep with DRINKS_PER_FREE_COFFEE in cafe-dashboard.ts.
      const willHave = Math.floor(user.totalOrders / 6);
      newlyAwarded = Math.max(0, willHave - alreadyAwarded);
      if (newlyAwarded > 0) {
        let cafe = awardCafeId ? cafes.find(c => c.id === awardCafeId) : null;
        if (!cafe) {
          // Fallback: cafe where the user has the most historical drinks.
          const counts = new Map<string, number>();
          for (const o of orders) {
            if (norm(o.customerPhone) !== userPhoneN) continue;
            const drinks = Array.isArray(o.items)
              ? o.items.reduce((s: number, it: any) => {
                  const cat = String(it.category ?? "");
                  const isDrink = cat === "مشروب ساخن" || cat === "مشروبات ساخنة"
                               || cat === "مشروبات باردة" || cat === "مشروب بارد";
                  if (!isDrink) return s;
                  const n = Number(it.qty);
                  return s + (Number.isFinite(n) ? Math.min(99, Math.max(0, Math.floor(n))) : 0);
                }, 0)
              : 0;
            counts.set(o.cafeId, (counts.get(o.cafeId) ?? 0) + drinks);
          }
          let topId: string | null = null; let topN = -1;
          counts.forEach((n, id) => { if (n > topN) { topN = n; topId = id; } });
          if (topId) cafe = cafes.find(c => c.id === topId) ?? null;
        }
        awardMilestoneCoffees(
          user.phone, user.username, user.totalOrders,
          cafe?.id ?? null, cafe?.name ?? null,
        );
      }
    }
  }
  // Enqueue a device-side adjustment record so the owning device actually
  // applies these deltas to its LOCAL cafeProgress + global level/orders.
  // Without this, the server-side bumps above are typically masked by the
  // mobile sync's `Math.max(local, server)` merge (server's snapshot for
  // per-cafe progress is often 0 since mobile only mirrors GLOBAL progress).
  const adj: ProgressAdjustment = {
    id:          `pa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId:      user.id,
    levelDelta:  Math.trunc(levelDelta),
    ordersDelta: Math.trunc(ordersDelta),
    awardCafeId: awardCafeId ?? null,
    createdAt:   new Date().toISOString(),
    claimedAt:   null,
  };
  progressAdjustments.unshift(adj);
  // Same earnings-wipe policy as set mode: any change to level/orders nukes
  // coins + cosmetics + free coffees and bumps syncVersion.
  const wipedFreeCoffees = wipeUserEarnings(user);
  persistStore();
  res.json({ user, newlyAwardedFreeCoffees: 0, wipedFreeCoffees, adjustment: adj });
});

// ── POST /api/admin/users/:id/message ──────
// Body: { message: string }
// Super-admin sends a direct message to ONE user. Stored as a regular
// chatMessage with senderId = COPOINTO_ADMIN_ID so the mobile app picks
// it up via its existing /messages poll loop and renders it as a
// conversation from "Copointo".
router.post("/users/:id/message", (req, res): any => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const text = String(req.body?.message ?? "").trim();
  if (!text)            return res.status(400).json({ error: "الرسالة مطلوبة" });
  if (text.length > 1000) return res.status(400).json({ error: "الرسالة طويلة جداً (الحد الأقصى 1000 حرف)" });
  const msg: ChatMsg = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
    kind: "friend",
    scope: friendScope(COPOINTO_ADMIN_ID, user.id),
    senderId: COPOINTO_ADMIN_ID,
    text,
    createdAt: new Date().toISOString(),
    seenBy: [COPOINTO_ADMIN_ID],
  };
  chatMessages.push(msg);
  persistStore();
  // Notify the user with the full message text so they can read it from the
  // lock screen exactly like a WhatsApp message from a friend.
  void sendPushToUser(user.id, {
    title: "💬 رسالة من Copointo",
    body:  text.length > 200 ? text.slice(0, 200) + "…" : text,
    data:  { type: "chat_message", messageId: msg.id, senderId: COPOINTO_ADMIN_ID, kind: "friend" },
  });
  res.json({ ok: true, message: msg });
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
  persistStore();
  // Fan-out push to every registered device.
  void sendPushToAll({
    title: "إشعار من Copointo 📣",
    body:  message,
    data:  { type: "broadcast", broadcastId: b.id },
  });
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

// ── GET /api/admin/reports ─────────────────
// Returns every user-submitted report (newest first). For "cafe" reports we
// enrich with the live cafe details so the super-admin can act on the
// complaint without a second lookup.
router.get("/reports", (_req, res) => {
  const enriched = [...reports]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => {
      if (r.kind !== "cafe" || !r.cafeId) return r;
      const cafe = cafes.find(c => c.id === r.cafeId);
      return {
        ...r,
        cafe: cafe ? {
          id: cafe.id, name: cafe.name, logo: cafe.logo, image: cafe.image,
          ownerName: cafe.ownerName, ownerPhone: cafe.ownerPhone,
          address: cafe.address, active: cafe.active,
        } : null,
      };
    });
  res.json({ reports: enriched });
});

// ── PATCH /api/admin/reports/:id ────────────
// Toggle status open ↔ resolved.
router.patch("/reports/:id", (req, res): any => {
  const r = reports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: "Report not found" });
  const next = req.body?.status === "resolved" ? "resolved" : "open";
  r.status = next;
  persistStore();
  res.json({ report: r });
});

// ── DELETE /api/admin/reports/:id ───────────
router.delete("/reports/:id", (req, res): any => {
  const i = reports.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: "Report not found" });
  reports.splice(i, 1);
  persistStore();
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

// ─── Communities (super-admin) ─────────────────────────────────────────
// Same rank tiers as the mobile app (data/mockData.ts → RANKS).
const ADMIN_RANKS = [
  { min: 0,   max: 100,  name: "مبتدئ كوفي",   icon: "☕" },
  { min: 101, max: 200,  name: "هاوي كوفي",    icon: "🫖" },
  { min: 201, max: 300,  name: "محترف كوفي",   icon: "⭐" },
  { min: 301, max: 400,  name: "كبير كوفي",    icon: "🏅" },
  { min: 401, max: 500,  name: "عالمي كوفي",   icon: "🌍" },
  { min: 501, max: 600,  name: "مجنون كوفي",   icon: "🔥" },
  { min: 601, max: 700,  name: "مخضرم كوفي",   icon: "💎" },
  { min: 701, max: 800,  name: "عمدة الكوفي",  icon: "👑" },
  { min: 801, max: 900,  name: "ملك الكوفي",   icon: "🏆" },
  { min: 901, max: 1000, name: "نخبة الكوفي",  icon: "⚡" },
];
function adminRankFor(level: number) {
  return ADMIN_RANKS.find(r => level >= r.min && level <= r.max) || ADMIN_RANKS[0]!;
}
const ROLE_LABELS_AR: Record<string, string> = {
  leader: "قائد", vice: "قائد مساعد", senior: "عضو كبير", member: "عضو",
};

// GET /api/admin/communities — list every community + enriched member rows.
router.get("/communities", (_req, res) => {
  const list = communities.map(c => {
    const memberRows = c.members.map(uid => {
      const u = users.find(x => x.id === uid);
      const role = (c.roles && c.roles[uid]) || (uid === c.createdBy ? "leader" : "member");
      const level = u?.level ?? 0;
      const rank = adminRankFor(level);
      return {
        id: uid,
        name: u?.name || u?.username || "—",
        username: u?.username || "",
        phone: u?.phone || "",
        avatar: u?.avatar || null,
        gender: u?.gender || null,
        level,
        totalOrders: u?.totalOrders ?? 0,
        rankName: rank.name,
        rankIcon: rank.icon,
        roleKey: role,
        roleLabel: ROLE_LABELS_AR[role] || role,
        banned: !!u?.banned,
      };
    });
    // Sort: leader → vice → senior → member, then by level desc.
    const order: Record<string, number> = { leader: 0, vice: 1, senior: 2, member: 3 };
    memberRows.sort((a, b) => {
      const r = (order[a.roleKey] ?? 9) - (order[b.roleKey] ?? 9);
      if (r !== 0) return r;
      return b.level - a.level;
    });
    const totalLevel = memberRows.reduce((s, m) => s + (m.level || 0), 0);
    const totalOrders = memberRows.reduce((s, m) => s + (m.totalOrders || 0), 0);
    return {
      id: c.id,
      name: c.name,
      avatar: c.avatar || null,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
      memberCount: memberRows.length,
      totalLevel,
      totalOrders,
      members: memberRows,
    };
  });
  // Most-points first.
  list.sort((a, b) => b.totalLevel - a.totalLevel || b.memberCount - a.memberCount);
  res.json({ communities: list });
});

// POST /api/admin/communities/:id/ban  body: { reason }
// Hard-ban a community: delete it + all its invites, then push a TARGETED
// broadcast (toUserIds = former members) so each member sees the reason in
// their notifications screen on next poll. Cafe-side data is untouched.
router.post("/communities/:id/ban", (req, res): any => {
  const id = String(req.params.id ?? "").trim();
  const reason = String(req.body?.reason ?? "").trim();
  if (!id) return res.status(400).json({ error: "id مطلوب" });
  if (!reason) return res.status(400).json({ error: "السبب مطلوب" });
  if (reason.length > 500) return res.status(400).json({ error: "السبب طويل جداً (الحد الأقصى 500 حرف)" });

  const idx = communities.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "المجتمع غير موجود" });
  const community = communities[idx]!;
  const memberIds = [...community.members];
  const name = community.name;

  // Remove the community + every related invite.
  communities.splice(idx, 1);
  for (let i = communityInvites.length - 1; i >= 0; i--) {
    if (communityInvites[i]!.communityId === id) communityInvites.splice(i, 1);
  }

  // Targeted broadcast — only the former members will see it.
  if (memberIds.length > 0) {
    const b: Broadcast = {
      id: `bc_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message: `تم حظر مجتمع "${name}" من قِبل إدارة كوبوينتو.\nالسبب: ${reason}`,
      createdAt: new Date().toISOString(),
      toUserIds: memberIds,
    };
    broadcasts.unshift(b);
  }

  persistStore();
  res.json({ ok: true, removedMembers: memberIds.length });
});

export default router;
