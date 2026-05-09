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
  equippedFrame?: string | null;
  equippedBadge?: string | null;
  equippedBackground?: string | null;
  equippedCharacter?: string | null;
  equippedUsernameColor?: string | null;
  equippedTextStyle?: string | null;
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
export async function syncUserToServer(args: {
  id: string;
  username: string;
  phone: string;
  joinedAt?: string;
}): Promise<AuthResult> {
  try {
    const r = await fetch(`${API_BASE}/users/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error || "تعذر تسجيل المستخدم على الخادم" };
  } catch {
    return { ok: false, error: "تعذر الاتصال بالخادم" };
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
  name: string;
  price: number;
  quantity: number;
  cafeId: string;
  cafeName: string;
  image?: string;
  /** Menu category — used for free-coffee eligibility (drinks only, not طعام/حلى). */
  category?: string;
}

interface AppContextType {
  user: User | null;
  /** True once the initial AsyncStorage read completes (used by the global
   *  AuthGate to avoid flashing the login screen for signed-in users). */
  hydrated: boolean;
  setUser: (user: User | null) => void;
  register: (data: Omit<User, "id" | "level" | "totalOrders" | "points">) => Promise<AuthResult>;
  login: (phone: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
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

  useEffect(() => {
    loadData();
  }, []);

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
        // Backfill the server `users` collection for accounts that were
        // created before server-side user-sync existed. Fire-and-forget so
        // a slow network never blocks app startup.
        syncUserToServer({
          id: parsed.id,
          username: parsed.gameUsername || parsed.name,
          phone: parsed.phone,
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
      // The server is the AUTHORITATIVE source of truth for who exists. We
      // start from an empty map so any user that has been removed server-side
      // (e.g. a super-admin wipe) disappears from this device's leaderboard
      // and friend lists too. The currently signed-in user is always kept
      // even before they show up in the server roster (network race / brand-
      // new account) so the local profile UI never blanks out.
      const byId = new Map<string, User>();
      const me = prev.find(u => u.id === currentUserIdRef.current);
      if (me) byId.set(me.id, me);
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
            name: r.username,
            phone: r.phone,
            gameUsername: r.username,
            // Password never leaves its origin device. The empty value is
            // fine because remote profiles are display-only on this device.
            password: "",
            level: r.level ?? 0,
            totalOrders: r.totalOrders ?? 0,
            points: 0,
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
    } else {
      AsyncStorage.removeItem("currentUser");
    }
  }, []);

  const register = useCallback(
    async (data: Omit<User, "id" | "level" | "totalOrders" | "points">): Promise<AuthResult> => {
      try {
        const raw = await AsyncStorage.getItem("registeredUsers");
        const users: User[] = raw ? JSON.parse(raw) : [];
        if (users.some(u => u.phone === data.phone))
          return { ok: false, error: "رقم الهاتف مسجّل مسبقاً" };
        if (users.some(u => u.gameUsername.toLowerCase() === data.gameUsername.toLowerCase()))
          return { ok: false, error: "يوزر اللعبة مستخدم مسبقاً" };
        const newUser: User = {
          ...data,
          id: `user_${Date.now()}`,
          level: 0,
          totalOrders: 0,
          points: 0,
        };
        // Atomically reserve the gameUsername AND mirror the user into the
        // server's `users` collection (single endpoint so a failure can never
        // leave an orphaned username claim or an orphaned user row). This is
        // the only check that catches phone/username collisions across other
        // devices, and it makes every signed-up player visible in the super-
        // admin "المستخدمون" page even before they place their first order.
        const synced = await syncUserToServer({
          id: newUser.id,
          username: newUser.gameUsername,
          phone: newUser.phone,
          joinedAt: new Date().toISOString(),
        });
        if (!synced.ok) return synced;
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
                name: r.username,
                phone: r.phone,
                gameUsername: r.username,
                password: "",
                level: r.level ?? 0,
                totalOrders: r.totalOrders ?? 0,
                points: 0,
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
      const raw = await AsyncStorage.getItem("registeredUsers");
      const users: User[] = raw ? JSON.parse(raw) : [];
      setRegisteredUsers(users);
      const id = identifier.trim();
      const idLower = id.toLowerCase();
      const found = users.find(u =>
        u.password === password &&
        (u.phone === id || (u.gameUsername ?? "").toLowerCase() === idLower)
      );
      if (!found) return { ok: false, error: "رقم الهاتف/اليوزر أو كلمة المرور غير صحيحة" };
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
        setUser,
        register,
        login,
        logout,
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
