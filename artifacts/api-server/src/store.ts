export interface Cafe {
  id: string; name: string; ownerName: string; ownerPhone: string; logo: string;
  openTime: string; closeTime: string; managerPassword: string;
  active: boolean; subscriptionPaid: boolean; subscriptionAmount: number;
  subscriptionStart: string; subscriptionEnd: string;
  website: string;
  createdAt: string; rating: number; tags: string[]; address: string; image: string;
  lat?: number; lng?: number;
}
export interface AppUser {
  id: string; username: string; phone: string; level: number;
  totalOrders: number; banned: boolean; joinedAt: string;
  /** Permanent game ban (separate from `banned` which blocks the whole account). */
  gameBanned?: boolean;
  /** ISO timestamp; if in the future, the user is temporarily suspended from the game. */
  gameSuspendedUntil?: string | null;
  /** Reason shown to the user when game is suspended/banned. */
  gameSuspendReason?: string | null;
  /** ISO timestamp of when the suspension/ban was applied. */
  gameSuspendedAt?: string | null;
}
export interface MenuItem {
  id: string; cafeId: string; name: string; price: number;
  category: string; description: string; available: boolean; createdAt: string;
  image?: string | null;
  originalPrice?: number | null;
  promoBuyQty?: number | null;
  promoGetQty?: number | null;
  /** Optional stock tracking. null/undefined = not tracked (unlimited). */
  stockQty?: number | null;
  /** Snapshot of last "restock" total — used as denominator for low/critical alerts. */
  initialStockQty?: number | null;
  /** Optional bean types the customer can pick from at order time. Empty/undefined = no bean picker. */
  beans?: string[];
  /** Optional sizes the customer can pick from at order time. extraPrice is added to base price. */
  sizes?: { label: string; extraPrice: number }[];
}
export interface CafeTable {
  id: string; cafeId: string; number: number; capacity: number;
  available: boolean; createdAt: string;
  image?: string | null;
  hourlyPricing?: { hours: number; price: number }[];
  /**
   * Admin-defined list of bookable time slots for this table (e.g. ["7:00 AM", "8:00 AM", ...]).
   * If empty/undefined, the customer-facing booking screens fall back to a sensible default list.
   */
  availableTimes?: string[];
  /**
   * Specific date+time combinations that the cafe admin has manually marked as
   * unavailable (e.g. private event, maintenance). Customer-facing screens will
   * show these as "مغلق من الإدارة" and reject booking attempts on them.
   */
  blockedSlots?: { date: string; time: string }[];
}
export interface Order {
  id: string; cafeId: string; customerName: string; customerNameEn?: string; customerPhone: string;
  items: {
    name: string; qty: number; price: number; category?: string;
    /** Customer-selected bean type (when the menu item defined `beans`). */
    selectedBean?: string;
    /** Customer-selected size label (when the menu item defined `sizes`). */
    selectedSize?: string;
    /** Snapshot of the size's extraPrice at the moment of order (already included in `price`). */
    sizeExtraPrice?: number;
  }[];
  subtotal?: number;
  discountCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  total: number; status: "pending" | "preparing" | "ready" | "done";
  type: "dine" | "car"; tableNumber?: string;
  plateNumber?: string; plateSymbol?: string;
  source?: "direct" | "chat";
  userId?: string;
  drinkCount?: number;
  prepMinutes?: number;
  confirmedAt?: string;
  pointsAwarded?: boolean;
  printedAt?: string;
  /** Optional customer notes (bean type, extra-hot, customizations, etc). */
  notes?: string;
  /** Legacy single-code free-coffee redemption (kept for older orders). */
  freeCoffeeCode?: string;
  /** Snapshot of the level milestone the legacy code was earned at. */
  freeCoffeeLevel?: number;
  /** New multi-redemption: each entry is one free-coffee code applied to one drink. */
  freeCoffeeRedemptions?: { code: string; level: number; itemName: string; itemPrice: number }[];
  /** Total OMR deducted from the order via free-coffee redemptions. */
  freeCoffeeDiscount?: number;
  /** Payment method recorded by the cafe when the order is ready (cash | visa). */
  paymentMethod?: "cash" | "visa";
  createdAt: string;
}
export interface CafeView {
  id: string; cafeId: string; userId?: string; userPhone?: string;
  source?: string; viewedAt: string;
}
export interface TableBooking {
  id: string; cafeId: string; cafeName?: string;
  customerName: string; customerPhone: string;
  tableId: string; tableNumber: number; tableCapacity?: number;
  date: string; time: string;
  guests: number;
  /** Number of hours booked (matches one of the table's hourlyPricing tiers). */
  hours?: number;
  /** Price snapshot of the chosen tier (OMR). */
  hourPrice?: number;
  /** Final price = hourPrice (one tier total). */
  totalPrice?: number;
  status: "pending" | "confirmed" | "cancelled";
  confirmedAt?: string;
  /** ID of the Invoice generated when this booking was confirmed. */
  invoiceId?: string;
  createdAt: string;
}
export interface ChatInfo {
  id: string; cafeId: string; topic: string; content: string; createdAt: string;
}
export interface Invoice {
  id: string; cafeId: string; orderId: string; customerName: string;
  items: { name: string; qty: number; price: number }[];
  total: number; type: "order" | "booking"; createdAt: string;
}
export interface DiscountCode {
  id: string; cafeId: string; code: string;
  percent: 10 | 20 | 30 | 40 | 50;
  expiresAt: string | null; active: boolean;
  usedCount: number; createdAt: string;
}

export type InvoiceType = "order" | "expense" | "daily" | "monthly" | "yearly";
export interface InvoiceTemplate {
  cafeId: string; type: InvoiceType;
  logo: string;          // base64 data URL or http URL
  cafeName: string;
  commercialReg: string;
  contactPhone: string;
  promoText: string;
  updatedAt: string;
}
export interface Expense {
  id: string; cafeId: string;
  title: string; amount: number;
  category: string;       // e.g. "إيجار", "رواتب", "مواد خام"
  notes?: string;
  date: string;           // YYYY-MM-DD
  createdAt: string;
}

export const cafes:    Cafe[]         = [];
export const users:    AppUser[]      = [];
export const menuItems: MenuItem[]    = [];
export const tables:   CafeTable[]    = [];
export const orders:   Order[]        = [];
export const bookings: TableBooking[] = [];
export const chatInfos: ChatInfo[]    = [];
export const invoices: Invoice[]      = [];
export const cafeViews: CafeView[]    = [];
export const discountCodes: DiscountCode[] = [];
export const expenses:         Expense[]         = [];
export const invoiceTemplates: InvoiceTemplate[] = [];

export interface FreeCoffee {
  id: string;
  code: string;             // unique 6-char uppercase code
  userPhone: string;        // owner (the player who earned it)
  userName: string;         // snapshot
  earnedAtLevel: number;    // milestone level (multiple of 7) that earned it
  earnedAt: string;         // ISO
  /** Cafe whose order pushed the user past the milestone — only redeemable here. */
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
  redeemedAtCafeId: string | null;
  redeemedOrderId: string | null;
}
export const freeCoffees: FreeCoffee[] = [];

export interface InventoryItem {
  id: string;
  cafeId: string;
  name: string;
  initialQty: number;
  currentQty: number;
  unitPrice: number;     // OMR per single unit
  totalCost: number;     // initialQty * unitPrice (snapshot at creation)
  createdAt: string;     // ISO timestamp
  depletedAt: string | null; // ISO when currentQty first hit 0
}
export const inventoryItems: InventoryItem[] = [];

// ─── Copointo Reels (vertical short videos posted by cafés) ──────────────
export interface Reel {
  id: string;
  cafeId: string;
  cafeName: string;
  cafeLogo?: string;
  /** Data URL (data:video/...;base64,...) or remote URL. Stored in memory. */
  videoUrl: string;
  description: string;
  /** Link to the cafe's order page (in-app deep link or external URL). */
  orderLink: string;
  /** Maps URL or address text used by the "موقع الكوفي" button. */
  locationUrl: string;
  views: number;
  createdAt: string;
}
export interface ReelLike {
  reelId: string;
  /** User identifier (phone or game username) — keeps likes unique per user. */
  userId: string;
  userName?: string;
  likedAt: string;
}
export interface ReelComment {
  id: string;
  reelId: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}
export interface ReelView {
  reelId: string;
  userId: string;
  viewedAt: string;
}

export const reels:        Reel[]        = [];
export const reelLikes:    ReelLike[]    = [];
export const reelComments: ReelComment[] = [];
export const reelViews:    ReelView[]    = [];

/**
 * Broadcast announcement sent by the super-admin to all game users.
 * Appears in the mobile notifications screen as a system message from Copointo.
 */
export interface Broadcast {
  id: string;
  message: string;
  createdAt: string;
}
export const broadcasts: Broadcast[] = [];

// ─── User-submitted reports (problem / cafe complaint) ───────────────────
// Two flavours, both visible to the super-admin in the "البلاغات" tab:
//   - kind: "problem" → general support / bug report from the support screen
//   - kind: "cafe"    → complaint about a specific cafe (cafeId required)
export interface Report {
  id: string;
  kind: "problem" | "cafe";
  name: string;
  phone: string;
  description: string;
  /** Only set when kind === "cafe". */
  cafeId?: string;
  cafeName?: string;
  /** Reporter user id snapshot (if logged in). */
  reporterUserId?: string;
  status: "open" | "resolved";
  createdAt: string;
}
export const reports: Report[] = [];

// ─── Cafe ratings (1-5 stars, one per user per cafe) ────────────────────
// Each user may rate any cafe once; submitting again UPSERTS their rating.
// The cafe's displayed rating is the average of all entries here (rounded
// to 1 decimal). Cafes with no entries fall back to a 0 average (no stars).
export interface CafeRating {
  cafeId: string;
  userId: string;
  /** Whole stars 1–5 only. */
  stars: number;
  ratedAt: string;
}
export const cafeRatings: CafeRating[] = [];

/** Compute average rating + count for a cafe from `cafeRatings`. */
export function getCafeRatingStats(cafeId: string): { rating: number; ratingCount: number } {
  const entries = cafeRatings.filter(r => r.cafeId === cafeId);
  if (entries.length === 0) return { rating: 0, ratingCount: 0 };
  const sum = entries.reduce((a, r) => a + r.stars, 0);
  return {
    rating: Math.round((sum / entries.length) * 10) / 10,
    ratingCount: entries.length,
  };
}

// ─── Game username registry (cross-device uniqueness) ────────────────────
// Mobile users keep their account state in AsyncStorage on their own device,
// but we still need to guarantee that no two users in the country claim the
// same `gameUsername`. The mobile app calls POST /api/usernames/claim before
// creating or updating a user; the server enforces case-insensitive uniqueness
// here and rejects collisions.
export interface UsernameClaim {
  /** Lower-cased username — used as the dedupe key. */
  username: string;
  /** Original casing as the user typed it (for display). */
  display: string;
  /** Owner of this username. */
  userId: string;
  claimedAt: string;
}
export const usernameRegistry: UsernameClaim[] = [];

// ─── Friend requests + friendships (cross-device) ───────────────────────
// The mobile client used to keep friend lists in AsyncStorage only, which
// meant a request never reached a user on another device. We now mirror
// pending requests, accepted friendships, and "your request was declined"
// receipts on the server so the flow works across devices.
export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  /** "pending" → awaiting decision. "declined" → kept until the sender's
   *  client acks it (so we can show a one-time toast/notification). */
  status: "pending" | "declined";
  createdAt: string;
  decidedAt?: string;
}
export const friendRequests: FriendRequest[] = [];

export interface Friendship {
  /** Lexicographically smaller user id (canonicalised so each pair is unique). */
  a: string;
  b: string;
  createdAt: string;
}
export const friendships: Friendship[] = [];

// ─── Cross-device chat messages ─────────────────────────────────────────
// 1:1 friend chats and group chats both flow through this single table so
// every device sees the same source of truth. `scope` identifies the
// conversation: for friend chats it's the canonical pair "a|b" (a < b);
// for group chats it's the groupId. `seenBy` lists user ids that have
// opened the conversation since the message arrived (for ✓✓ ticks).
export interface ChatMsg {
  id: string;
  kind: "friend" | "group";
  scope: string;
  senderId: string;
  text: string;
  createdAt: string;
  seenBy: string[];
}
export const chatMessages: ChatMsg[] = [];

/** Build the canonical scope string for a friend chat between two users. */
export function friendScope(u1: string, u2: string): string {
  const { a, b } = pairKey(u1, u2);
  return `${a}|${b}`;
}

/** Canonical (a,b) ordering so each pair has exactly one row. */
export function pairKey(u1: string, u2: string): { a: string; b: string } {
  return u1 < u2 ? { a: u1, b: u2 } : { a: u2, b: u1 };
}
export function areFriends(u1: string, u2: string): boolean {
  const { a, b } = pairKey(u1, u2);
  return friendships.some(f => f.a === a && f.b === b);
}
export function addFriendship(u1: string, u2: string): void {
  if (u1 === u2 || areFriends(u1, u2)) return;
  const { a, b } = pairKey(u1, u2);
  friendships.push({ a, b, createdAt: new Date().toISOString() });
}
export function removeFriendship(u1: string, u2: string): void {
  const { a, b } = pairKey(u1, u2);
  for (let i = friendships.length - 1; i >= 0; i--) {
    if (friendships[i]!.a === a && friendships[i]!.b === b) friendships.splice(i, 1);
  }
}
export function friendsOf(userId: string): string[] {
  return friendships
    .filter(f => f.a === userId || f.b === userId)
    .map(f => (f.a === userId ? f.b : f.a));
}

// ─── Disk persistence ────────────────────────────────────────────────────
// In-memory state is great for fast prototyping, but every server restart
// (hot reload during development, deploy, crash) wiped all cafés/reels and
// frustrated the user. We now snapshot the full store to a single JSON file
// on a debounced timer and restore it on boot.
import fs from "node:fs";
import path from "node:path";
const STORE_FILE = path.join(process.cwd(), ".store.json");

const COLLECTIONS: Record<string, any[]> = {
  cafes, users, menuItems, tables, orders, bookings, chatInfos, invoices,
  cafeViews, discountCodes, expenses, invoiceTemplates, freeCoffees,
  inventoryItems, reels, reelLikes, reelComments, reelViews, broadcasts,
  usernameRegistry, cafeRatings, friendRequests, friendships, chatMessages,
  reports,
};

function loadFromDisk() {
  try {
    if (!fs.existsSync(STORE_FILE)) return;
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    if (!raw.trim()) return;
    const data = JSON.parse(raw) as Record<string, any[]>;
    for (const [k, arr] of Object.entries(COLLECTIONS)) {
      const incoming = data[k];
      if (Array.isArray(incoming)) {
        arr.length = 0;
        for (const item of incoming) arr.push(item);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[store] restored from ${STORE_FILE}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[store] failed to load: ${(e as Error).message}`);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
let saving = false;
function flush() {
  if (saving) return;
  saving = true;
  try {
    const snapshot: Record<string, any[]> = {};
    for (const [k, arr] of Object.entries(COLLECTIONS)) snapshot[k] = arr;
    fs.writeFileSync(STORE_FILE + ".tmp", JSON.stringify(snapshot));
    fs.renameSync(STORE_FILE + ".tmp", STORE_FILE);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[store] failed to save: ${(e as Error).message}`);
  } finally {
    saving = false;
  }
}

/** Debounced save — call from any mutating handler. Coalesces bursts. */
export function persistStore() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; flush(); }, 400);
}

loadFromDisk();
// Best-effort flush on graceful shutdown.
process.on("SIGTERM", flush);
process.on("SIGINT",  flush);
process.on("beforeExit", flush);
// Safety net: even if a route forgot to call persistStore(), snapshot every
// 5 seconds so we never lose more than a few seconds of activity.
setInterval(() => { if (!saveTimer) flush(); }, 5000).unref();
