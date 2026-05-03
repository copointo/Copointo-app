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
}
export interface CafeTable {
  id: string; cafeId: string; number: number; capacity: number;
  available: boolean; createdAt: string;
  image?: string | null;
  hourlyPricing?: { hours: number; price: number }[];
}
export interface Order {
  id: string; cafeId: string; customerName: string; customerNameEn?: string; customerPhone: string;
  items: { name: string; qty: number; price: number; category?: string }[];
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
  /** Free-coffee redemption code applied to this order, if any. */
  freeCoffeeCode?: string;
  /** Snapshot of the level milestone the redeemed code was earned at. */
  freeCoffeeLevel?: number;
  createdAt: string;
}
export interface CafeView {
  id: string; cafeId: string; userId?: string; userPhone?: string;
  source?: string; viewedAt: string;
}
export interface TableBooking {
  id: string; cafeId: string; customerName: string; customerPhone: string;
  tableId: string; tableNumber: number; date: string; time: string;
  guests: number; status: "pending" | "confirmed" | "cancelled"; createdAt: string;
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
