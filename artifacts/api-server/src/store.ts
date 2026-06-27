export interface Cafe {
  id: string; name: string; ownerName: string; ownerPhone: string; logo: string;
  openTime: string; closeTime: string; managerPassword: string;
  active: boolean; subscriptionPaid: boolean; subscriptionAmount: number;
  subscriptionStart: string; subscriptionEnd: string;
  website: string;
  createdAt: string; rating: number; tags: string[]; address: string; image: string;
  lat?: number; lng?: number;
  /** Copointo Code (per-cafe referral). When enabled, the cafe has a short
   *  3-character code customers can enter when buying coins: the buyer gets a
   *  +20% coin bonus (same price) and the cafe earns a 10% commission settled
   *  monthly (see CopointoRedemption). Code is stored UPPER-CASE and is unique
   *  across all cafes (case-insensitive). */
  copointoCodeEnabled?: boolean;
  copointoCode?: string;
  /** ISO timestamp set the FIRST time the Copointo Code is enabled for this
   *  cafe. Anchors the monthly settlement cycle shown in the super-admin dues
   *  view. Set once and never cleared (survives disable / re-enable). */
  copointoCodeEnabledAt?: string;
  /** ISO timestamp of the last super-admin "تم الدفع" settlement. The cafe's
   *  outstanding due = commission accrued AFTER this instant (or after
   *  copointoCodeEnabledAt when never settled). */
  copointoSettledAt?: string;
  /** When true, this row is part of the "Copointo" showcase/demo bundle and
   *  must be hidden from every endpoint unless the requesting user is the
   *  showcase user (see showcase-seed.ts). */
  showcaseOnly?: boolean;
}
export interface AppUser {
  id: string; username: string; phone: string; level: number;
  totalOrders: number; banned: boolean; joinedAt: string;
  /** Display name + avatar + gender mirrored from mobile so OTHER devices can
   *  show this player's actual profile picture / name / gender on the
   *  leaderboard, friends list, chats, etc. (Local profile is authoritative
   *  on its origin device; this is the cross-device fallback.) */
  name?: string;
  avatar?: string;
  gender?: "male" | "female";
  /** Reason shown to the user when their whole account is banned by super-admin. */
  banReason?: string | null;
  /** ISO timestamp of when the account ban was applied. */
  bannedAt?: string | null;
  /** Permanent game ban (separate from `banned` which blocks the whole account). */
  gameBanned?: boolean;
  /** ISO timestamp; if in the future, the user is temporarily suspended from the game. */
  gameSuspendedUntil?: string | null;
  /** Reason shown to the user when game is suspended/banned. */
  gameSuspendReason?: string | null;
  /** ISO timestamp of when the suspension/ban was applied. */
  gameSuspendedAt?: string | null;
  /** Equipped cosmetic IDs (mirrored from mobile so other devices can render
   *  this player's loadout on profile / leaderboard / chat screens). */
  equippedFrame?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
  equippedCharacter?: string | null;
  equippedUsernameColor?: string | null;
  equippedTextStyle?: string | null;
  /** Per-cafe progress mirror so super-admin level/order bumps reach the
   *  mobile game tab (which reads from `cafeProgress[activeCafe]`, NOT the
   *  global `level`). Keyed by cafeId. Only ever grown by the server when an
   *  admin adjusts progress with an `awardCafeId`; the mobile client merges
   *  via Math.max so device-side progress is never rolled back. */
  cafeProgress?: Record<string, { totalOrders: number; level: number }>;
  /** Coin balance mirrored from the mobile app (AsyncStorage is authoritative
   *  on the origin device; this mirror lets super-admin SEE/EDIT it). */
  coins?: number;
  /** Owned cosmetic IDs per category, mirrored from mobile so super-admin can
   *  see/edit a player's inventory. */
  ownedItems?: {
    frames: string[];
    badges: string[];
    backgrounds: string[];
    characters: string[];
    usernameColors: string[];
    textStyles: string[];
  };
  /** Monotonic counter bumped whenever super-admin edits coins/ownedItems (or
   *  wipes earnings via adjust-progress). The mobile client compares this with
   *  its last-applied version and overwrites local AsyncStorage when the server
   *  version is newer — this is how admin edits "push down" to the device. */
  syncVersion?: number;
  /** Showcase/demo flag — see Cafe.showcaseOnly. */
  showcaseOnly?: boolean;
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
  /** When true, the customer MUST pick a bean type before adding to cart. Default false (optional). */
  beansRequired?: boolean;
  /** Optional sizes the customer can pick from at order time. extraPrice is added to base price. */
  sizes?: { label: string; extraPrice: number }[];
  /** When true, the customer MUST pick a size before adding to cart. Default false (optional). */
  sizesRequired?: boolean;
  /** Showcase/demo flag — see Cafe.showcaseOnly. */
  showcaseOnly?: boolean;
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
    /** Snapshot of menu item's originalPrice (the price BEFORE the cafe's
     *  in-product discount). Used to render strikethrough in invoices and
     *  total savings. */
    originalPrice?: number;
    /** Snapshot of menu item's "buy X get Y" promo, used to render the
     *  freebie line on the invoice. bonusQty (below) is the derived number
     *  of free units the customer received. */
    promoBuyQty?: number;
    promoGetQty?: number;
    bonusQty?: number;
  }[];
  subtotal?: number;
  discountCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  total: number; status: "pending" | "preparing" | "ready" | "done";
  type: "dine" | "car"; tableNumber?: string;
  plateNumber?: string; plateSymbol?: string;
  source?: "direct" | "chat" | "app";
  userId?: string;
  drinkCount?: number;
  prepMinutes?: number;
  confirmedAt?: string;
  /** When the cashier presses "بدء يوم جديد" the order is archived (hidden
   *  from the live orders tab + daily-stats tab) but kept in storage so the
   *  manager analytics (revenue, top products, busiest day, players ranking,
   *  etc.) and printed invoices remain fully intact. */
  archivedAt?: string;
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
  /** Order-level "buy one get one free" (BOGO) offer the cashier applied on a
   *  direct in-cafe order. The cheapest `bogoFreeQty` units in the order are
   *  made free; `bogoDiscount` is their total OMR value (already subtracted
   *  from `total`). bogoFreeQty = floor(totalUnits / 2). */
  bogoApplied?: boolean;
  bogoFreeQty?: number;
  bogoDiscount?: number;
  /** Payment method recorded by the cafe when the order is ready.
   *  - "cash"  → كل المبلغ كاش
   *  - "visa"  → كل المبلغ فيزا
   *  - "split" → مقسوم بين الاثنين (يستخدم cashAmount + visaAmount)
   *  - "free"  → الحساب مجاناً: total counted as 0 in revenue aggregates and
   *              the printed invoice shows a full-amount discount. */
  paymentMethod?: "cash" | "visa" | "split" | "free";
  /** المبلغ المدفوع كاش (بالريال العماني). يُعبّأ عند تثبيت الدفع. */
  cashAmount?: number;
  /** المبلغ المدفوع فيزا (بالريال العماني). يُعبّأ عند تثبيت الدفع. */
  visaAmount?: number;
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

// ─── Online payments (OMPay) ────────────────────────────────────────────
/** What a payment is paying for. Each purpose has a distinct fulfilment
 *  path once the payment is confirmed (order created / booking placed /
 *  coins credited). */
export type PaymentPurpose = "order" | "booking" | "coins";
/** pending → user redirected to OMPay hosted page; paid/failed/canceled set
 *  by the webhook (or the status-poll reconciliation). */
export type PaymentStatus  = "pending" | "paid" | "failed" | "canceled";

export interface Payment {
  id: string;
  /** Merchant reference we send to OMPay and echo back from the webhook. */
  reference: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  /** Amount in OMR major units (e.g. 3.500). OMR has 3 decimals. */
  amount: number;
  currency: string;            // always "OMR" for now
  cafeId?: string | null;
  userId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  description?: string | null;
  /** Purpose-specific payload captured at session-create time so the
   *  webhook can fulfil without trusting the client a second time:
   *   - order   → the full order draft to POST once paid
   *   - booking → the booking draft
   *   - coins   → { packId, coins } to credit */
  metadata?: Record<string, unknown>;
  /** Random capability token returned to the creating client and required
   *  to read this payment's status — prevents id-enumeration of others'
   *  payments without building full per-user auth. Never returned by reads. */
  accessToken?: string;
  /** OMPay session/transaction id returned by the hosted-page create call. */
  providerSessionId?: string | null;
  /** Hosted payment page URL the client opens. */
  checkoutUrl?: string | null;
  /** Fulfilment results, filled in once status flips to "paid". */
  resultOrderId?: string | null;
  resultBookingId?: string | null;
  coinsCredited?: number | null;
  createdAt: string;
  updatedAt: string;
  paidAt?: string | null;
}
export const payments: Payment[] = [];

// ─── Copointo Code redemptions (per-cafe referral) ──────────────────────
/** One row per coin purchase made with a cafe's Copointo Code. The buyer
 *  always pays the normal price; the bonus (+20% coins) is granted on top
 *  client-side, and the cafe earns a 10% commission that Copointo settles
 *  with the cafe monthly. Coins live on the device, so this collection is the
 *  authoritative settlement ledger the cafe dashboard reads. The server
 *  recomputes `coinsBonus`/`commission` from trusted rates so the report never
 *  trusts client math. Amounts are reported in OMR (Oman's currency). */
export interface CopointoRedemption {
  id: string;
  /** Owning cafe for a CODE purchase. `null`/absent for a plain Copointo-store
   *  purchase (no referral code) — those still land here so this collection is
   *  the single ledger of EVERY coin purchase the super-admin reports on. The
   *  per-cafe settlement report filters by cafeId, so code-less rows never
   *  pollute it. */
  cafeId?: string | null;
  /** Snapshot of cafe name + code at redemption time (cafe may rename later).
   *  Absent for code-less purchases. */
  cafeName?: string | null;
  code?: string | null;
  userId?: string | null;
  buyerName?: string | null;
  buyerPhone?: string | null;
  /** Coins the package normally grants (before the referral bonus). */
  coinsBase: number;
  /** +20% bonus coins the buyer received on top (server-computed). */
  coinsBonus: number;
  /** coinsBase + coinsBonus — what actually landed in the buyer's balance. */
  coinsTotal: number;
  /** Package list price in USD (shown in-app) — for reference only. */
  priceUsd?: number | null;
  /** Price in OMR used as the commission base. */
  priceOmr: number;
  /** 10% of priceOmr (server-computed) — the cafe's settlement amount. */
  commission: number;
  /** "web" (OMPay) | "ios" | "android" (store IAP). */
  platform: string;
  /** Idempotency key: OMPay paymentId (web) or store transactionId (native).
   *  Used to reject replays so one purchase can't be settled twice. */
  paymentRef?: string | null;
  /** Hidden from real cafes when the buyer is a showcase/demo viewer. */
  showcaseOnly?: boolean;
  createdAt: string;
}
export const copointoRedemptions: CopointoRedemption[] = [];

/** Copointo Code economics — server-authoritative so neither the buyer's app
 *  nor the cafe dashboard can fudge the numbers. */
export const COPOINTO_CODE_BONUS_RATE      = 0.20; // +20% coins for the buyer
export const COPOINTO_CODE_COMMISSION_RATE = 0.10; // 10% of price to the cafe

/** Coin packages — MUST mirror PACKS + USD_TO_OMR in copointo/app/buy-coins.tsx.
 *  Keyed by base coins so the redeem endpoint can derive the OMR commission base
 *  from a trusted price instead of whatever the client posts. Change both sides
 *  together. */
export const COPOINTO_USD_TO_OMR = 0.384;
export const COPOINTO_COIN_PACKS: Record<number, number /* priceUsd */> = {
  500: 0.99,
  1500: 4.99,
  4500: 9.99,
  12500: 19.99,
  30000: 49.99,
  80000: 99.99,
};

export interface FreeCoffee {
  id: string;
  code: string;             // unique 6-char uppercase code
  userPhone: string;        // owner (the player who earned it)
  userName: string;         // snapshot
  earnedAtLevel: number;    // milestone level (multiple of 6) that earned it
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
  /** Showcase/demo flag — see Cafe.showcaseOnly. */
  showcaseOnly?: boolean;
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
  /** Optional list of recipient user IDs. When present, only these users will
   *  see this broadcast (used for community-ban notifications targeted at
   *  former members). When absent/empty → broadcast is global to all users. */
  toUserIds?: string[];
}
export const broadcasts: Broadcast[] = [];

/**
 * Coin gift sent by the super-admin to a single user. Coins are stored
 * client-side (AsyncStorage), so the server only stores the *intent* to
 * deliver coins; the mobile app polls for unclaimed gifts, credits the
 * balance locally, then POSTs /coin-gifts/:id/claim to mark it consumed.
 */
export interface CoinGift {
  id: string;
  userId: string;
  amount: number;
  message: string;
  createdAt: string;
  claimedAt?: string | null;
  /**
   * When true, this is a super-admin RESET (not a gift). Mobile handles it
   * silently: sets the local coin balance to 0 and claims without showing
   * the celebration modal. `amount` is always 0 for reset records.
   */
  reset?: boolean;
}
export const coinGifts: CoinGift[] = [];

/**
 * Pending game-progress adjustment from the super-admin. Created whenever
 * the admin uses the "تعديل المستوى/عدد الكوفي" form. The mobile client
 * polls /progress-adjustments?userId=..., applies the deltas to its LOCAL
 * cafeProgress + global level/totalOrders (so the change is actually
 * visible on the player's device), then POSTs /progress-adjustments/:id/claim
 * to mark it consumed.
 *
 * NOTE: the existing /admin/users/:id/adjust-progress endpoint ALSO bumps
 * the server-side `user.level` / `user.totalOrders` / `cafeProgress` (for
 * cross-device leaderboard view) — but that bump uses the server's
 * possibly-stale snapshot as the base, and the device-side merge does
 * `Math.max(local, server)`, so admin INCREASES often had no visible
 * effect on the owner's device. This pending-adjustment record is the
 * authoritative signal for the device itself.
 */
export interface ProgressAdjustment {
  id: string;
  userId: string;
  /**
   * `delta` (legacy): apply levelDelta/ordersDelta as relative changes.
   * `set`   (current): set per-cafe progress to ABSOLUTE setLevel/setOrders.
   * `reset` (current): zero out ALL progress — global level/totalOrders AND
   *          every per-cafe entry. Used by the super-admin "تصفير الكل" button.
   * Older records without a mode field are treated as `delta` for compat.
   */
  mode?: "delta" | "set" | "reset";
  levelDelta: number;
  ordersDelta: number;
  /** Used only when mode === "set". Both required if mode is set. */
  setLevel?: number;
  setOrders?: number;
  awardCafeId?: string | null;
  createdAt: string;
  claimedAt?: string | null;
}
export const progressAdjustments: ProgressAdjustment[] = [];

/**
 * Expo push notification token registered per user-device pair.
 * The mobile app registers (or refreshes) its Expo push token after the
 * user logs in / opts in to notifications. The server uses these tokens
 * to deliver push notifications (order ready, free coffee, gifts, new
 * chat messages, friend requests, Copointo broadcasts, etc).
 *
 * Keyed by (userId, token) — the same user may have multiple devices,
 * and the same physical device may host multiple accounts over time.
 * Tokens are uniquely owned: registering an existing token under a new
 * userId reassigns it (so a phone that previously belonged to user A
 * but is now used by user B does not still receive A's notifications).
 */
export interface PushToken {
  id: string;
  userId: string;
  token: string;
  platform: "ios" | "android" | "web" | "unknown";
  updatedAt: string;
}
export const pushTokens: PushToken[] = [];

/**
 * Web Push subscriptions — separate from `pushTokens` because the
 * subscription object shape is completely different from an Expo push
 * token (we need endpoint + keys.p256dh + keys.auth to encrypt the
 * payload). Stored per user so a single browser-on-phone, browser-on-
 * laptop and the mobile app can all receive the same notification.
 */
export interface WebPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: string;
}
export const webPushSubscriptions: WebPushSubscription[] = [];

/**
 * Monthly leaderboard season. Every 30 days the top-10 players (sorted by
 * totalOrders desc, then level desc) win free coins (1st = 50k, 2nd = 45k,
 * ..., 10th = 5k). The countdown shown on the leaderboard is derived from
 * the latest season's `endsAt`. When a season expires:
 *   1. `awardedAt` is stamped and `winners[]` is snapshotted
 *   2. A CoinGift is created for each winner (delivered via the existing
 *      coin-gifts polling pipeline)
 *   3. A fresh season is pushed onto the array with a new endsAt = now + 30d
 * History is kept (we append, never overwrite) so winners can be displayed
 * retroactively if we ever build a "past seasons" view.
 */
export interface MonthlySeason {
  id: string;
  startedAt: string;
  endsAt: string;
  /** ISO timestamp set the moment winners were paid out. null while active. */
  awardedAt?: string | null;
  /** Snapshot of the top-10 at award time. Order matches rank (index 0 = 1st). */
  winners?: Array<{ userId: string; username: string; rank: number; amount: number }>;
}
export const monthlySeasons: MonthlySeason[] = [];

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
  /** Optional free-text review left with the rating (trimmed, max 500 chars). */
  comment?: string;
  /** Snapshot of the rater's display name + avatar at rate time, so the
   *  public ratings list can render them without a user lookup. */
  userName?: string;
  userAvatar?: string;
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
  /** Optional gift identifier when the message is a gift (e.g. "gift-3"). */
  giftId?: string;
  /** Quantity of the gift sent (defaults to 1 when missing). */
  giftQty?: number;
  /** Sender's display username at send time — used by the global gift feed
   *  so we don't have to look up `users[]` (which may be stale or missing
   *  for users who only registered locally). */
  senderName?: string;
  /** Recipient's display username at send time. Same rationale as above. */
  recipientName?: string;
  /** When true the message was deleted for everyone by the sender; clients
   *  render a placeholder ("🚫 تم حذف الرسالة") instead of `text`. */
  deletedForAll?: boolean;
  /** ISO timestamp set when `deletedForAll` flips. The /messages incremental
   *  poll filter ORs this against `createdAt` so deletion events propagate
   *  to recipients on their normal `since=...` poll, not just on cold sync. */
  deletedAt?: string;
  /** Optional image attachment. Stored as `gcs:<key>` (or legacy http URL). */
  imageUrl?: string;
  /** Optional video attachment. Stored as `gcs:<key>` (or legacy http URL). */
  videoUrl?: string;
  /** Optional audio (voice note) attachment. Stored as `gcs:<key>`. */
  audioUrl?: string;
  /** Duration of the audio/video attachment in seconds (display only). */
  mediaDuration?: number;
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

// ─── Gift Vouchers (قسائم شرائية) ────────────────────────────────────────
// Customers gift a money-amount voucher to a friend through the cafe page.
// Payment is recorded immediately (fake-payment for now), and the cafe staff
// confirm fulfilment after contacting the recipient on WhatsApp. Confirmed
// vouchers create an Invoice row so they roll into revenue/analytics.
export interface GiftVoucher {
  id: string;
  cafeId: string;
  /** Voucher value in OMR (minimum 2). */
  amount: number;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  /** How the sender wants to appear to the recipient. */
  fromMode: "anonymous" | "friend" | "named";
  /** Free-text label used when fromMode === "named". */
  fromDisplay?: string;
  status: "pending" | "confirmed";
  /** Paid (mock) at creation time. */
  paidAt: string;
  confirmedAt?: string;
  /** Linked invoice id once the cafe confirms the voucher. */
  invoiceId?: string;
  createdAt: string;
}
export const giftVouchers: GiftVoucher[] = [];

// ─── Communities (game clans) ────────────────────────────────────────────
// One global pool of communities visible to ALL users (for the leaderboard
// "communities" tab). Members + roles + invites are mirrored here so that a
// user on Device A can invite a user on Device B and the invite shows up.
export type CommunityRole = "leader" | "vice" | "senior" | "member";

export interface Community {
  id: string;
  name: string;
  avatar?: string;
  members: string[];
  createdBy: string;
  createdAt: number;
  roles?: Record<string, CommunityRole>;
  /** Showcase/demo flag — see Cafe.showcaseOnly. */
  showcaseOnly?: boolean;
}
export const communities: Community[] = [];

export interface CommunityInvite {
  communityId: string;
  /** Recipient user id — every record is the invite for one user. */
  toUserId: string;
  communityName: string;
  communityAvatar?: string;
  fromUserId: string;
  fromUserName: string;
  invitedAt: number;
}
export const communityInvites: CommunityInvite[] = [];

// ─── PostgreSQL persistence (autoscale-safe) ─────────────────────────────
// Previous versions snapshotted the whole store to a local JSON file. That
// broke on autoscale deployments because each instance had its own disk and
// would not see writes made by sibling instances. We now persist each
// collection as one JSONB row in the `kv_store` table and refresh in-memory
// arrays from the DB before every request handler runs.
import { db, kvStoreTable } from "@workspace/db";
import { sql, inArray } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

const COLLECTIONS: Record<string, any[]> = {
  cafes, users, menuItems, tables, orders, bookings, chatInfos, invoices,
  cafeViews, discountCodes, expenses, invoiceTemplates, freeCoffees,
  inventoryItems, reels, reelLikes, reelComments, reelViews, broadcasts,
  usernameRegistry, cafeRatings, friendRequests, friendships, chatMessages,
  reports, coinGifts, giftVouchers, pushTokens, webPushSubscriptions, monthlySeasons,
  communities, communityInvites, progressAdjustments, payments, copointoRedemptions,
};
const COLLECTION_KEYS = Object.keys(COLLECTIONS);

/** Per-collection version we last loaded into memory, keyed by name. */
const lastLoadedAt = new Map<string, number>();

function setArrayContents(key: string, incoming: unknown) {
  const arr = COLLECTIONS[key];
  if (!arr || !Array.isArray(incoming)) return;
  arr.length = 0;
  for (const item of incoming) arr.push(item);
}

let bootLoadPromise: Promise<void> | null = null;
let bootLoadDone = false;
async function bootLoad(): Promise<void> {
  try {
    const rows = await db.select().from(kvStoreTable);
    for (const row of rows) {
      if (!COLLECTIONS[row.key]) continue;
      setArrayContents(row.key, row.value);
      lastLoadedAt.set(row.key, row.updatedAt.getTime());
    }
    // Mark boot as done BEFORE the optional migration so its flushAll()
    // is allowed through the safety guard in flush().
    bootLoadDone = true;
    // One-time migration from legacy .store.json if the DB is empty.
    if (rows.length === 0) {
      const legacy = path.join(process.cwd(), ".store.json");
      if (fs.existsSync(legacy)) {
        try {
          const data = JSON.parse(fs.readFileSync(legacy, "utf-8")) as Record<string, unknown>;
          for (const k of COLLECTION_KEYS) setArrayContents(k, data[k]);
          await flushAll();
          // eslint-disable-next-line no-console
          console.log(`[store] migrated ${legacy} → kv_store`);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[store] legacy migration failed: ${(e as Error).message}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`[store] loaded ${rows.length} collections from kv_store`);
    // ── One-shot wipe of legacy free-coffee codes (idempotent) ──
    // Per product request: clear any leftover FreeCoffee codes from
    // before the redemption flow was finalised so old/confusing codes
    // can't be used by mistake. Guarded by a DB-backed marker row in
    // kv_store (NOT a local file — local disk is per-instance and would
    // re-trigger the wipe on every new autoscale instance, eating
    // legitimate newly-earned codes). The marker key is reserved with a
    // leading underscore so it never collides with a real collection key.
    try {
      const MARKER_KEY = "_migration:free-coffees-wiped-v1";
      const hasMarker = rows.some(r => r.key === MARKER_KEY);
      if (!hasMarker) {
        const n = freeCoffees.length;
        if (n > 0) {
          freeCoffees.length = 0;
          await flushAll();
        }
        await db
          .insert(kvStoreTable)
          .values({ key: MARKER_KEY, value: { at: new Date().toISOString(), wiped: n } as any })
          .onConflictDoNothing({ target: kvStoreTable.key });
        // eslint-disable-next-line no-console
        console.log(`[store] wiped ${n} legacy free-coffee code(s) (one-shot, DB-marker)`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[store] free-coffee wipe failed: ${(e as Error).message}`);
    }
    // ── Demo data cleanup (idempotent) ──
    // All demo entities (user, cafe, menu) have been removed from the
    // product. This purge runs every boot to clean any leftover demo rows
    // from earlier seeds. No-op once the rows are gone.
    try { await purgeDemoData(); } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[store] demo purge failed: ${(e as Error).message}`);
    }
    // ── Showcase seed (idempotent) ──
    // Seeds the hidden "Copointo" account world: 10 cafes + menus, 100
    // competitor users, 10 reels, 10 communities, friend chats. Every row
    // is flagged showcaseOnly so the public endpoints filter it out from
    // regular users — only the Copointo account sees the demo content.
    // Fire-and-forget: do NOT await — bootLoad must resolve so the
    // request middleware (ensureLoaded) stops blocking. The seed mutates
    // in-memory arrays synchronously up to the final flush, so showcase
    // data is visible to subsequent requests almost immediately.
    void (async () => {
      try {
        const showcase = await import("./showcase-seed");
        await showcase.seedShowcaseData();
        // eslint-disable-next-line no-console
        console.log(`[store] showcase seed complete`);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(`[store] showcase seed failed: ${(e as Error).message}`);
      }
    })();
  } catch (e) {
    // Do NOT mark bootLoadDone on failure — that would let the safety-net
    // interval flush EMPTY arrays over real data. Leaving it false makes
    // every subsequent flush() a no-op until the next process restart,
    // which is the safe failure mode (read-only-ish until DB is healthy).
    // eslint-disable-next-line no-console
    catch (e) {
  console.error("========== DATABASE ERROR ==========");
  console.dir(e, { depth: null });
  console.error("message:", (e as any)?.message);
  console.error("code:", (e as any)?.code);
  console.error("detail:", (e as any)?.detail);
  console.error("schema:", (e as any)?.schema);
  console.error("table:", (e as any)?.table);
  console.error("column:", (e as any)?.column);
  console.error("stack:", (e as any)?.stack);
  console.error("====================================");
}
  }
}

/** Pull any rows whose `updated_at` is newer than what we have cached.
 *  Skipped while a flush is queued/running so we don't clobber local
 *  mutations that haven't been persisted yet. */
export async function refreshFromDb(): Promise<void> {
  if (saveTimer || saving) return;
  try {
    const stamps = await db
      .select({ key: kvStoreTable.key, updatedAt: kvStoreTable.updatedAt })
      .from(kvStoreTable);
    const stale: string[] = [];
    for (const { key, updatedAt } of stamps) {
      if (!COLLECTIONS[key]) continue;
      const have = lastLoadedAt.get(key) ?? 0;
      if (updatedAt.getTime() > have) stale.push(key);
    }
    if (stale.length === 0) return;
    // Re-check: a flush may have started while we awaited the SELECT.
    if (saveTimer || saving) return;
    const rows = await db
      .select()
      .from(kvStoreTable)
      .where(inArray(kvStoreTable.key, stale));
    if (saveTimer || saving) return;
    for (const row of rows) {
      setArrayContents(row.key, row.value);
      lastLoadedAt.set(row.key, row.updatedAt.getTime());
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    catch (e) {
  console.error("========== DATABASE ERROR ==========");
  console.dir(e, { depth: null });
  console.error("message:", (e as any)?.message);
  console.error("code:", (e as any)?.code);
  console.error("detail:", (e as any)?.detail);
  console.error("schema:", (e as any)?.schema);
  console.error("table:", (e as any)?.table);
  console.error("column:", (e as any)?.column);
  console.error("stack:", (e as any)?.stack);
  console.error("====================================");
}
  }
}

async function flushAll(): Promise<void> {
  for (const key of COLLECTION_KEYS) {
    const arr = COLLECTIONS[key]!;
    await db
      .insert(kvStoreTable)
      .values({ key, value: arr as unknown as object })
      .onConflictDoUpdate({
        target: kvStoreTable.key,
        set: { value: arr as unknown as object, updatedAt: sql`now()` },
      });
    lastLoadedAt.set(key, Date.now());
  }
}

let saveTimer: NodeJS.Timeout | null = null;
let saving = false;
let inFlightFlush: Promise<void> | null = null;
async function flush() {
  // If a flush is already in progress, attach to it so callers that
  // `await flush()` actually wait for the on-disk write to complete
  // instead of returning instantly. Critical for `flushNow()` callers.
  if (inFlightFlush) return inFlightFlush;
  // CRITICAL: never write to the DB before the initial bootLoad has
  // finished populating the in-memory arrays. Otherwise the 5s safety-net
  // interval (or a SIGTERM during a slow boot) would snapshot EMPTY
  // arrays over the real data and wipe every collection. We learned this
  // the hard way — it nuked users/cafes/orders/etc. in both dev & prod.
  if (bootLoadPromise) {
    try { await bootLoadPromise; } catch { /* boot logs the error */ }
  }
  if (!bootLoadDone) return;
  saving = true;
  inFlightFlush = (async () => {
    try {
      await flushAll();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[store] flush failed: ${(e as Error).message}`);
    } finally {
      saving = false;
      inFlightFlush = null;
    }
  })();
  return inFlightFlush;
}

/** Synchronous flush — bypasses the 400ms debounce and awaits completion.
 *  Critical writes (user registration, account deletion) must use this so
 *  the row hits the DB BEFORE we respond to the client. Otherwise an
 *  autoscale instance restart, container redeploy, or a sibling instance
 *  hitting `/users/:id/status` before the debounced flush fires can race
 *  and report `exists:false` for an account we just confirmed `ok:true`.
 *
 *  Two-phase: first await any in-flight flush (which may have started
 *  BEFORE our mutation landed in memory), then schedule and await a
 *  fresh flush so our just-pushed row is guaranteed on disk. */
export async function flushNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  // Drain any in-flight flush that started before our mutation —
  // it may have snapshotted the arrays just BEFORE our push().
  if (inFlightFlush) {
    try { await inFlightFlush; } catch { /* swallow — next flush retries */ }
  }
  // Now run a fresh flush that is guaranteed to include our mutation.
  await flush();
}

// ─── Nuke EVERYTHING (super-admin reset) ────────────────────────────────
// Empties every in-memory collection AND truncates the kv_store table so
// the app starts from a clean slate. Used by the super-admin "reset all
// data" endpoint when the platform owner wants to wipe users/cafes/orders/
// leaderboard/etc and start fresh.
//
// Order matters: we clear the in-memory arrays FIRST so any concurrent
// flush that races with the DB truncate writes back EMPTY arrays (not the
// stale populated ones), and we also do the DB delete inside this same
// function so callers can't forget it.
export async function wipeAllData(): Promise<void> {
  for (const key of COLLECTION_KEYS) {
    const arr = COLLECTIONS[key]!;
    arr.length = 0;
    lastLoadedAt.set(key, Date.now());
  }
  try {
    await db.delete(kvStoreTable);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[store] wipeAllData DB delete failed: ${(e as Error).message}`);
    throw e;
  }
}

/** Debounced save — call from any mutating handler. Coalesces bursts. */
// ─── Hard-purge a user and every owned/personal record ──────────────────
// Shared between super-admin "delete user" and the mobile app's self-serve
// "delete my account" button. Returns true on success, false if no user
// matches the given id. Anonymizes business records (orders, bookings,
// cafeViews) so cafe revenue history is preserved without leaking PII;
// frees the gameUsername so the same phone can re-register fresh.
export function purgeUserData(id: string): boolean {
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  const phone = users[idx]!.phone;
  const norm  = (s: string) => String(s ?? "").replace(/\D+/g, "");
  const phoneN = norm(phone);

  users.splice(idx, 1);

  for (let i = usernameRegistry.length - 1; i >= 0; i--) {
    if (usernameRegistry[i]!.userId === id) usernameRegistry.splice(i, 1);
  }
  for (let i = friendRequests.length - 1; i >= 0; i--) {
    const fr = friendRequests[i]!;
    if (fr.fromUserId === id || fr.toUserId === id) friendRequests.splice(i, 1);
  }
  for (let i = friendships.length - 1; i >= 0; i--) {
    const f = friendships[i]!;
    if (f.a === id || f.b === id) friendships.splice(i, 1);
  }
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const m = chatMessages[i]!;
    const inFriendScope = m.kind === "friend" && m.scope.split("|").includes(id);
    if (m.senderId === id || inFriendScope) {
      chatMessages.splice(i, 1);
      continue;
    }
    if (Array.isArray(m.seenBy) && m.seenBy.includes(id)) {
      m.seenBy = m.seenBy.filter(x => x !== id);
    }
  }
  for (let i = reelLikes.length - 1; i >= 0; i--) {
    if (reelLikes[i]!.userId === id || reelLikes[i]!.userId === phone) reelLikes.splice(i, 1);
  }
  for (let i = reelComments.length - 1; i >= 0; i--) {
    if (reelComments[i]!.userId === id || reelComments[i]!.userId === phone) reelComments.splice(i, 1);
  }
  for (let i = reelViews.length - 1; i >= 0; i--) {
    if (reelViews[i]!.userId === id || reelViews[i]!.userId === phone) reelViews.splice(i, 1);
  }
  for (let i = coinGifts.length - 1; i >= 0; i--) {
    if (coinGifts[i]!.userId === id) coinGifts.splice(i, 1);
  }
  for (let i = progressAdjustments.length - 1; i >= 0; i--) {
    if (progressAdjustments[i]!.userId === id) progressAdjustments.splice(i, 1);
  }
  for (let i = cafeRatings.length - 1; i >= 0; i--) {
    if (cafeRatings[i]!.userId === id) cafeRatings.splice(i, 1);
  }
  for (let i = freeCoffees.length - 1; i >= 0; i--) {
    if (norm(freeCoffees[i]!.userPhone) === phoneN) freeCoffees.splice(i, 1);
  }
  for (let i = reports.length - 1; i >= 0; i--) {
    const r = reports[i]!;
    if (r.reporterUserId === id || norm(r.phone) === phoneN) reports.splice(i, 1);
  }
  // Drop gift vouchers where this user is sender OR recipient (PII: names + phones).
  for (let i = giftVouchers.length - 1; i >= 0; i--) {
    const g = giftVouchers[i]!;
    if (norm(g.senderPhone) === phoneN || norm(g.recipientPhone) === phoneN) {
      giftVouchers.splice(i, 1);
    }
  }
  for (const v of cafeViews) {
    if (v.userId === id || (v.userPhone && norm(v.userPhone) === phoneN)) {
      v.userId = undefined;
      v.userPhone = undefined;
    }
  }
  for (const o of orders) {
    if (o.userId === id || norm(o.customerPhone) === phoneN) {
      o.userId = undefined;
      o.customerName  = "مستخدم محذوف";
      o.customerPhone = "";
    }
  }
  for (const b of bookings) {
    if (norm(b.customerPhone) === phoneN) {
      b.customerName  = "مستخدم محذوف";
      b.customerPhone = "";
    }
  }
  // Drop this user's payment records (they carry name/phone + a metadata
  // draft that can contain PII). Revenue history is preserved via the
  // anonymized orders/bookings above, so payments can be hard-removed.
  for (let i = payments.length - 1; i >= 0; i--) {
    const p = payments[i]!;
    if (p.userId === id || (p.customerPhone && norm(p.customerPhone) === phoneN)) {
      payments.splice(i, 1);
    }
  }
  persistStore();
  return true;
}

// Hard-delete a cafe and EVERYTHING that references it. Returns true on
// success, false if no cafe matches the given id. Caller is responsible for
// best-effort deletion of reel video files (it should snapshot the cafe's
// reel videoUrls BEFORE calling this so it still has the keys to delete).
//
// After this returns the cafe is invisible everywhere — menus, tables,
// orders, bookings, invoices, expenses, inventory, discount codes, reels
// (+ likes/comments/views), cafe-views, ratings, gift vouchers, chat
// info, invoice templates, and cafe-targeted reports are all gone. The
// cafe's name/owner-phone are not subject to a uniqueness constraint
// (none is enforced on POST /admin/cafes), so the same name+phone can
// always register again with a brand-new id and zero residual data.
//
// Free-coffee rewards earned at the deleted cafe are kept in
// `freeCoffees` (they belong to the customer, not the cafe) but their
// `earnedAtCafeId` / `redeemedAtCafeId` fields are cleared so the
// mobile redeem flow doesn't try to validate against a non-existent cafe.
export function purgeCafeData(id: string): boolean {
  const idx = cafes.findIndex(c => c.id === id);
  if (idx === -1) return false;
  cafes.splice(idx, 1);

  // Snapshot reel ids first so we can cascade-clean their child rows.
  const reelIds = new Set<string>();
  for (let i = reels.length - 1; i >= 0; i--) {
    if (reels[i]!.cafeId === id) {
      reelIds.add(reels[i]!.id);
      reels.splice(i, 1);
    }
  }
  for (let i = reelLikes.length - 1; i >= 0; i--) {
    if (reelIds.has(reelLikes[i]!.reelId)) reelLikes.splice(i, 1);
  }
  for (let i = reelComments.length - 1; i >= 0; i--) {
    if (reelIds.has(reelComments[i]!.reelId)) reelComments.splice(i, 1);
  }
  for (let i = reelViews.length - 1; i >= 0; i--) {
    if (reelIds.has(reelViews[i]!.reelId)) reelViews.splice(i, 1);
  }

  // Cafe-scoped collections — straight purge by cafeId.
  const purgeBy = <T extends { cafeId?: string | null }>(arr: T[]) => {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]!.cafeId === id) arr.splice(i, 1);
    }
  };
  purgeBy(menuItems);
  purgeBy(tables);
  purgeBy(orders);
  purgeBy(bookings);
  purgeBy(chatInfos);
  purgeBy(invoices);
  purgeBy(cafeViews);
  purgeBy(discountCodes);
  purgeBy(expenses);
  purgeBy(inventoryItems);
  purgeBy(cafeRatings);
  purgeBy(giftVouchers);
  purgeBy(copointoRedemptions);

  // invoiceTemplates uses cafeId but the row id is `${cafeId}|${type}`,
  // so a straight cafeId scan still works.
  for (let i = invoiceTemplates.length - 1; i >= 0; i--) {
    if (invoiceTemplates[i]!.cafeId === id) invoiceTemplates.splice(i, 1);
  }

  // Cafe-targeted reports (kind === "cafe") only — keep generic problem
  // reports unchanged.
  for (let i = reports.length - 1; i >= 0; i--) {
    const r = reports[i]!;
    if (r.kind === "cafe" && r.cafeId === id) reports.splice(i, 1);
  }

  // Customer-owned loyalty rewards: don't delete (they belong to the
  // customer), but unlink them from the deleted cafe so the mobile
  // redeem flow can't accidentally hit a stale id.
  for (const fc of freeCoffees) {
    if (fc.earnedAtCafeId === id) {
      fc.earnedAtCafeId = null;
      fc.earnedAtCafeName = null;
    }
    if (fc.redeemedAtCafeId === id) {
      fc.redeemedAtCafeId = null;
      // The redemption order itself was just purged from `orders`, so the
      // pointer would dangle — clear it too so nothing in the system
      // references a deleted cafe's order.
      fc.redeemedOrderId = null;
    }
  }

  persistStore();
  return true;
}

export function persistStore() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void flush();
  }, 400);
}

// ── Demo seed entities ────────────────────────────────────────────────
// Stable IDs let the mobile demo-login button drop into a known-good
// account/cafe/menu without registering each time. Idempotent: every
// helper checks existence before insertion.
export const DEMO_CAFE_ID = "demo-cafe-1";
export const DEMO_MENU_ID = "demo-menu-1";
export const DEMO_USER_ID = "demo-user-1";
export const DEMO_USER_PHONE = "+96890000000";

/** One-time cleanup: purges the demo cafe + its menu items + the demo
 *  user account from any prior boot's seed. Idempotent — no-op once the
 *  rows are gone. Kept as a permanent step (cheap) so re-deploys against
 *  legacy DBs always end up clean. */
async function purgeDemoData(): Promise<void> {
  let dirty = false;
  const cafeIdx = cafes.findIndex(c => c.id === DEMO_CAFE_ID);
  if (cafeIdx !== -1) {
    cafes.splice(cafeIdx, 1);
    dirty = true;
  }
  for (let i = menuItems.length - 1; i >= 0; i--) {
    if (menuItems[i].cafeId === DEMO_CAFE_ID || menuItems[i].id === DEMO_MENU_ID) {
      menuItems.splice(i, 1);
      dirty = true;
    }
  }
  const userIdx = users.findIndex(u => u.id === DEMO_USER_ID || u.phone === DEMO_USER_PHONE);
  if (userIdx !== -1) {
    users.splice(userIdx, 1);
    dirty = true;
  }
  if (dirty) {
    try { await flushAll(); } catch { /* persist will retry */ }
  }
}

/** Awaited at server boot from app.ts so the first request sees full data. */
export function ensureLoaded(): Promise<void> {
  if (!bootLoadPromise) bootLoadPromise = bootLoad();
  return bootLoadPromise;
}

// Kick off the initial load eagerly.
void ensureLoaded();

// Best-effort flush on graceful shutdown. The guard in flush() ensures we
// never write empty arrays if SIGTERM arrives before bootLoad finished.
const shutdownFlush = () => { void flush(); };
process.on("SIGTERM", shutdownFlush);
process.on("SIGINT",  shutdownFlush);
process.on("beforeExit", shutdownFlush);
// Safety net: even if a route forgot to call persistStore(), snapshot every
// 5 seconds so we never lose more than a few seconds of activity.
setInterval(() => { if (!saveTimer) void flush(); }, 5000).unref();
