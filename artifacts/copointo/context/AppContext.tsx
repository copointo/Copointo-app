import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_BASE } from "@/constants/api";
import { backfillEquipmentToServer } from "@/lib/equipmentSync";
import { runAccountResetHandlers } from "@/lib/accountResetRegistry";
// Side-effect imports: ensure each cosmetic/coin/inventory hook module is
// loaded so its registerAccountResetHandler() call has run before
// deleteAccount/runAccountResetHandlers fires. Without these, hooks that
// haven't been mounted yet won't reset their module-level _cache, leaving
// stale data visible to the next account that signs in on this device.
import "@/hooks/useFrames";
import "@/hooks/useBadges";
import "@/hooks/useBackgrounds";
import "@/hooks/useUsernameColors";
import "@/hooks/useTextStyles";
import "@/hooks/useCharacters";
import "@/hooks/useCoins";
import "@/hooks/useGiftInventory";

/**
 * Wipe device-scoped account data (coins, gift inventory, owned/equipped
 * cosmetics, cart, order history, welcome-bonus flags, etc.) so a NEW user
 * signing in on this phone starts from a clean slate instead of inheriting
 * the previous account's wallet and items. Mirrors `deleteAccount`'s local
 * cleanup but does NOT touch the server — the previous account is left
 * intact, only its on-device footprint is cleared.
 *
 * Per-user keyed data (`friends:${id}`, `copointo_chats_v2:${id}`, etc.)
 * is intentionally NOT wiped here — those are already scoped to the user
 * id and won't bleed across accounts on hydration.
 */
async function wipeDeviceAccountData(prevUserId: string | null): Promise<void> {
  const emptyArrayKeys = [
    "copointo_frames_owned_v3",
    "copointo_badges_owned_v3",
    "copointo_backgrounds_owned_v3",
    "copointo_username_colors_owned_v1",
    "copointo_text_styles_owned_v1",
    "copointo_characters_owned_v1",
  ];
  const emptyStringKeys = [
    "copointo_frame_equipped_v3",
    "copointo_badge_equipped_v3",
    "copointo_background_equipped_v3",
    "copointo_username_color_equipped_v1",
    "copointo_text_style_equipped_v1",
    "copointo_character_equipped_v1",
  ];
  const emptyWrites: [string, string][] = [
    ...emptyArrayKeys.map(k => [k, "[]"] as [string, string]),
    ...emptyStringKeys.map(k => [k, ""] as [string, string]),
    ["copointo_gift_inventory_v1", "{}"],
    ["copointo_coins_balance_v1", "0"],
  ];
  try { await AsyncStorage.multiSet(emptyWrites); } catch {}

  const removeKeys = [
    "cart", "orderHistory", "likedVideos",
    // Drop welcome-bonus + level-reward acks so the new account on this
    // device gets the full new-user experience (200-coin signup bonus,
    // reward popups, milestone alerts).
    "copointo_coins_grant_signup_200_v1",
    "copointo_coins_grant_190k_v1",
    "copointo_coin_milestones_acked_v1",
    "copointo_level_rewards_acked_v1",
    "copointo_booking_last_seen_v1",
    "copointo_broadcast_last_seen_v1",
    "copointo_free_coffee_last_seen_v1",
    "copointo_gift_feed_last_seen_v1",
    "copointo_saved_order_info_v1",
  ];
  if (prevUserId) {
    removeKeys.push(
      `friends:${prevUserId}`,
      `friend_requests_in:${prevUserId}`,
      `friend_requests_out:${prevUserId}`,
      `activeGameCafeId:${prevUserId}`,
      `copointo_chats_v2:${prevUserId}`,
      `copointo_unread_v2:${prevUserId}`,
      `copointo_groups_v2:${prevUserId}`,
      `copointo_rank_ahead_v1:${prevUserId}`,
    );
  }
  try { await AsyncStorage.multiRemove(removeKeys); } catch {}

  // Sweep per-cafe chat-bot drafts (keys we don't know up-front) so no
  // order/booking draft with the previous user's name+phone survives.
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cafeChatKeys = allKeys.filter(k => k.startsWith("copointo_chat_state_v1_"));
    if (cafeChatKeys.length) await AsyncStorage.multiRemove(cafeChatKeys);
  } catch {}

  // Flush every cosmetic/coin/inventory hook's module-level `_cache` and
  // broadcast empty defaults so the React tree reflects the wipe
  // immediately. Without this, the new account inherits the previous
  // user's loadout in-memory until full app reload.
  try { runAccountResetHandlers(); } catch {}
}

/**
 * Reserve a `gameUsername` for a user on the API server. The server is the
 * single source of truth for username uniqueness across all devices, since
 * each mobile client only sees its own AsyncStorage. Returns ok on success
 * or an Arabic error message (e.g. when another user already owns it).
 */
export async function claimGameUsername(
  userId: string,
  username: string,
): Promise<AuthResult> {
  try {
    const r = await fetch(`${API_BASE}/usernames/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, username }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error || "تعذر حجز يوزر اللعبة" };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
  }
}

/**
 * Public roster of every registered player across all devices, fetched from
 * the server. The mobile leaderboard merges this with the local
 * `registeredUsers` so a freshly-registered user on Device A shows up in the
 * "Oman" ranking on Device B without any manual sync.
 *
 * Server returns minimal safe fields (no password / friends / avatar). The
 * merge below preserves richer local data when available.
 */
export interface PublicServerUser {
  id: string;
  username: string;
  phone: string;
  level: number;
  totalOrders: number;
  joinedAt?: string;
  /** Mirrored profile bits (display name, picture, gender) so cross-device
   *  leaderboards / friends lists / chats render the real avatar instead
   *  of the default silhouette. */
  name?: string | null;
  avatar?: string | null;
  gender?: "male" | "female" | null;
  equippedFrame?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
  equippedCharacter?: string | null;
  equippedUsernameColor?: string | null;
  equippedTextStyle?: string | null;
  /** Per-cafe progress mirrored from the server. Set by super-admin
   *  adjust-progress with an awardCafeId. Mobile merges via Math.max so
   *  device-side progress is never rolled back. */
  cafeProgress?: Record<string, { totalOrders: number; level: number }> | null;
}

/** Push the signed-in user's profile bits (name / avatar / gender) to the
 *  server so OTHER devices' leaderboards show the real picture instead of
 *  the default silhouette. Fire-and-forget; failure is harmless. */
export async function syncProfileToServer(args: {
  id: string;
  name?: string;
  avatar?: string;
  gender?: "male" | "female";
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/users/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: args.id,
        name:   args.name   ?? "",
        avatar: args.avatar ?? "",
        gender: args.gender ?? "",
      }),
    });
  } catch { /* network errors are non-fatal */ }
}
export async function fetchPublicUsers(): Promise<PublicServerUser[]> {
  try {
    const r = await fetch(`${API_BASE}/users/public`);
    if (!r.ok) return [];
    const data = await r.json().catch(() => ({}));
    return Array.isArray(data?.users) ? (data.users as PublicServerUser[]) : [];
  } catch {
    return [];
  }
}

/**
 * Mirror a mobile-app user record into the server's `users` collection so the
 * super-admin page lists every real registered player (not just those who
 * placed an order). Idempotent: safe to call multiple times for the same id.
 */
export type AuthResultEx = AuthResult & { banned?: boolean; banReason?: string | null };

// ─── Phone-OTP helpers ────────────────────────────────────────────────────
// New-user registration and password reset both require proving phone
// ownership via SMS code sent through the api-server (Twilio under the
// hood). These helpers wrap the three relevant endpoints.
export async function sendOtp(
  phone: string,
  purpose: "register" | "reset",
): Promise<{ ok: true; expiresInSec: number } | { ok: false; error: string; retryAfterSec?: number }> {
  try {
    const r = await fetch(`${API_BASE}/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, purpose }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok) return { ok: true, expiresInSec: Number(data.expiresInSec) || 300 };
    return { ok: false, error: data?.error || "تعذر إرسال رمز التحقق", retryAfterSec: data?.retryAfterSec };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
  }
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: "register" | "reset",
): Promise<{ ok: true; token: string } | { ok: false; error: string; attemptsLeft?: number }> {
  try {
    const r = await fetch(`${API_BASE}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, purpose }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok && typeof data.token === "string") return { ok: true, token: data.token };
    return { ok: false, error: data?.error || "رمز غير صحيح", attemptsLeft: data?.attemptsLeft };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
  }
}

export async function confirmPasswordReset(
  otpToken: string,
): Promise<{ ok: true; phone: string } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${API_BASE}/auth/password/reset-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otpToken }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok && typeof data.phone === "string") return { ok: true, phone: data.phone };
    return { ok: false, error: data?.error || "تعذر إعادة تعيين كلمة المرور" };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
  }
}

export async function syncUserToServer(args: {
  id: string;
  username: string;
  phone: string;
  joinedAt?: string;
  otpToken?: string;
}): Promise<AuthResultEx> {
  try {
    const r = await fetch(`${API_BASE}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok) return { ok: true };
    // Server returns 403 + { banned: true, banReason } when the phone or
    // username belongs to a banned account — surface that to the caller so
    // the auth UI can show the proper "you've been banned" message instead
    // of a generic "phone already registered" error.
    if (data?.banned) {
      return {
        ok: false,
        banned: true,
        banReason: data?.banReason ?? null,
        error: data?.error || "تم حظر هذا الحساب من الموقع",
      };
    }
    return { ok: false, error: data?.error || "تعذر تسجيل المستخدم على الخادم" };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
  }
}

/** Lightweight ban-status check used by the in-app ban-poll. Returns
 *  `null` on any network/parse error so callers can distinguish "server
 *  says not-banned" from "couldn't reach the server" — important so a
 *  transient failure doesn't accidentally clear a previously-cached ban. */
export async function fetchUserStatus(
  userId: string,
): Promise<{ exists: boolean; banned: boolean; banReason?: string | null } | null> {
  try {
    const r = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/status`);
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    if (!data || data.ok !== true) return null;
    return {
      exists: data.exists !== false,
      banned: !!data.banned,
      banReason: data.banReason ?? null,
    };
  } catch {
    return null;
  }
}

export type Gender = "male" | "female";

export interface CafeProgress {
  cafeId: string;
  cafeName: string;
  totalOrders: number;
  level: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone: string;
  gameUsername: string;
  password: string;
  avatar?: string;
  gender?: Gender;
  level: number;
  totalOrders: number;
  points: number;
  cafeProgress?: Record<string, CafeProgress>;
  /** Number of levels gained today (across all cafés). */
  levelsToday?: number;
  /** Date string (YYYY-MM-DD) for which `levelsToday` applies. */
  levelsTodayDate?: string;
  /** Equipped cosmetic IDs mirrored from the server so we can render OTHER
   *  users' loadouts on profile / leaderboard / chat. The current device
   *  remains the authoritative source for the local user via the per-cosmetic
   *  hooks (useFrames / useBadges / etc.). */
  equippedFrame?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
  equippedCharacter?: string | null;
  equippedUsernameColor?: string | null;
  equippedTextStyle?: string | null;
}

/** Hard cap: a user can only gain this many levels per calendar day. */
export const DAILY_LEVEL_CAP = 10;

/** Local YYYY-MM-DD string for "today" in the device's timezone. */
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

export interface CartItem {
  id: string;
  /** Original menu-item id (without variant suffix). Used to look up stock, etc. */
  menuItemId?: string;
  name: string;
  price: number;
  quantity: number;
  cafeId: string;
  cafeName: string;
  image?: string;
  /** Menu category — used for free-coffee eligibility (drinks only, not طعام/حلى). */
  category?: string;
  /** Customer-picked bean type (when the menu item defined `beans`). */
  selectedBean?: string;
  /** Customer-picked size label (when the menu item defined `sizes`). */
  selectedSize?: string;
  /** Snapshot of the size's extraPrice (already added into `price`). */
  sizeExtraPrice?: number;
  /** Snapshot of menu item's originalPrice when this line was added — used to
   *  show "before/after discount" strikethrough in cart, invoice and chat
   *  summary. Only set when the menu item actually had a discount. */
  originalPrice?: number;
  /** Snapshot of menu item's "buy X get Y" promo, used to derive how many
   *  bonus units the customer should receive based on `quantity`.
   *  bonusQty = floor(quantity / promoBuyQty) * promoGetQty. */
  promoBuyQty?: number;
  promoGetQty?: number;
}

interface AppContextType {
  user: User | null;
  /** True once the initial AsyncStorage read completes (used by the global
   *  AuthGate to avoid flashing the login screen for signed-in users). */
  hydrated: boolean;
  /** Set when the server reports the current user is banned. The AuthGate
   *  swaps the whole UI for a full-screen ban screen showing this reason
   *  and a logout-only button. `null` while the user is in good standing. */
  bannedInfo: { reason: string } | null;
  setUser: (user: User | null) => void;
  register: (
    data: Omit<User, "id" | "level" | "totalOrders" | "points">,
    otpToken: string,
  ) => Promise<AuthResult>;
  login: (phone: string, password: string) => Promise<AuthResult>;
  /** Reset the password for the account that owns `phone`, after the
   *  caller has already verified phone ownership via OTP and obtained a
   *  reset token. Updates the local AsyncStorage record (passwords are
   *  device-local) and signs the user in. */
  resetPasswordWithOtp: (otpToken: string, newPassword: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  /** Permanently delete the current account from the server (game stats,
   *  free coffees, reel engagement, chats, friends, reports, ratings) and
   *  wipe every local AsyncStorage key tied to it, then sign out. The
   *  phone number is freed so it can be used to register a brand-new
   *  account afterwards with different details. */
  deleteAccount: () => Promise<AuthResult>;
  /** Initial step the AuthModal should open on (e.g. "register-form" right
   *  after the user permanently deletes their account so they land on the
   *  "create new account" tab instead of the default Login tab). The modal
   *  reads it once on mount and then calls `consumeInitialAuthStep()` to
   *  clear it so it doesn't override later auth flows. */
  initialAuthStep: "login" | "register-form" | null;
  consumeInitialAuthStep: () => void;
  registeredUsers: User[];
  friends: string[];
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  /** Friend requests I sent that are still pending (target user IDs) */
  outgoingRequests: string[];
  /** Friend requests sent to me that are still pending (sender user IDs) */
  incomingRequests: string[];
  /** Server-issued receipts for requests I sent that the other user declined.
   *  Shown once in the notifications screen, then dismissed via `ackRejection`. */
  rejectionNotifications: { id: string; toUserId: string; decidedAt?: string }[];
  /** Send a friend request from current user to targetId (waits for accept) */
  sendFriendRequest: (targetId: string) => Promise<void>;
  /** Accept a pending request from senderId — adds to friends on both sides */
  acceptFriendRequest: (senderId: string) => Promise<void>;
  /** Decline a pending request from senderId */
  declineFriendRequest: (senderId: string) => Promise<void>;
  /** Cancel a request I previously sent to targetId */
  cancelFriendRequest: (targetId: string) => Promise<void>;
  /** Dismiss a "your request was declined" receipt (by request id from
   *  `rejectionNotifications`). */
  ackRejection: (requestId: string) => Promise<void>;
  /** Re-read friend + request lists from the server (call when opening notifications) */
  refreshFriendData: () => Promise<void>;
  /** Fetch the global users roster from the server and merge into
   *  `registeredUsers` so every device sees every registered player.
   *  Called on mount, after registration, and on leaderboard focus. */
  refreshAllUsers: () => Promise<void>;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity">) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  likedVideos: string[];
  toggleLikeVideo: (videoId: string) => void;
  orderHistory: Order[];
  addOrder: (order: Order) => void;
  activeOrder: ActiveOrder | null;
  setActiveOrder: (o: ActiveOrder | null) => void;
  /** Currently-displayed café in the Game tab (per-café progress view). */
  activeGameCafeId: string | null;
  setActiveGameCafeId: (cafeId: string | null) => void;
  /** Increment per-café progress (and global aggregate) when an order completes. */
  addCafeOrder: (cafeId: string, cafeName: string, qty: number) => void;
}

export interface ActiveOrder {
  orderId: string;
  cafeId: string;
  cafeName: string;
  prepMinutes: number;
  drinkQty: number;
  startedAt: number; // epoch ms
}

export interface Order {
  id: string;
  cafeId: string;
  cafeName: string;
  items: CartItem[];
  total: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
  tableNumber?: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => { currentUserIdRef.current = user?.id ?? null; }, [user?.id]);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);

  const [initialAuthStep, setInitialAuthStep] = useState<"login" | "register-form" | null>(null);
  const consumeInitialAuthStep = useCallback(() => setInitialAuthStep(null), []);
  const [friends, setFriends] = useState<string[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<string[]>([]);
  const [rejectionNotifications, setRejectionNotifications] = useState<
    { id: string; toUserId: string; decidedAt?: string }[]
  >([]);
  // Lookup maps: server keys requests by `id`, but the app's UI talks in
  // user IDs (senderId / targetId). These refs let accept/decline/cancel
  // resolve the underlying server request id without an extra round-trip.
  const incomingMap = useRef<Map<string, string>>(new Map()); // fromUserId → requestId
  const outgoingMap = useRef<Map<string, string>>(new Map()); // toUserId   → requestId
  const [cart, setCart] = useState<CartItem[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [activeOrder, setActiveOrderState] = useState<ActiveOrder | null>(null);
  const [activeGameCafeId, setActiveGameCafeIdState] = useState<string | null>(null);
  // `hydrated` flips to true once the initial AsyncStorage read finishes.
  // Consumers (notably the global AuthGate) wait on this flag so the
  // login screen does not flash for users who are already signed in.
  const [hydrated, setHydrated] = useState(false);
  // Set when the server reports the current user is banned. The AuthGate
  // swaps the whole UI for a full-screen ban screen showing this reason
  // and a logout-only button. `null` while the user is in good standing.
  const [bannedInfo, setBannedInfo] = useState<{ reason: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // ─── Ban-status poll ───────────────────────────────────────────────────
  // While a user is signed in, poll the server every 8s to detect when the
  // super-admin bans this account. The moment `banned: true` flips, the
  // AuthGate swaps the entire UI for a full-screen ban screen so the user
  // cannot keep using the app. Cleared on logout / when ban is lifted.
  //
  // We also CACHE the last-known ban state per user in AsyncStorage. This
  // way, if a banned user kills the app and re-opens it offline, we still
  // gate them — `fetchUserStatus()` returns {banned:false} on network
  // failure, so without this cache an offline restart would let a banned
  // user back in until the next successful poll.
  useEffect(() => {
    if (!user?.id) { setBannedInfo(null); return; }
    const uid = user.id;
    const cacheKey = `ban_cache:${uid}`;
    let cancelled = false;
    // Counter for consecutive "exists:false" readings. We only kick a user
    // out of their session after THREE consecutive confirmations spread over
    // ~24 s, so a transient blip — e.g. an autoscale instance that hasn't
    // yet pulled the latest `kv_store` row, or a redeploy mid-flush — can't
    // accidentally log out a freshly-registered user. A single "exists:true"
    // resets the counter.
    let missCount = 0;
    // Prime from cache so a previously-banned user is gated INSTANTLY on
    // cold-start even before the first network poll resolves.
    AsyncStorage.getItem(cacheKey).then(raw => {
      if (cancelled || !raw) return;
      try {
        const cached = JSON.parse(raw) as { banned: boolean; reason?: string };
        if (cached?.banned) {
          setBannedInfo({ reason: cached.reason || "تم حظر هذا الحساب من قِبل إدارة كوبوينتو" });
        }
      } catch {}
    }).catch(() => {});
    const check = async () => {
      const status = await fetchUserStatus(uid);
      if (cancelled || status === null) return; // network error → keep current state
      // Server hard-deleted this account (or DB was wiped) — kick the
      // device out of the zombie session and force a fresh registration.
      // Require 3 consecutive confirmations to avoid spurious logout from
      // autoscale-instance lag or transient DB read-after-write skew.
      if (!status.exists) {
        missCount += 1;
        if (missCount < 3) return;
        try { await AsyncStorage.removeItem("currentUser"); } catch {}
        try { await AsyncStorage.removeItem(cacheKey); } catch {}
        // Strip the dead user from the local `registeredUsers` cache too,
        // so re-registering with the same phone/username won't be blocked
        // by a stale local entry.
        try {
          const rawList = await AsyncStorage.getItem("registeredUsers");
          if (rawList) {
            const list: User[] = JSON.parse(rawList);
            const cleaned = list.filter(u => u.id !== uid);
            await AsyncStorage.setItem("registeredUsers", JSON.stringify(cleaned));
            setRegisteredUsers(cleaned);
          }
        } catch {}
        setUserState(null);
        setFriends([]);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        setRejectionNotifications([]);
        setActiveGameCafeIdState(null);
        setBannedInfo(null);
        setInitialAuthStep("register-form");
        return;
      }
      // Server confirmed user exists — reset the miss counter so a single
      // good reading wipes out any prior transient misses.
      missCount = 0;
      if (status.banned) {
        const reason = status.banReason || "تم حظر هذا الحساب من قِبل إدارة كوبوينتو";
        setBannedInfo({ reason });
        AsyncStorage.setItem(cacheKey, JSON.stringify({ banned: true, reason })).catch(() => {});
      } else {
        setBannedInfo(null);
        AsyncStorage.removeItem(cacheKey).catch(() => {});
      }
    };
    check();
    const t = setInterval(check, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]);

  const loadData = async () => {
    try {
      const [cartData, likesData, ordersData, userData, regData] = await Promise.all([
        AsyncStorage.getItem("cart"),
        AsyncStorage.getItem("likedVideos"),
        AsyncStorage.getItem("orderHistory"),
        AsyncStorage.getItem("currentUser"),
        AsyncStorage.getItem("registeredUsers"),
      ]);
      if (cartData) setCart(JSON.parse(cartData));
      if (likesData) setLikedVideos(JSON.parse(likesData));
      if (ordersData) setOrderHistory(JSON.parse(ordersData));
      if (regData) setRegisteredUsers(JSON.parse(regData));
      if (userData) {
        const parsed: User = JSON.parse(userData);
        setUserState(parsed);
        // Zombie-session detection now lives ENTIRELY in the periodic ban-
        // poll useEffect (above), which requires 3 consecutive "exists:false"
        // confirmations before kicking the user out. The previous one-shot
        // check here was kicking freshly-registered users out on cold-start
        // when an autoscale instance hadn't yet pulled their kv_store row.
        // Best-effort: if user exists, refresh their server-side username/
        // phone (game state etc) — fire-and-forget.
        fetchUserStatus(parsed.id).then(async status => {
          if (!status || !status.exists) return; // network error or zombie — leave to periodic guard
          // User exists server-side — make sure the row is fresh (username
          // / phone might have been updated locally). Fire-and-forget.
          syncUserToServer({
            id: parsed.id,
            username: parsed.gameUsername || parsed.name,
            phone: parsed.phone,
          }).catch(() => {});
        }).catch(() => {});
        // One-shot push of every locally-equipped cosmetic so older accounts
        // show their loadout on other devices without re-equipping anything.
        backfillEquipmentToServer(parsed.id).catch(() => {});
        const activeCafeRaw = await AsyncStorage.getItem(`activeGameCafeId:${parsed.id}`);
        setActiveGameCafeIdState(activeCafeRaw || null);
        // Load per-user friends + friend requests
        const [fRaw, inRaw, outRaw] = await Promise.all([
          AsyncStorage.getItem(`friends:${parsed.id}`),
          AsyncStorage.getItem(`friend_requests_in:${parsed.id}`),
          AsyncStorage.getItem(`friend_requests_out:${parsed.id}`),
        ]);
        setFriends(fRaw ? JSON.parse(fRaw) : []);
        setIncomingRequests(inRaw ? JSON.parse(inRaw) : []);
        setOutgoingRequests(outRaw ? JSON.parse(outRaw) : []);
      }
    } catch (e) {}
    finally { setHydrated(true); }
  };

  /**
   * Pull the global user roster from the server and merge it into
   * `registeredUsers`. Local profiles are authoritative (passwords, avatars,
   * cafeProgress, friends, etc. only live on-device); for users we have no
   * local record of, we synthesize a minimal placeholder profile good enough
   * for the leaderboard to display.
   *
   * Server-side `level` / `totalOrders` win when they are higher than the
   * local snapshot — important for accounts the player owns on multiple
   * devices, and harmless for everyone else.
   */
  const refreshAllUsers = useCallback(async () => {
    const remote = await fetchPublicUsers();
    setRegisteredUsers(prev => {
      // The server is the authoritative source of truth for who appears on
      // OTHER devices' leaderboards / friend lists, but local accounts that
      // were registered on THIS device must never be dropped by the poll —
      // their password lives only in AsyncStorage and dropping the entry
      // would lock the owner out of login. We therefore keep:
      //   • the currently signed-in user (so the profile UI never blanks);
      //   • every locally-registered account (anything with a non-empty
      //     password is a real credential on this device);
      //   • everyone the server currently returns.
      // Anything else (cross-device placeholder users that the server has
      // since removed) is pruned so super-admin wipes propagate.
      const byId = new Map<string, User>();
      for (const u of prev) {
        if (
          u.id === currentUserIdRef.current ||
          (u.password ?? "") !== ""
        ) {
          byId.set(u.id, u);
        }
      }
      for (const r of remote) {
        const local = prev.find(u => u.id === r.id);
        if (local) {
          // Keep local rich data; only bump level / totalOrders if server has
          // more. Server is AUTHORITATIVE for equipped cosmetics so a deliberate
          // unequip on another device (server returns null) clears the field
          // here too. We only fall back to the local value when the field is
          // entirely absent from the server payload (e.g. older API version).
          const merged: User = {
            ...local,
            level: Math.max(local.level ?? 0, r.level ?? 0),
            totalOrders: Math.max(local.totalOrders ?? 0, r.totalOrders ?? 0),
            // Profile bits: prefer the server's mirrored value when present
            // (so other devices' avatar/name/gender updates flow in), but
            // keep the local value as a fallback when the server hasn't
            // received a mirror yet (e.g. older account).
            name:   r.name   ?? local.name,
            avatar: r.avatar ?? local.avatar,
            gender: (r.gender ?? local.gender) as User["gender"],
            equippedFrame:         "equippedFrame"         in r ? r.equippedFrame         ?? null : local.equippedFrame         ?? null,
            equippedBadge:         "equippedBadge"         in r ? r.equippedBadge         ?? null : local.equippedBadge         ?? null,
            equippedBackground:    "equippedBackground"    in r ? r.equippedBackground    ?? null : local.equippedBackground    ?? null,
            equippedCharacter:     "equippedCharacter"     in r ? r.equippedCharacter     ?? null : local.equippedCharacter     ?? null,
            equippedUsernameColor: "equippedUsernameColor" in r ? r.equippedUsernameColor ?? null : local.equippedUsernameColor ?? null,
            equippedTextStyle:     "equippedTextStyle"     in r ? r.equippedTextStyle     ?? null : local.equippedTextStyle     ?? null,
          };
          byId.set(r.id, merged);
        } else {
          // Brand-new player from another device — synthesize a read-only profile.
          const placeholder: User = {
            id: r.id,
            name: r.name ?? r.username,
            phone: r.phone,
            gameUsername: r.username,
            // Password never leaves its origin device. The empty value is
            // fine because remote profiles are display-only on this device.
            password: "",
            level: r.level ?? 0,
            totalOrders: r.totalOrders ?? 0,
            points: 0,
            avatar: r.avatar ?? undefined,
            gender: (r.gender ?? undefined) as User["gender"],
            equippedFrame:         r.equippedFrame         ?? null,
            equippedBadge:         r.equippedBadge         ?? null,
            equippedBackground:    r.equippedBackground    ?? null,
            equippedCharacter:     r.equippedCharacter     ?? null,
            equippedUsernameColor: r.equippedUsernameColor ?? null,
            equippedTextStyle:     r.equippedTextStyle     ?? null,
          };
          byId.set(r.id, placeholder);
        }
      }
      const next = Array.from(byId.values());
      AsyncStorage.setItem("registeredUsers", JSON.stringify(next)).catch(() => {});
      return next;
    });
    // ── Mirror server-side level/totalOrders bumps into the CURRENT user
    // state too. This is critical for DIRECT in-cafe orders: the cashier
    // credits drinks to the customer's account via the cafe dashboard while
    // the customer is NOT touching the app, so the local `addCafeOrder`
    // path never runs. Without this sync, the bumped level only shows up
    // on other devices' leaderboards — the owning device's own Profile /
    // Game tab would stay frozen until next login. Server is monotonic
    // (`/users/progress` only increases), so taking max() is safe.
    const myId = currentUserIdRef.current;
    if (myId) {
      const mine = remote.find(r => r.id === myId);
      if (mine) {
        setUserState(prev => {
          if (!prev || prev.id !== myId) return prev;
          const remoteLvl    = mine.level ?? 0;
          const remoteOrders = mine.totalOrders ?? 0;
          const localLvl     = prev.level ?? 0;
          const localOrders  = prev.totalOrders ?? 0;
          // Per-cafe progress merge: super-admin adjust-progress with an
          // awardCafeId writes per-cafe level/totalOrders on the server. The
          // mobile game tab reads `cafeProgress[activeCafe].level` so without
          // this merge the in-game level stays frozen even though the global
          // level updates. Math.max keeps device-side progress authoritative.
          const localProg  = prev.cafeProgress ?? {};
          const remoteProg = mine.cafeProgress ?? {};
          let progChanged = false;
          const mergedProg: Record<string, CafeProgress> = { ...localProg };
          for (const [cafeId, rp] of Object.entries(remoteProg)) {
            const lp = localProg[cafeId];
            const nextLvl    = Math.max(lp?.level       ?? 0, rp.level       ?? 0);
            const nextOrders = Math.max(lp?.totalOrders ?? 0, rp.totalOrders ?? 0);
            if (!lp || nextLvl !== lp.level || nextOrders !== lp.totalOrders) {
              mergedProg[cafeId] = {
                cafeId,
                cafeName: lp?.cafeName ?? cafeId,
                level: nextLvl,
                totalOrders: nextOrders,
              };
              progChanged = true;
            }
          }
          // Global level rises to the max across all (possibly newly-merged) cafes
          // so Profile / Leaderboard stay consistent with the cafe view.
          const maxCafeLvl = Math.max(0, ...Object.values(mergedProg).map(c => c.level));
          const nextGlobalLvl    = Math.max(localLvl, remoteLvl, maxCafeLvl);
          const nextGlobalOrders = Math.max(localOrders, remoteOrders);
          if (
            !progChanged &&
            nextGlobalLvl === localLvl &&
            nextGlobalOrders === localOrders
          ) return prev;
          const updated: User = {
            ...prev,
            level:       nextGlobalLvl,
            totalOrders: nextGlobalOrders,
            cafeProgress: progChanged ? mergedProg : prev.cafeProgress,
          };
          AsyncStorage.setItem("currentUser", JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      }
    }
  }, []);

  // Initial roster sync — runs once after AsyncStorage hydrates so the
  // leaderboard is populated with cross-device users on first paint.
  // Then keeps polling every 10 s so brand-new sign-ups and any level/
  // order-count bumps from other devices appear here in near real-time —
  // the leaderboard, friends list, and game tab all read from this state.
  useEffect(() => {
    if (!hydrated) return;
    refreshAllUsers().catch(() => {});
    const t = setInterval(() => { refreshAllUsers().catch(() => {}); }, 10000);
    return () => clearInterval(t);
  }, [hydrated, refreshAllUsers]);

  // ─── Pending progress adjustments (super-admin → device-local apply) ───
  // The super-admin's "تعديل المستوى / عدد الكوفي" form enqueues a
  // ProgressAdjustment record server-side. Here we poll for any unclaimed
  // record addressed to the signed-in user, apply the deltas to LOCAL
  // cafeProgress + global level/totalOrders (so the change is actually
  // visible on this device, bypassing the Math.max merge that often masks
  // server-side bumps), then mark the record claimed so it never re-applies.
  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API_BASE}/progress-adjustments?userId=${encodeURIComponent(uid)}`);
        if (!r.ok) return;
        const data = await r.json().catch(() => ({}));
        const items: { id: string; userId: string; levelDelta: number; ordersDelta: number; awardCafeId?: string | null }[] =
          Array.isArray(data?.adjustments) ? data.adjustments : [];
        if (cancelled || items.length === 0) return;
        for (const adj of items) {
          // Defense-in-depth: skip if somehow not addressed to us (server
          // already filters by userId, but never trust the response).
          if (!adj || adj.userId !== uid) continue;
          // Claim FIRST so a crash/reload doesn't double-apply. Server is
          // idempotent (returns alreadyClaimed:true on the second call) and
          // enforces ownership via the userId in the body.
          let claimedNow = false;
          try {
            const cr = await fetch(`${API_BASE}/progress-adjustments/${adj.id}/claim`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: uid }),
            });
            if (cr.ok) {
              const cd = await cr.json().catch(() => ({}));
              claimedNow = !cd?.alreadyClaimed;
            }
          } catch { continue; }
          if (!claimedNow) continue;
          const DRINKS_PER_LEVEL = 7;
          const lvlD = Math.trunc(Number(adj.levelDelta) || 0);
          const ordD = Math.trunc(Number(adj.ordersDelta) || 0);
          const couplingOrders = lvlD * DRINKS_PER_LEVEL;
          const cafeId = adj.awardCafeId || null;
          setUserState(prev => {
            if (!prev || prev.id !== uid) return prev;
            const nextLevel  = Math.max(0, Math.min(999, (prev.level ?? 0) + lvlD));
            const nextOrders = Math.max(0, (prev.totalOrders ?? 0) + ordD + couplingOrders);
            const cafeProg = { ...(prev.cafeProgress ?? {}) };
            if (cafeId) {
              const curr = cafeProg[cafeId] ?? {
                cafeId,
                cafeName: cafeId,
                level: 0,
                totalOrders: 0,
              };
              cafeProg[cafeId] = {
                ...curr,
                cafeId,
                level: Math.max(0, Math.min(999, (curr.level ?? 0) + lvlD)),
                totalOrders: Math.max(0, (curr.totalOrders ?? 0) + ordD + couplingOrders),
              };
            }
            const updated: User = {
              ...prev,
              level: nextLevel,
              totalOrders: nextOrders,
              cafeProgress: cafeProg,
            };
            AsyncStorage.setItem("currentUser", JSON.stringify(updated)).catch(() => {});
            return updated;
          });
          // Mirror into registeredUsers so other in-app reads (profile cards,
          // leaderboard local entry) reflect the new totals immediately too.
          setRegisteredUsers(prev => {
            const idx = prev.findIndex(u => u.id === uid);
            if (idx === -1) return prev;
            const me = prev[idx]!;
            const next = [...prev];
            next[idx] = {
              ...me,
              level:       Math.max(0, Math.min(999, (me.level ?? 0) + lvlD)),
              totalOrders: Math.max(0, (me.totalOrders ?? 0) + ordD + couplingOrders),
            };
            AsyncStorage.setItem("registeredUsers", JSON.stringify(next)).catch(() => {});
            return next;
          });
        }
      } catch { /* network errors are non-fatal — next tick will retry */ }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]);

  // Pull the authoritative friend snapshot from the server. Used on login,
  // on notifications-screen focus, and on a polling interval while signed in
  // so cross-device requests / accept / decline reach both sides quickly.
  const refreshFriendData = useCallback(async () => {
    if (!user) return;
    try {
      const r = await fetch(
        `${API_BASE}/friends?userId=${encodeURIComponent(user.id)}`,
      );
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      const friendsList: string[] = Array.isArray(data?.friends) ? data.friends : [];
      const incoming: { id: string; fromUserId: string }[] = Array.isArray(data?.incoming) ? data.incoming : [];
      const outgoing: { id: string; toUserId: string }[]   = Array.isArray(data?.outgoing) ? data.outgoing : [];
      const rejections: { id: string; toUserId: string; decidedAt?: string }[] =
        Array.isArray(data?.rejections) ? data.rejections : [];

      // Refresh lookup maps so accept/decline/cancel can resolve the
      // server request id from the user id the UI knows about.
      incomingMap.current = new Map(incoming.map(r => [r.fromUserId, r.id]));
      outgoingMap.current = new Map(outgoing.map(r => [r.toUserId,   r.id]));

      setFriends(friendsList);
      setIncomingRequests(incoming.map(r => r.fromUserId));
      setOutgoingRequests(outgoing.map(r => r.toUserId));
      setRejectionNotifications(rejections);

      // Mirror into AsyncStorage as an offline cache so the lists are
      // visible immediately on cold-start before the next refresh resolves.
      AsyncStorage.setItem(`friends:${user.id}`, JSON.stringify(friendsList)).catch(() => {});
    } catch {
      /* network errors are non-fatal — the cached lists remain */
    }
  }, [user]);

  // Poll the friend snapshot every 10 s while a user is signed in so
  // incoming requests / accepts / declines from other devices show up
  // without the user having to manually pull-to-refresh.
  useEffect(() => {
    if (!user) return;
    refreshFriendData();
    const handle = setInterval(() => { refreshFriendData(); }, 10000);
    return () => clearInterval(handle);
  }, [user, refreshFriendData]);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) {
      AsyncStorage.setItem("currentUser", JSON.stringify(u));
      // Keep registeredUsers in sync so leaderboard / friends / game / etc.
      // see updates to the current user's profile (avatar, gender, name, etc.)
      setRegisteredUsers(prev => {
        const idx = prev.findIndex(r => r.id === u.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = u;
        AsyncStorage.setItem("registeredUsers", JSON.stringify(next));
        return next;
      });
      // Mirror profile bits to the server so OTHER devices' leaderboards
      // show the real avatar / name / gender instead of a default silhouette.
      // Fire-and-forget — server failure never blocks local UI.
      syncProfileToServer({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        gender: u.gender,
      });
    } else {
      AsyncStorage.removeItem("currentUser");
    }
  }, []);

  const register = useCallback(
    async (
      data: Omit<User, "id" | "level" | "totalOrders" | "points">,
      otpToken: string,
    ): Promise<AuthResult> => {
      try {
        const raw = await AsyncStorage.getItem("registeredUsers");
        const users: User[] = raw ? JSON.parse(raw) : [];
        // NOTE: phone/username uniqueness is enforced authoritatively by the
        // server (see /users/register). We deliberately do NOT pre-check the
        // local `registeredUsers` cache here — that cache can hold stale
        // entries from accounts the server has since hard-deleted (e.g. via
        // a super-admin wipe), which would falsely block legitimate
        // re-registrations with a "phone already registered" error even
        // though the server is empty.
        const newUser: User = {
          ...data,
          id: `user_${Date.now()}`,
          level: 0,
          totalOrders: 0,
          points: 0,
        };
        // Atomically reserve the gameUsername AND mirror the user into the
        // server's `users` collection (single endpoint so a failure can never
        // leave an orphaned username claim or an orphaned user row). The
        // server requires `otpToken` for new ids, proving the caller owns
        // the phone number being registered.
        const synced = await syncUserToServer({
          id: newUser.id,
          username: newUser.gameUsername,
          phone: newUser.phone,
          joinedAt: new Date().toISOString(),
          otpToken,
        });
        if (!synced.ok) return synced;
        // A brand-new account must NEVER inherit coins/items/cart from any
        // previous account that was used on this phone. Wipe device-scoped
        // state before we persist the new currentUser. Pulls prevUserId
        // from AsyncStorage so per-user keyed data is also cleared.
        try {
          const prevRaw = await AsyncStorage.getItem("currentUser");
          const prevId  = prevRaw ? (JSON.parse(prevRaw)?.id ?? null) : null;
          await wipeDeviceAccountData(prevId);
        } catch {}
        const updated = [...users, newUser];
        await AsyncStorage.setItem("registeredUsers", JSON.stringify(updated));
        await AsyncStorage.setItem("currentUser", JSON.stringify(newUser));
        await AsyncStorage.setItem(`friends:${newUser.id}`, JSON.stringify([]));
        await AsyncStorage.setItem(`friend_requests_in:${newUser.id}`, JSON.stringify([]));
        await AsyncStorage.setItem(`friend_requests_out:${newUser.id}`, JSON.stringify([]));
        setRegisteredUsers(updated);
        setUserState(newUser);
        setFriends([]);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        // Pull the latest global roster so this new user sees everyone else
        // (and is themselves immediately visible to other devices on their
        // next refresh). Fire-and-forget — never block the auth flow.
        fetchPublicUsers().then(remote => {
          if (remote.length === 0) return;
          setRegisteredUsers(prev => {
            const byId = new Map<string, User>();
            for (const u of prev) byId.set(u.id, u);
            for (const r of remote) {
              if (byId.has(r.id)) continue;
              byId.set(r.id, {
                id: r.id,
                name: r.name ?? r.username,
                phone: r.phone,
                gameUsername: r.username,
                password: "",
                level: r.level ?? 0,
                totalOrders: r.totalOrders ?? 0,
                points: 0,
                avatar: r.avatar ?? undefined,
                gender: (r.gender ?? undefined) as User["gender"],
                equippedFrame:         r.equippedFrame         ?? null,
                equippedBadge:         r.equippedBadge         ?? null,
                equippedBackground:    r.equippedBackground    ?? null,
                equippedCharacter:     r.equippedCharacter     ?? null,
                equippedUsernameColor: r.equippedUsernameColor ?? null,
                equippedTextStyle:     r.equippedTextStyle     ?? null,
              });
            }
            const next = Array.from(byId.values());
            AsyncStorage.setItem("registeredUsers", JSON.stringify(next)).catch(() => {});
            return next;
          });
        }).catch(() => {});
        return { ok: true };
      } catch {
        return { ok: false, error: "حدث خطأ أثناء التسجيل" };
      }
    },
    []
  );

  // Login accepts EITHER the phone number OR the game username (case-
  // insensitive on the username side). This matches the UX the user asked
  // for: "خليه ينفع يسجل ب رقم الهاتف او اليوزر".
  const login = useCallback(async (identifier: string, password: string): Promise<AuthResult> => {
    try {
      // Pull the freshest server roster first so accounts created on other
      // devices (or that exist server-side but were never cached on this
      // device) can also sign in here. fetchPublicUsers() returns
      // id/username/phone/level/... but never the password (passwords stay
      // device-local for privacy), so we still authenticate against the
      // local AsyncStorage record when one exists.
      let remote: Awaited<ReturnType<typeof fetchPublicUsers>> = [];
      try { remote = await fetchPublicUsers(); } catch { /* offline ok */ }
      const raw = await AsyncStorage.getItem("registeredUsers");
      const users: User[] = raw ? JSON.parse(raw) : [];
      const id = identifier.trim();
      const idLower = id.toLowerCase();
      // Phone-normalization: strip spaces and non-digits (but preserve a
      // leading "+"). Lets the user log in with "+96812345678",
      // "96812345678", "0096812345678", "+968 1234 5678", etc. when they
      // registered with any of those forms. Username comparison stays
      // case-insensitive.
      const normPhone = (p: string | undefined | null) =>
        String(p ?? "").replace(/\s+/g, "").replace(/(?!^\+)\D/g, "");
      const idDigits = id.replace(/\D+/g, "");
      const matchIdentifier = (uPhone: string | undefined | null, uUser: string | undefined | null) => {
        if (uUser && uUser.toLowerCase() === idLower) return true;
        if (!uPhone) return false;
        if (uPhone === id) return true;
        if (normPhone(uPhone) === normPhone(id)) return true;
        // Tail-match: "+96812345678" vs "12345678" — only when the typed
        // id is digits-only and at least 6 digits to avoid false positives.
        const uDigits = uPhone.replace(/\D+/g, "");
        if (idDigits.length >= 6 && (uDigits.endsWith(idDigits) || idDigits.endsWith(uDigits))) return true;
        return false;
      };

      // 1) Strict local match: matching identifier + correct password.
      let found = users.find(u =>
        u.password === password && matchIdentifier(u.phone, u.gameUsername)
      );

      // 2) Local record exists with the same identifier but EMPTY password
      //    (a placeholder synthesized from the server roster, or a record
      //    whose password was wiped). Adopt the typed password as the
      //    canonical credential on this device and let the user in — this
      //    fixes the case where a real account exists on the server but the
      //    AsyncStorage entry has no password to compare against.
      if (!found) {
        const placeholder = users.find(u =>
          (u.password ?? "") === "" && matchIdentifier(u.phone, u.gameUsername)
        );
        if (placeholder) {
          found = { ...placeholder, password };
          const idx = users.findIndex(u => u.id === placeholder.id);
          if (idx >= 0) users[idx] = found;
        }
      }

      // 3) Server-only account (never seen locally before). Adopt the
      //    server identity with the entered password so the user can sign
      //    in on this fresh device.
      if (!found) {
        const remoteMatch = remote.find(r =>
          matchIdentifier(r.phone, r.username)
        );
        if (remoteMatch) {
          found = {
            id: remoteMatch.id,
            name: remoteMatch.username,
            phone: remoteMatch.phone,
            gameUsername: remoteMatch.username,
            password,
            level: remoteMatch.level ?? 0,
            totalOrders: remoteMatch.totalOrders ?? 0,
            points: 0,
            equippedFrame:         remoteMatch.equippedFrame         ?? null,
            equippedBadge:         remoteMatch.equippedBadge         ?? null,
            equippedBackground:    remoteMatch.equippedBackground    ?? null,
            equippedCharacter:     remoteMatch.equippedCharacter     ?? null,
            equippedUsernameColor: remoteMatch.equippedUsernameColor ?? null,
            equippedTextStyle:     remoteMatch.equippedTextStyle     ?? null,
          };
          users.push(found);
        }
      }

      if (!found) return { ok: false, error: "رقم الهاتف/اليوزر أو كلمة المرور غير صحيحة" };

      // Block sign-in if the server says this account is banned. Without
      // this check a banned user could still load the app for ~8s (until
      // the first ban-status poll resolves) — which is enough to use
      // features. We don't enter the session at all in that case; the
      // AuthModal surfaces the ban reason as the login error.
      const status = await fetchUserStatus(found.id);
      if (status?.banned) {
        return {
          ok: false,
          error: `🚫 تم حظرك من الموقع: ${status.banReason || "تواصل مع إدارة كوبوينتو"}`,
        };
      }
      // Block sign-in if the server has no record of this account. Without
      // this check the user gets a phantom 24-second session: login succeeds
      // against the local cache, then the periodic ban-poll detects
      // exists:false three times in a row and kicks them out. This happens
      // for accounts that existed locally before a server-side wipe (e.g.
      // after a DB reset). We also strip the dead local entries so the
      // user can re-register cleanly with the same phone/username.
      if (status && status.exists === false) {
        try {
          const cleaned = users.filter(u => u.id !== found!.id);
          await AsyncStorage.setItem("registeredUsers", JSON.stringify(cleaned));
          setRegisteredUsers(cleaned);
        } catch {}
        return {
          ok: false,
          error: "هذا الحساب لم يعد موجوداً — يرجى إنشاء حساب جديد",
        };
      }

      // Persist the (possibly-updated) roster so the adopted credential
      // survives a restart.
      await AsyncStorage.setItem("registeredUsers", JSON.stringify(users));
      setRegisteredUsers(users);
      // If a DIFFERENT account was previously signed in on this device,
      // wipe device-scoped state (coins, gift inventory, owned/equipped
      // cosmetics, cart, etc.) so this account doesn't inherit the
      // previous user's wallet and items. Same-user re-login is left
      // untouched so a session refresh doesn't nuke their own progress.
      try {
        const prevRaw = await AsyncStorage.getItem("currentUser");
        const prevId  = prevRaw ? (JSON.parse(prevRaw)?.id ?? null) : null;
        if (prevId && prevId !== found.id) {
          await wipeDeviceAccountData(prevId);
        }
      } catch {}
      await AsyncStorage.setItem("currentUser", JSON.stringify(found));
      const [fRaw, inRaw, outRaw] = await Promise.all([
        AsyncStorage.getItem(`friends:${found.id}`),
        AsyncStorage.getItem(`friend_requests_in:${found.id}`),
        AsyncStorage.getItem(`friend_requests_out:${found.id}`),
      ]);
      setFriends(fRaw ? JSON.parse(fRaw) : []);
      setIncomingRequests(inRaw ? JSON.parse(inRaw) : []);
      setOutgoingRequests(outRaw ? JSON.parse(outRaw) : []);
      setUserState(found);
      // Backfill the server `users` collection for accounts created before
      // server-side user-sync existed. Fire-and-forget; failure is harmless.
      syncUserToServer({
        id: found.id,
        username: found.gameUsername || found.name,
        phone: found.phone,
      }).catch(() => {});
      return { ok: true };
    } catch {
      return { ok: false, error: "حدث خطأ أثناء تسجيل الدخول" };
    }
  }, []);

  const addFriend = useCallback((userId: string) => {
    if (!user) return;
    setFriends(prev => {
      if (prev.includes(userId)) return prev;
      const updated = [...prev, userId];
      AsyncStorage.setItem(`friends:${user.id}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, [user]);

  const removeFriend = useCallback((userId: string) => {
    if (!user) return;
    // Optimistic local update — the polling refresh will reconcile.
    setFriends(prev => prev.filter(id => id !== userId));
    setOutgoingRequests(prev => prev.filter(id => id !== userId));
    setIncomingRequests(prev => prev.filter(id => id !== userId));
    // Server delete (also clears any lingering pending requests between us).
    fetch(`${API_BASE}/friendships`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, otherId: userId }),
    })
      .catch(() => {})
      .finally(() => { refreshFriendData(); });
  }, [user, refreshFriendData]);

  // ─── Friend requests (server-backed, cross-device) ────────────────────────
  // The mobile UI keeps `incomingRequests` / `outgoingRequests` as user-id
  // arrays for backward compat. Server requests are keyed by their own id —
  // we resolve those via the `incomingMap` / `outgoingMap` refs that
  // `refreshFriendData` keeps in sync.

  const sendFriendRequest = useCallback(async (targetId: string) => {
    if (!user || targetId === user.id) return;
    if (friends.includes(targetId)) return;
    if (outgoingRequests.includes(targetId)) return;
    try {
      await fetch(`${API_BASE}/friend-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId: user.id, toUserId: targetId }),
      });
    } catch {}
    refreshFriendData();
  }, [user, friends, outgoingRequests, refreshFriendData]);

  const acceptFriendRequest = useCallback(async (senderId: string) => {
    if (!user) return;
    const requestId = incomingMap.current.get(senderId);
    if (!requestId) return;
    try {
      await fetch(`${API_BASE}/friend-requests/${encodeURIComponent(requestId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {}
    refreshFriendData();
  }, [user, refreshFriendData]);

  const declineFriendRequest = useCallback(async (senderId: string) => {
    if (!user) return;
    const requestId = incomingMap.current.get(senderId);
    if (!requestId) return;
    try {
      await fetch(`${API_BASE}/friend-requests/${encodeURIComponent(requestId)}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {}
    refreshFriendData();
  }, [user, refreshFriendData]);

  const cancelFriendRequest = useCallback(async (targetId: string) => {
    if (!user) return;
    const requestId = outgoingMap.current.get(targetId);
    if (!requestId) return;
    try {
      await fetch(
        `${API_BASE}/friend-requests/${encodeURIComponent(requestId)}?userId=${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );
    } catch {}
    refreshFriendData();
  }, [user, refreshFriendData]);

  const ackRejection = useCallback(async (requestId: string) => {
    if (!user) return;
    // Optimistic remove so the card disappears immediately.
    setRejectionNotifications(prev => prev.filter(r => r.id !== requestId));
    try {
      await fetch(`${API_BASE}/friend-requests/${encodeURIComponent(requestId)}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch {}
  }, [user]);

  const resetPasswordWithOtp = useCallback(
    async (otpToken: string, newPassword: string): Promise<AuthResult> => {
      try {
        const conf = await confirmPasswordReset(otpToken);
        if (!conf.ok) return { ok: false, error: conf.error };
        const phone = conf.phone;
        const raw = await AsyncStorage.getItem("registeredUsers");
        const users: User[] = raw ? JSON.parse(raw) : [];
        const norm = (p: string) => p.replace(/\s+/g, "").replace(/(?!^\+)\D/g, "");
        const target = phone;
        const idx = users.findIndex(u => u.phone === target || norm(u.phone) === norm(target));

        // Pull the canonical server identity for this phone so we can
        // restore an account that exists server-side but isn't yet on this
        // device (matches the "server-only adoption" path in `login`).
        let remote: PublicServerUser | undefined;
        try {
          const all = await fetchPublicUsers();
          remote = all.find(r => r.phone === target || norm(r.phone) === norm(target));
        } catch { /* offline ok — only blocks fresh-device adoption */ }

        let updatedUser: User;
        if (idx >= 0) {
          updatedUser = { ...users[idx], password: newPassword };
          users[idx] = updatedUser;
        } else if (remote) {
          updatedUser = {
            id: remote.id,
            name: remote.username,
            phone: remote.phone,
            gameUsername: remote.username,
            password: newPassword,
            level: remote.level ?? 0,
            totalOrders: remote.totalOrders ?? 0,
            points: 0,
            equippedFrame:         remote.equippedFrame         ?? null,
            equippedBadge:         remote.equippedBadge         ?? null,
            equippedBackground:    remote.equippedBackground    ?? null,
            equippedCharacter:     remote.equippedCharacter     ?? null,
            equippedUsernameColor: remote.equippedUsernameColor ?? null,
            equippedTextStyle:     remote.equippedTextStyle     ?? null,
          };
          users.push(updatedUser);
        } else {
          return { ok: false, error: "لا يوجد حساب مرتبط بهذا الرقم" };
        }

        await AsyncStorage.setItem("registeredUsers", JSON.stringify(users));
        await AsyncStorage.setItem("currentUser", JSON.stringify(updatedUser));
        setRegisteredUsers(users);
        const [fRaw, inRaw, outRaw] = await Promise.all([
          AsyncStorage.getItem(`friends:${updatedUser.id}`),
          AsyncStorage.getItem(`friend_requests_in:${updatedUser.id}`),
          AsyncStorage.getItem(`friend_requests_out:${updatedUser.id}`),
        ]);
        setFriends(fRaw ? JSON.parse(fRaw) : []);
        setIncomingRequests(inRaw ? JSON.parse(inRaw) : []);
        setOutgoingRequests(outRaw ? JSON.parse(outRaw) : []);
        setUserState(updatedUser);
        return { ok: true };
      } catch {
        return { ok: false, error: "حدث خطأ أثناء إعادة تعيين كلمة المرور" };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("currentUser");
    setUserState(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setRejectionNotifications([]);
    incomingMap.current = new Map();
    outgoingMap.current = new Map();
    setActiveGameCafeIdState(null);
  }, []);

  // Self-serve hard delete. We MUST hit the server first so that:
  //  • their record + game progress is purged from the global roster (other
  //    devices stop seeing them on the leaderboard within their next refresh)
  //  • their phone is freed in usernameRegistry / users so they can register
  //    fresh on the same number.
  // Only after that do we wipe device-local state and log them out.
  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    if (!user) return { ok: false, error: "لم يتم تسجيل الدخول" };
    try {
      const res = await fetch(`${API_BASE}/users/${encodeURIComponent(user.id)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.phone }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) {
        return { ok: false, error: data?.error || "تعذّر حذف الحساب من الخادم" };
      }
    } catch {
      return { ok: false, error: "تعذّر الاتصال بالخادم — تحقّق من الإنترنت" };
    }

    // Drop this user from the local registeredUsers cache so the
    // leaderboard/friends UI on this device doesn't keep showing them.
    try {
      const raw = await AsyncStorage.getItem("registeredUsers");
      const list: User[] = raw ? JSON.parse(raw) : [];
      const next = list.filter(u => u.id !== user.id);
      await AsyncStorage.setItem("registeredUsers", JSON.stringify(next));
      setRegisteredUsers(next);
    } catch {}

    // Wipe per-user local data: friends list, friend requests, active café,
    // chat hydration markers, savedOrderInfo, etc.
    const perUserKeys = [
      `friends:${user.id}`,
      `friend_requests_in:${user.id}`,
      `friend_requests_out:${user.id}`,
      `activeGameCafeId:${user.id}`,
    ];
    try { await AsyncStorage.multiRemove(perUserKeys); } catch {}

    // Wipe owned/equipped/inventory slots so the next account on this
    // device starts truly fresh. Two-pass approach:
    //
    //  (1) Persist EXPLICIT empty values for cosmetic/coins/inventory slots
    //      (matches resetAccount.ts). This way the hook hydration on the
    //      next mount treats the slot as "intentionally cleared" — coins
    //      stay at 0, owned arrays stay empty, equipped slots stay null —
    //      instead of accidentally re-seeding from a stale `_cache` or
    //      from the previous user's cached data still in memory.
    //
    //  (2) multiRemove for everything else (per-user keys, grant flags,
    //      last-seen markers, chat caches). Removing the grant key lets
    //      the new account that signs in on this device receive the 200
    //      coin welcome bonus on its next hydration, exactly like a
    //      brand-new install.
    const emptyArrayKeys = [
      "copointo_frames_owned_v3",
      "copointo_badges_owned_v3",
      "copointo_backgrounds_owned_v3",
      "copointo_username_colors_owned_v1",
      "copointo_text_styles_owned_v1",
      "copointo_characters_owned_v1",
    ];
    const emptyStringKeys = [
      "copointo_frame_equipped_v3",
      "copointo_badge_equipped_v3",
      "copointo_background_equipped_v3",
      "copointo_username_color_equipped_v1",
      "copointo_text_style_equipped_v1",
      "copointo_character_equipped_v1",
    ];
    const emptyWrites: [string, string][] = [
      ...emptyArrayKeys.map(k => [k, "[]"] as [string, string]),
      ...emptyStringKeys.map(k => [k, ""] as [string, string]),
      ["copointo_gift_inventory_v1", "{}"],
      ["copointo_coins_balance_v1", "0"],
    ];
    try { await AsyncStorage.multiSet(emptyWrites); } catch {}

    const removeKeys = [
      "currentUser", "cart", "orderHistory", "likedVideos",
      // Drop welcome-bonus + level-reward acks so the next account
      // signing in on this device gets the full new-user experience.
      "copointo_coins_grant_signup_200_v1",
      "copointo_coins_grant_190k_v1", // legacy key, removed for safety
      "copointo_coin_milestones_acked_v1",
      "copointo_level_rewards_acked_v1",
      // Last-seen markers for in-app notification badges; resetting them
      // means the new account starts with a clean unread state.
      "copointo_booking_last_seen_v1",
      "copointo_broadcast_last_seen_v1",
      "copointo_free_coffee_last_seen_v1",
      "copointo_gift_feed_last_seen_v1",
      // PII-bearing local caches: pre-filled order info (name+phone+location),
      // per-user chat threads / unread / groups (MessagesContext),
      // per-user rank-overtake popup state.
      "copointo_saved_order_info_v1",
      `copointo_chats_v2:${user.id}`,
      `copointo_unread_v2:${user.id}`,
      `copointo_groups_v2:${user.id}`,
      `copointo_rank_ahead_v1:${user.id}`,
    ];
    try { await AsyncStorage.multiRemove(removeKeys); } catch {}

    // Critical: flush every cosmetic/coin/inventory hook's module-level
    // `_cache` and broadcast empty defaults. Without this, the React tree
    // keeps showing the deleted user's coins, owned items and equipped
    // cosmetics until full app reload — which means the next account
    // registered on this device immediately inherits the previous user's
    // loadout (the visible bug the user reported).
    try { runAccountResetHandlers(); } catch {}

    // Per-cafe chat-bot state lives in keys we don't know up-front
    // (`copointo_chat_state_v1_<cafeId>`). Sweep them all so no order/booking
    // draft containing the user's name+phone survives the delete.
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cafeChatKeys = allKeys.filter(k => k.startsWith("copointo_chat_state_v1_"));
      if (cafeChatKeys.length) await AsyncStorage.multiRemove(cafeChatKeys);
    } catch {}

    // Clear in-memory caches and sign out. Also flag the AuthModal to open
    // on the "register-form" tab so the user is taken straight to the
    // create-new-account screen (not the login tab) — they just deleted
    // their account, the next intent is almost always to make a new one.
    setInitialAuthStep("register-form");
    setUserState(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setRejectionNotifications([]);
    incomingMap.current = new Map();
    outgoingMap.current = new Map();
    setActiveGameCafeIdState(null);
    return { ok: true };
  }, [user]);

  const addToCart = useCallback((item: Omit<CartItem, "quantity">) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const updated = existing
        ? prev.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          )
        : [...prev, { ...item, quantity: 1 }];
      AsyncStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const updated = prev.filter((i) => i.id !== itemId);
      AsyncStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      const updated =
        quantity <= 0
          ? prev.filter((i) => i.id !== itemId)
          : prev.map((i) => (i.id === itemId ? { ...i, quantity } : i));
      AsyncStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    AsyncStorage.removeItem("cart");
  }, []);

  const toggleLikeVideo = useCallback((videoId: string) => {
    setLikedVideos((prev) => {
      const updated = prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId];
      AsyncStorage.setItem("likedVideos", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const addOrder = useCallback((order: Order) => {
    setOrderHistory((prev) => {
      const updated = [order, ...prev];
      AsyncStorage.setItem("orderHistory", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setActiveOrder = useCallback((o: ActiveOrder | null) => {
    setActiveOrderState(o);
  }, []);

  const setActiveGameCafeId = useCallback((cafeId: string | null) => {
    setActiveGameCafeIdState(cafeId);
    if (user) {
      if (cafeId) {
        AsyncStorage.setItem(`activeGameCafeId:${user.id}`, cafeId).catch(() => {});
      } else {
        AsyncStorage.removeItem(`activeGameCafeId:${user.id}`).catch(() => {});
      }
    }
  }, [user]);

  const addCafeOrder = useCallback((cafeId: string, cafeName: string, qty: number) => {
    if (qty <= 0) return;
    setUserState((prev) => {
      if (!prev) return prev;

      // ── Daily level cap (10 levels per calendar day) ──
      const today = todayKey();
      const isNewDay = prev.levelsTodayDate !== today;
      const usedToday = isNewDay ? 0 : (prev.levelsToday ?? 0);
      const remainingToday = Math.max(0, DAILY_LEVEL_CAP - usedToday);
      const levelGain = Math.min(qty, remainingToday);

      const prevProgress = prev.cafeProgress ?? {};
      const prevCafe = prevProgress[cafeId] ?? { cafeId, cafeName, totalOrders: 0, level: 0 };
      const nextCafe: CafeProgress = {
        cafeId,
        cafeName: cafeName || prevCafe.cafeName || cafeId,
        totalOrders: prevCafe.totalOrders + qty,
        // totalOrders still grows fully, but level only grows by capped amount.
        level: Math.min(999, prevCafe.level + levelGain),
      };
      const newProgress = { ...prevProgress, [cafeId]: nextCafe };
      // Global level = max level across all cafés (so Profile/Leaderboard reflect best progress).
      const maxLevel = Math.max(0, ...Object.values(newProgress).map((c) => c.level));
      const updated: User = {
        ...prev,
        cafeProgress: newProgress,
        totalOrders: (prev.totalOrders ?? 0) + qty,
        points: (prev.points ?? 0) + qty * 10,
        level: maxLevel,
        levelsToday: usedToday + levelGain,
        levelsTodayDate: today,
      };
      // Persist + mirror into registeredUsers (matches setUser side-effects).
      AsyncStorage.setItem("currentUser", JSON.stringify(updated)).catch(() => {});
      setRegisteredUsers((regs) => {
        const idx = regs.findIndex((r) => r.id === updated.id);
        if (idx === -1) return regs;
        const next = [...regs];
        next[idx] = updated;
        AsyncStorage.setItem("registeredUsers", JSON.stringify(next)).catch(() => {});
        return next;
      });
      // Auto-select this café for the game view if none chosen yet.
      setActiveGameCafeIdState((curr) => {
        if (curr) return curr;
        AsyncStorage.setItem(`activeGameCafeId:${updated.id}`, cafeId).catch(() => {});
        return cafeId;
      });
      // Mirror the new global level + totalOrders to the server so OTHER
      // devices see this user's bump on the leaderboard within their next
      // refresh. Fire-and-forget — failure just delays cross-device sync.
      fetch(`${API_BASE}/users/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          level: updated.level,
          totalOrders: updated.totalOrders,
        }),
      }).catch(() => {});
      return updated;
    });
  }, []);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        user,
        hydrated,
        bannedInfo,
        setUser,
        register,
        login,
        resetPasswordWithOtp,
        logout,
        deleteAccount,
        initialAuthStep,
        consumeInitialAuthStep,
        registeredUsers,
        friends,
        addFriend,
        removeFriend,
        outgoingRequests,
        incomingRequests,
        rejectionNotifications,
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        ackRejection,
        refreshFriendData,
        refreshAllUsers,
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartTotal,
        cartCount,
        likedVideos,
        toggleLikeVideo,
        orderHistory,
        addOrder,
        activeOrder,
        setActiveOrder,
        activeGameCafeId,
        setActiveGameCafeId,
        addCafeOrder,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
