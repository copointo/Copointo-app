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
  avatar?: string;
  level: number;
  totalOrders: number;
  points: number;
}

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
  const [user, setUserState] = useState<User | null>({
    id: "user_1",
    name: "Ahmed Al-Rashidi",
    avatar: undefined,
    level: 42,
    totalOrders: 89,
    points: 2450,
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [likedVideos, setLikedVideos] = useState<string[]>([]);
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [cartData, likesData, ordersData] = await Promise.all([
        AsyncStorage.getItem("cart"),
        AsyncStorage.getItem("likedVideos"),
        AsyncStorage.getItem("orderHistory"),
      ]);
      if (cartData) setCart(JSON.parse(cartData));
      if (likesData) setLikedVideos(JSON.parse(likesData));
      if (ordersData) setOrderHistory(JSON.parse(ordersData));
    } catch (e) {}
  };

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
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
