import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  gameUsername: string;
  password: string;
  avatar?: string;
  level: number;
  totalOrders: number;
  points: number;
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cartData, likesData, ordersData, userData] = await Promise.all([
        AsyncStorage.getItem("cart"),
        AsyncStorage.getItem("likedVideos"),
        AsyncStorage.getItem("orderHistory"),
        AsyncStorage.getItem("currentUser"),
      ]);
      if (cartData) setCart(JSON.parse(cartData));
      if (likesData) setLikedVideos(JSON.parse(likesData));
      if (ordersData) setOrderHistory(JSON.parse(ordersData));
      if (userData) setUserState(JSON.parse(userData));
    } catch (e) {}
  };

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    if (u) AsyncStorage.setItem("currentUser", JSON.stringify(u));
    else AsyncStorage.removeItem("currentUser");
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
        setUserState(newUser);
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
      const found = users.find(u => u.phone === phone && u.password === password);
      if (!found) return { ok: false, error: "رقم الهاتف أو كلمة المرور غير صحيحة" };
      await AsyncStorage.setItem("currentUser", JSON.stringify(found));
      setUserState(found);
      return { ok: true };
    } catch {
      return { ok: false, error: "حدث خطأ أثناء تسجيل الدخول" };
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("currentUser");
    setUserState(null);
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
