import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/constants/api";
import { useApp } from "@/context/AppContext";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const MUTED   = "rgba(255,255,255,0.55)";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ApiOrder {
  id: string;
  cafeId: string;
  cafeName?: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "pending" | "preparing" | "ready" | "done";
  type?: "dine" | "car";
  tableNumber?: string;
  createdAt: string;
  confirmedAt?: string;
  paymentMethod?: "cash" | "visa";
}
interface ApiBooking {
  id: string;
  cafeId: string;
  cafeName?: string;
  tableNumber: number;
  guests: number;
  hours?: number;
  totalPrice?: number;
  date: string;
  time: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  confirmedAt?: string;
}

const ORDER_STATUS_AR: Record<ApiOrder["status"], string> = {
  pending:   "بانتظار التأكيد",
  preparing: "قيد التحضير",
  ready:     "جاهز للاستلام",
  done:      "مكتمل",
};
const ORDER_STATUS_COLOR: Record<ApiOrder["status"], string> = {
  pending:   "#F59E0B",
  preparing: "#3B82F6",
  ready:     "#10B981",
  done:      "rgba(255,255,255,0.45)",
};
const BOOKING_STATUS_AR: Record<ApiBooking["status"], string> = {
  pending:   "بانتظار موافقة المقهى",
  confirmed: "تم تأكيد الحجز",
  cancelled: "تم رفض الحجز",
};
const BOOKING_STATUS_COLOR: Record<ApiBooking["status"], string> = {
  pending:   "#F59E0B",
  confirmed: "#10B981",
  cancelled: "#EF4444",
};

function formatWhen(iso: string): string {
  try {
    const d  = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    let h    = d.getHours();
    const mn = String(d.getMinutes()).padStart(2, "0");
    const am = h < 12 ? "ص" : "م";
    h = h % 12 || 12;
    return `${dd}/${mm}/${yy} • ${h}:${mn} ${am}`;
  } catch {
    return iso;
  }
}

export default function CafeHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, cart, cartTotal, activeOrder } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [orders, setOrders]     = useState<ApiOrder[]>([]);
  const [bookings, setBookings] = useState<ApiBooking[]>([]);
  const [cafeName, setCafeName] = useState<string>("");
  const [loading, setLoading]   = useState(true);

  // Pull purchases on focus so coming back to the screen refreshes the list.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const phone = user?.phone?.trim();

      // Always load the cafe name (cheap, public)
      apiFetch<{ cafe: { name: string } }>(`/cafes/${id}${user ? `?userId=${encodeURIComponent(user.id)}` : ""}`)
        .then((d) => { if (!cancelled && d?.cafe?.name) setCafeName(d.cafe.name); })
        .catch(() => { /* ignore */ });

      if (!phone) {
        setLoading(false);
        setOrders([]);
        setBookings([]);
        return () => { cancelled = true; };
      }

      setLoading(true);
      Promise.all([
        apiFetch<{ orders: ApiOrder[] }>(
          `/orders?phone=${encodeURIComponent(phone)}&cafeId=${encodeURIComponent(String(id))}`,
        ).catch(() => ({ orders: [] as ApiOrder[] })),
        apiFetch<{ bookings: ApiBooking[] }>(
          `/bookings?phone=${encodeURIComponent(phone)}`,
        ).catch(() => ({ bookings: [] as ApiBooking[] })),
      ]).then(([o, b]) => {
        if (cancelled) return;
        const cutoff = Date.now() - THIRTY_DAYS_MS;
        const within = (iso: string) => {
          const t = new Date(iso).getTime();
          return Number.isFinite(t) && t >= cutoff;
        };
        setOrders((o.orders ?? []).filter(x => within(x.createdAt)));
        setBookings(
          (b.bookings ?? [])
            .filter(x => x.cafeId === id)
            .filter(x => within(x.createdAt)),
        );
      }).finally(() => { if (!cancelled) setLoading(false); });

      return () => { cancelled = true; };
    }, [id, user?.phone]),
  );

  const cafeCart = cart.filter(c => c.cafeId === id);
  const cafeCartTotal = cafeCart.reduce((s, i) => s + i.price * i.quantity, 0);
  const showActive = !!activeOrder && activeOrder.cafeId === id;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          activeOpacity={0.85}
        >
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>السلة والمشتريات</Text>
          <Text style={styles.headerSub}>{cafeName || "هذا المقهى"}</Text>
        </View>
        <Feather name="shopping-bag" size={22} color={PRIMARY} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 30 }]}
      >
        {/* Retention notice */}
        <View style={styles.notice}>
          <Feather name="info" size={14} color={PRIMARY} />
          <Text style={styles.noticeText}>
            تُحفظ المشتريات لمدة 30 يوماً فقط، ثم تُحذف تلقائياً
          </Text>
        </View>

        {/* ── Active order banner ── */}
        {showActive && (
          <TouchableOpacity
            style={styles.activeCard}
            onPress={() => router.push("/order-timer")}
            activeOpacity={0.85}
          >
            <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.activeTitle}>طلبك قيد التحضير الآن</Text>
              <Text style={styles.activeSub}>اضغط لمتابعة العداد</Text>
            </View>
            <Feather name="chevron-left" size={18} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* ── Current cart for this cafe ── */}
        <Text style={styles.section}>السلة الحالية</Text>
        {cafeCart.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>لا توجد منتجات في السلة لهذا المقهى</Text>
          </View>
        ) : (
          <View style={styles.cartCard}>
            {cafeCart.map(it => (
              <View key={it.id} style={styles.row}>
                <Text style={styles.rowQty}>×{it.quantity}</Text>
                <Text style={styles.rowName} numberOfLines={1}>{it.name}</Text>
                <Text style={styles.rowPrice}>{(it.price * it.quantity).toFixed(3)} ر.ع</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>الإجمالي</Text>
              <Text style={styles.totalValue}>{cafeCartTotal.toFixed(3)} ر.ع</Text>
            </View>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push("/cart")}
              activeOpacity={0.85}
            >
              <Feather name="shopping-cart" size={16} color="#FFF" />
              <Text style={styles.ctaText}>إتمام الشراء</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Past orders ── */}
        <Text style={styles.section}>الطلبات السابقة</Text>
        {loading ? (
          <View style={[styles.emptyCard, { paddingVertical: 24 }]}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>لا توجد طلبات في آخر 30 يوماً</Text>
          </View>
        ) : (
          orders.map(o => (
            <View key={o.id} style={styles.histCard}>
              <View style={styles.histHead}>
                <View style={[styles.statusPill, { backgroundColor: ORDER_STATUS_COLOR[o.status] + "22", borderColor: ORDER_STATUS_COLOR[o.status] + "66" }]}>
                  <Text style={[styles.statusText, { color: ORDER_STATUS_COLOR[o.status] }]}>
                    {ORDER_STATUS_AR[o.status]}
                  </Text>
                </View>
                <Text style={styles.histWhen}>{formatWhen(o.createdAt)}</Text>
              </View>
              {o.items.slice(0, 6).map((it, i) => (
                <View key={`${o.id}-${i}`} style={styles.row}>
                  <Text style={styles.rowQty}>×{it.qty}</Text>
                  <Text style={styles.rowName} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.rowPriceMuted}>{(it.qty * it.price).toFixed(3)}</Text>
                </View>
              ))}
              {o.items.length > 6 && (
                <Text style={styles.muted}>+{o.items.length - 6} منتجات أخرى</Text>
              )}
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.totalLabel}>
                  {o.type === "car" ? "🚗 سيارة" : "🪑 جلوس"}
                  {o.tableNumber ? ` • طاولة ${o.tableNumber}` : ""}
                  {o.paymentMethod ? `  •  ${o.paymentMethod === "visa" ? "بطاقة" : "نقد"}` : ""}
                </Text>
                <Text style={styles.totalValue}>{Number(o.total).toFixed(3)} ر.ع</Text>
              </View>
            </View>
          ))
        )}

        {/* ── Past bookings ── */}
        <Text style={styles.section}>حجوزات الطاولات السابقة</Text>
        {loading ? null : bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>لا توجد حجوزات في آخر 30 يوماً</Text>
          </View>
        ) : (
          bookings.map(b => (
            <View key={b.id} style={styles.histCard}>
              <View style={styles.histHead}>
                <View style={[styles.statusPill, { backgroundColor: BOOKING_STATUS_COLOR[b.status] + "22", borderColor: BOOKING_STATUS_COLOR[b.status] + "66" }]}>
                  <Text style={[styles.statusText, { color: BOOKING_STATUS_COLOR[b.status] }]}>
                    {BOOKING_STATUS_AR[b.status]}
                  </Text>
                </View>
                <Text style={styles.histWhen}>{formatWhen(b.createdAt)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowName}>
                  طاولة {b.tableNumber} • {b.guests} {b.guests === 1 ? "شخص" : "أشخاص"}
                  {b.hours ? ` • ${b.hours} ساعة` : ""}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.muted}>📅 {b.date}{b.time ? `  •  ⏰ ${b.time}` : ""}</Text>
              </View>
              {typeof b.totalPrice === "number" && b.totalPrice > 0 && (
                <>
                  <View style={styles.divider} />
                  <View style={styles.row}>
                    <Text style={styles.totalLabel}>سعر الحجز</Text>
                    <Text style={styles.totalValue}>{Number(b.totalPrice).toFixed(3)} ر.ع</Text>
                  </View>
                </>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: CARD, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "right" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, textAlign: "right" },

  list: { padding: 18, gap: 14 },

  notice: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: `${PRIMARY}14`, borderRadius: 12,
    borderWidth: 1, borderColor: `${PRIMARY}33`,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: PRIMARY, textAlign: "right" },

  section: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY,
    marginTop: 6, marginBottom: -4, textAlign: "right",
  },

  activeCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(16,185,129,0.10)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(16,185,129,0.45)",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  activeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "right" },
  activeSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, textAlign: "right" },

  cartCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, gap: 8,
  },
  histCard: {
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    padding: 14, gap: 6,
  },
  histHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 4,
  },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  histWhen:   { fontSize: 11, fontFamily: "Inter_500Medium", color: MUTED },

  emptyCard: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 16, paddingHorizontal: 14, alignItems: "center",
  },
  muted: { fontSize: 12, fontFamily: "Inter_400Regular", color: MUTED, textAlign: "right" },

  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowQty:   { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY, minWidth: 32 },
  rowName:  { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFF", textAlign: "right" },
  rowPrice: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },
  rowPriceMuted: { fontSize: 12, fontFamily: "Inter_500Medium", color: MUTED },

  divider:    { height: 1, backgroundColor: BORDER, marginVertical: 6 },
  totalLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_700Bold", color: MUTED, textAlign: "right" },
  totalValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  cta: {
    marginTop: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 12,
  },
  ctaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
});
