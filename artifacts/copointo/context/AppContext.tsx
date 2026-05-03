import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
}

interface AppContextType {
  user: User | null;
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
  /** Send a friend request from current user to targetId (waits for accept) */
  sendFriendRequest: (targetId: string) => Promise<void>;
  /** Accept a pending request from senderId — adds to friends on both sides */
  acceptFriendRequest: (senderId: string) => Promise<void>;
  /** Decline a pending request from senderId */
  declineFriendRequest: (senderId: string) => Promise<void>;
  /** Cancel a request I previously sent to targetId */
  cancelFriendRequest: (targetId: string) => Promise<void>;
  /** Re-read friend + request lists from storage (call when opening notifications) */
  refreshFriendData: () => Promise<void>;
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
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<string[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [activeOrder, setActiveOrderState] = useState<ActiveOrder | null>(null);
  const [activeGameCafeId, setActiveGameCafeIdState] = useState<string | null>(null);

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
  };

  // Re-read friend lists from storage (used by notifications screen on focus,
  // since requests can arrive from another logged-in user on the same device)
  const refreshFriendData = useCallback(async () => {
    if (!user) return;
    try {
      const [fRaw, inRaw, outRaw] = await Promise.all([
        AsyncStorage.getItem(`friends:${user.id}`),
        AsyncStorage.getItem(`friend_requests_in:${user.id}`),
        AsyncStorage.getItem(`friend_requests_out:${user.id}`),
      ]);
      setFriends(fRaw ? JSON.parse(fRaw) : []);
      setIncomingRequests(inRaw ? JSON.parse(inRaw) : []);
      setOutgoingRequests(outRaw ? JSON.parse(outRaw) : []);
    } catch {}
  }, [user]);

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
        return { ok: true };
      } catch {
        return { ok: false, error: "حدث خطأ أثناء التسجيل" };
      }
    },
    []
  );

  const login = useCallback(async (phone: string, password: string): Promise<AuthResult> => {
    try {
      const raw = await AsyncStorage.getItem("registeredUsers");
      const users: User[] = raw ? JSON.parse(raw) : [];
      setRegisteredUsers(users);
      const found = users.find(u => u.phone === phone && u.password === password);
      if (!found) return { ok: false, error: "رقم الهاتف أو كلمة المرور غير صحيحة" };
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
    setFriends(prev => {
      const updated = prev.filter(id => id !== userId);
      AsyncStorage.setItem(`friends:${user.id}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Also clear any stale pending-request state on either side
    setOutgoingRequests(prev => {
      const updated = prev.filter(id => id !== userId);
      AsyncStorage.setItem(`friend_requests_out:${user.id}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    setIncomingRequests(prev => {
      const updated = prev.filter(id => id !== userId);
      AsyncStorage.setItem(`friend_requests_in:${user.id}`, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    // Mock cross-device cleanup on the other side
    (async () => {
      try {
        const [oFriendsRaw, oInRaw, oOutRaw] = await Promise.all([
          AsyncStorage.getItem(`friends:${userId}`),
          AsyncStorage.getItem(`friend_requests_in:${userId}`),
          AsyncStorage.getItem(`friend_requests_out:${userId}`),
        ]);
        const oFriends: string[] = oFriendsRaw ? JSON.parse(oFriendsRaw) : [];
        const oIn:      string[] = oInRaw      ? JSON.parse(oInRaw)      : [];
        const oOut:     string[] = oOutRaw     ? JSON.parse(oOutRaw)     : [];
        await Promise.all([
          AsyncStorage.setItem(`friends:${userId}`, JSON.stringify(oFriends.filter(id => id !== user.id))),
          AsyncStorage.setItem(`friend_requests_in:${userId}`, JSON.stringify(oIn.filter(id => id !== user.id))),
          AsyncStorage.setItem(`friend_requests_out:${userId}`, JSON.stringify(oOut.filter(id => id !== user.id))),
        ]);
      } catch {}
    })();
  }, [user]);

  // ─── Friend requests ──────────────────────────────────────────────────────
  // Cross-user storage layout (single device with multiple registered users):
  //   friend_requests_in:<userId>   = list of senderIds whose requests await me
  //   friend_requests_out:<userId>  = list of targetIds I have pending
  //   friends:<userId>              = accepted friend ids
  // Send: append me → other's "in" list, append other → my "out" list.
  // Accept: remove me from other's "out", remove other from my "in",
  //         add other → my friends, add me → other's friends.

  const sendFriendRequest = useCallback(async (targetId: string) => {
    if (!user || targetId === user.id) return;
    try {
      // Already friends? no-op
      if (friends.includes(targetId)) return;

      // If the other user already sent ME a request, treat this as an accept
      // (checked BEFORE the outgoing-already-sent guard so the cross-pending
      // edge case doesn't get short-circuited as no-op).
      if (incomingRequests.includes(targetId)) {
        await acceptInternal(targetId);
        return;
      }

      // Already requested? no-op
      if (outgoingRequests.includes(targetId)) return;

      // Append to my outgoing
      const newOut = [...outgoingRequests, targetId];
      await AsyncStorage.setItem(`friend_requests_out:${user.id}`, JSON.stringify(newOut));
      setOutgoingRequests(newOut);

      // Append me → target's incoming
      const targetInRaw = await AsyncStorage.getItem(`friend_requests_in:${targetId}`);
      const targetIn: string[] = targetInRaw ? JSON.parse(targetInRaw) : [];
      if (!targetIn.includes(user.id)) {
        targetIn.push(user.id);
        await AsyncStorage.setItem(`friend_requests_in:${targetId}`, JSON.stringify(targetIn));
      }
    } catch {}
  }, [user, friends, outgoingRequests, incomingRequests]);

  // Internal acceptance helper used by both acceptFriendRequest and the
  // sendFriendRequest "they already asked me" shortcut.
  const acceptInternal = async (senderId: string) => {
    if (!user) return;
    // 1. Remove from my incoming
    const newIn = incomingRequests.filter(id => id !== senderId);
    await AsyncStorage.setItem(`friend_requests_in:${user.id}`, JSON.stringify(newIn));
    setIncomingRequests(newIn);

    // 2. Remove me from sender's outgoing
    try {
      const senderOutRaw = await AsyncStorage.getItem(`friend_requests_out:${senderId}`);
      const senderOut: string[] = senderOutRaw ? JSON.parse(senderOutRaw) : [];
      const filtered = senderOut.filter(id => id !== user.id);
      await AsyncStorage.setItem(`friend_requests_out:${senderId}`, JSON.stringify(filtered));
    } catch {}

    // 3. Add sender → my friends
    const newFriends = friends.includes(senderId) ? friends : [...friends, senderId];
    await AsyncStorage.setItem(`friends:${user.id}`, JSON.stringify(newFriends));
    setFriends(newFriends);

    // 4. Add me → sender's friends
    try {
      const senderFRaw = await AsyncStorage.getItem(`friends:${senderId}`);
      const senderF: string[] = senderFRaw ? JSON.parse(senderFRaw) : [];
      if (!senderF.includes(user.id)) {
        senderF.push(user.id);
        await AsyncStorage.setItem(`friends:${senderId}`, JSON.stringify(senderF));
      }
    } catch {}

    // 5. Also clear any stale outgoing entry I had toward sender (edge case)
    if (outgoingRequests.includes(senderId)) {
      const newOut = outgoingRequests.filter(id => id !== senderId);
      await AsyncStorage.setItem(`friend_requests_out:${user.id}`, JSON.stringify(newOut));
      setOutgoingRequests(newOut);
    }
  };

  const acceptFriendRequest = useCallback(async (senderId: string) => {
    if (!user) return;
    if (!incomingRequests.includes(senderId)) return;
    try { await acceptInternal(senderId); } catch {}
  }, [user, incomingRequests, friends, outgoingRequests]);

  const declineFriendRequest = useCallback(async (senderId: string) => {
    if (!user) return;
    try {
      const newIn = incomingRequests.filter(id => id !== senderId);
      await AsyncStorage.setItem(`friend_requests_in:${user.id}`, JSON.stringify(newIn));
      setIncomingRequests(newIn);
      // Also clear from sender's outgoing
      const senderOutRaw = await AsyncStorage.getItem(`friend_requests_out:${senderId}`);
      const senderOut: string[] = senderOutRaw ? JSON.parse(senderOutRaw) : [];
      const filtered = senderOut.filter(id => id !== user.id);
      await AsyncStorage.setItem(`friend_requests_out:${senderId}`, JSON.stringify(filtered));
    } catch {}
  }, [user, incomingRequests]);

  const cancelFriendRequest = useCallback(async (targetId: string) => {
    if (!user) return;
    try {
      const newOut = outgoingRequests.filter(id => id !== targetId);
      await AsyncStorage.setItem(`friend_requests_out:${user.id}`, JSON.stringify(newOut));
      setOutgoingRequests(newOut);
      // Remove me from target's incoming
      const targetInRaw = await AsyncStorage.getItem(`friend_requests_in:${targetId}`);
      const targetIn: string[] = targetInRaw ? JSON.parse(targetInRaw) : [];
      const filtered = targetIn.filter(id => id !== user.id);
      await AsyncStorage.setItem(`friend_requests_in:${targetId}`, JSON.stringify(filtered));
    } catch {}
  }, [user, outgoingRequests]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("currentUser");
    setUserState(null);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
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
      const prevProgress = prev.cafeProgress ?? {};
      const prevCafe = prevProgress[cafeId] ?? { cafeId, cafeName, totalOrders: 0, level: 0 };
      const nextCafe: CafeProgress = {
        cafeId,
        cafeName: cafeName || prevCafe.cafeName || cafeId,
        totalOrders: prevCafe.totalOrders + qty,
        level: Math.min(999, prevCafe.level + qty),
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
      return updated;
    });
  }, []);

  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <AppContext.Provider
      value={{
        user,
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
        sendFriendRequest,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        refreshFriendData,
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
