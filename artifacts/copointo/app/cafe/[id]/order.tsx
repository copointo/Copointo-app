import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { CAFES } from "@/data/mockData";
import { apiFetch } from "@/constants/api";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const CREAM   = "#F5E6CC";

interface MenuItem {
  id: string;
  cafeId: string;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
  createdAt: string;
  image?: string | null;
  originalPrice?: number | null;
  promoBuyQty?: number | null;
  promoGetQty?: number | null;
  stockQty?: number | null;
  initialStockQty?: number | null;
}

const ALL_KEY = "الكل";
const CATEGORIES: { key: string; icon: string }[] = [
  { key: ALL_KEY,         icon: "🗂️" },
  { key: "مشروب ساخن",   icon: "☕" },
  { key: "مشروبات باردة", icon: "🥤" },
  { key: "حلى",          icon: "🍰" },
  { key: "طعام",         icon: "🍽️" },
];

const CATEGORY_ICONS: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.icon }),
  {} as Record<string, string>,
);

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cartCount, cartTotal, addToCart, cart, updateQuantity, activeOrder } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const mockCafe = CAFES.find((c) => c.id === id);

  const [items, setItems]     = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cafeName, setCafeName] = useState<string>(mockCafe?.name ?? "");
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].key);

  const cafe = mockCafe ?? CAFES[0];
  const displayName = cafeName || cafe.name;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ items: MenuItem[] }>(`/cafe/${id}/menu`)
      .then((data) => {
        if (cancelled) return;
        const available = data.items.filter((i) => i.available !== false);
        setItems(available);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Fetch real cafe name from API (so admin-created cafes show their actual name)
    apiFetch<{ cafe: { name: string } }>(`/cafes/${id}`)
      .then((data) => { if (!cancelled && data?.cafe?.name) setCafeName(data.cafe.name); })
      .catch(() => { /* keep mock fallback */ });

    return () => { cancelled = true; };
  }, [id]);

  const visibleItems = useMemo(
    () =>
      activeCategory === ALL_KEY
        ? items
        : items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
        <Feather name="arrow-left" size={20} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{displayName}</Text>
        <Text style={styles.headerSub}>قائمة الكوفي</Text>
      </View>
    </View>
  );

  const handleAdd = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      cafeId: id,
      cafeName: displayName,
      category: item.category,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={styles.muted}>جاري تحميل القائمة...</Text>
        </View>
      </View>
    );
  }

  const showActiveOrderBanner = !!activeOrder && activeOrder.cafeId === id;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {renderHeader()}

      {showActiveOrderBanner && (
        <ActiveOrderBanner
          minutes={activeOrder!.prepMinutes}
          startedAt={activeOrder!.startedAt}
          drinks={activeOrder!.drinkQty}
          onPress={() => router.push({
            pathname: "/order-timer",
            params: {
              orderId:  activeOrder!.orderId,
              cafeId:   activeOrder!.cafeId,
              cafeName: activeOrder!.cafeName,
              minutes:  String(activeOrder!.prepMinutes),
              drinks:   String(activeOrder!.drinkQty),
            },
          })}
        />
      )}

      {/* Category tabs (always shown) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {CATEGORIES.map((c) => (
          <CategoryTab
            key={c.key}
            label={c.key}
            icon={c.icon}
            active={activeCategory === c.key}
            onPress={() => { Haptics.selectionAsync(); setActiveCategory(c.key); }}
          />
        ))}
      </ScrollView>

      {/* Items list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + (cartCount > 0 ? 110 : 30) }]}
      >
        {visibleItems.length === 0 && (
          <View style={[styles.center, { paddingTop: 60 }]}>
            <Text style={{ fontSize: 48 }}>{CATEGORY_ICONS[activeCategory] ?? "🍽️"}</Text>
            <Text style={styles.emptyTitle}>لا توجد منتجات في هذا التصنيف</Text>
            <Text style={styles.muted}>جرّب تصنيفاً آخر</Text>
          </View>
        )}
        {visibleItems.map((item) => {
          const cartItem = cart.find((c) => c.id === item.id);
          const qty = cartItem?.quantity ?? 0;
          const tracked   = item.stockQty != null;
          const remaining = tracked ? Math.max(0, (item.stockQty as number) - qty) : Infinity;
          const depleted  = tracked && (item.stockQty as number) <= 0;
          const lowStock  = tracked && !depleted && (item.stockQty as number) > 0
            && (item.stockQty as number) <= Math.max(1, Math.ceil(((item.initialStockQty ?? item.stockQty) as number) * 0.25));
          return (
            <View key={item.id} style={styles.card}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.cardImage} />
              ) : (
                <LinearGradient
                  colors={["rgba(232,184,109,0.16)", "rgba(232,184,109,0.04)"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.cardIcon}
                >
                  <Text style={{ fontSize: 36 }}>{CATEGORY_ICONS[item.category] ?? "🍽️"}</Text>
                </LinearGradient>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                )}
                {!!(item.promoBuyQty && item.promoGetQty) && (
                  <View style={styles.bundleBadge}>
                    <Text style={styles.bundleBadgeText}>
                      🎁 اشترِ {item.promoBuyQty} واحصل على {item.promoGetQty} مجاناً
                    </Text>
                  </View>
                )}
                {tracked && (
                  <View style={[
                    styles.stockBadge,
                    depleted ? styles.stockBadgeOut : lowStock ? styles.stockBadgeLow : styles.stockBadgeOk,
                  ]}>
                    <Text style={[
                      styles.stockBadgeText,
                      depleted ? styles.stockTextOut : lowStock ? styles.stockTextLow : styles.stockTextOk,
                    ]}>
                      {depleted
                        ? "نَفِد المنتج"
                        : lowStock
                          ? `كمية محدودة — متبقّي ${item.stockQty}`
                          : `متوفر: ${item.stockQty}`}
                    </Text>
                  </View>
                )}
                <View style={styles.cardBottom}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {!!(item.originalPrice && item.originalPrice > item.price) && (
                      <Text style={styles.oldPrice}>{item.originalPrice.toFixed(3)}</Text>
                    )}
                    <Text style={styles.cardPrice}>{item.price.toFixed(3)} OMR</Text>
                    {!!(item.originalPrice && item.originalPrice > item.price) && (
                      <View style={styles.discountChip}>
                        <Text style={styles.discountChipText}>
                          -{Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}%
                        </Text>
                      </View>
                    )}
                  </View>
                  {depleted ? (
                    <View style={[styles.addBtn, { opacity: 0.45 }]}>
                      <View style={[styles.addBtnGrad, { backgroundColor: "#3a1a1a" }]}>
                        <Feather name="x" size={18} color={CREAM} />
                      </View>
                    </View>
                  ) : qty > 0 ? (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => { Haptics.selectionAsync(); updateQuantity(item.id, qty - 1); }}
                      >
                        <Feather name="minus" size={14} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: PRIMARY, opacity: remaining <= 0 ? 0.4 : 1 }]}
                        onPress={() => { if (remaining > 0) handleAdd(item); }}
                        disabled={remaining <= 0}
                      >
                        <Feather name="plus" size={14} color="#000" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(item)} activeOpacity={0.85}>
                      <LinearGradient
                        colors={[PRIMARY, "#C9985A"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.addBtnGrad}
                      >
                        <Feather name="plus" size={18} color="#000" />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Cart bar */}
      {cartCount > 0 && (
        <View style={[styles.cartBarWrap, { paddingBottom: botPad + 12 }]}>
          <TouchableOpacity
            style={styles.cartBar}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/cart"); }}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cartBarGrad}
            >
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{cartCount}</Text>
              </View>
              <Text style={styles.cartBarText}>متابعة الطلب</Text>
              <Text style={styles.cartBarPrice}>{cartTotal.toFixed(3)} OMR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Persistent active-order banner (shown on top of menu) ──────
function ActiveOrderBanner({
  minutes, startedAt, drinks, onPress,
}: { minutes: number; startedAt: number; drinks: number; onPress: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalMs   = Math.max(60_000, minutes * 60 * 1000);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainMs  = Math.max(0, totalMs - elapsedMs);
  const pct       = Math.max(0, Math.min(100, (1 - elapsedMs / totalMs) * 100));
  const mm = Math.floor(remainMs / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.activeBannerWrap}>
      <LinearGradient
        colors={["rgba(232,184,109,0.18)", "rgba(232,184,109,0.05)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.activeBanner}
      >
        <View style={styles.activeBannerIcon}>
          <Feather name="clock" size={16} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.activeBannerTitle}>طلبك قيد التحضير</Text>
          <Text style={styles.activeBannerSub}>
            {drinks} مشروب • متبقي {String(mm).padStart(2,"0")}:{String(ss).padStart(2,"0")}
          </Text>
          <View style={styles.activeBannerBar}>
            <View style={[styles.activeBannerBarFill, { width: `${pct}%` }]} />
          </View>
        </View>
        <Feather name="chevron-left" size={18} color={PRIMARY} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Animated category tab with diagonal shimmer sweep ──────────
function CategoryTab({
  label, icon, active, onPress,
}: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active || width === 0) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [active, width, progress]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-50, width + 20]) },
      { skewX: "-20deg" },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.85, 1], [0, 0.85, 0.85, 0]),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && width > 0 && (
        <Animated.View pointerEvents="none" style={[styles.tabShine, shineStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,232,180,0.55)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.6)", marginTop: 2 },

  // States
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: CREAM, marginTop: 8 },
  muted:      { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center" },

  // Active order banner
  activeBannerWrap: { paddingHorizontal: 14, paddingTop: 8 },
  activeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: PRIMARY,
  },
  activeBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(232,184,109,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  activeBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  activeBannerSub:   { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.7)", marginTop: 1 },
  activeBannerBar: {
    height: 3, marginTop: 6, borderRadius: 2,
    backgroundColor: "rgba(232,184,109,0.15)", overflow: "hidden",
  },
  activeBannerBarFill: { height: "100%", backgroundColor: PRIMARY },

  // Tabs
  tabs: { paddingHorizontal: 14, paddingVertical: 6, gap: 6 },
  tab: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingHorizontal: 16, paddingVertical: 0,
    height: 22, minWidth: 88,
    borderRadius: 5, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: "rgba(232,184,109,0.14)", borderColor: PRIMARY },
  tabIcon:         { fontSize: 10 },
  tabLabel:        { fontSize: 10.5, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.65)", lineHeight: 12, includeFontPadding: false },
  tabLabelActive:  { color: PRIMARY },
  tabShine: {
    position: "absolute",
    top: 0, bottom: 0,
    width: 28,
    transform: [{ skewX: "-20deg" }],
  },

  // List
  list: { paddingHorizontal: 16, paddingTop: 6, gap: 12 },

  // Card
  card: {
    flexDirection: "row", gap: 12, padding: 12,
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    marginBottom: 12,
  },
  cardIcon: {
    width: 78, height: 78, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  cardImage: {
    width: 78, height: 78, borderRadius: 16,
    backgroundColor: "rgba(232,184,109,0.08)",
  },
  cardBody:   { flex: 1, gap: 4 },
  cardName:   { fontSize: 16, fontFamily: "Inter_700Bold", color: CREAM },
  cardDesc:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.55)", lineHeight: 16 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  cardPrice:  { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  oldPrice:   {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: "rgba(245,230,204,0.5)",
    textDecorationLine: "line-through",
  },
  discountChip: {
    backgroundColor: "rgba(239,68,68,0.18)",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  discountChipText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#FCA5A5",
  },
  bundleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(232,184,109,0.15)",
    borderColor: "rgba(232,184,109,0.4)", borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    marginTop: 4,
  },
  bundleBadgeText: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY,
  },
  stockBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, marginTop: 4,
  },
  stockBadgeOk:  { backgroundColor: "rgba(34,197,94,0.12)",  borderColor: "rgba(34,197,94,0.35)" },
  stockBadgeLow: { backgroundColor: "rgba(234,179,8,0.15)",  borderColor: "rgba(234,179,8,0.4)"  },
  stockBadgeOut: { backgroundColor: "rgba(239,68,68,0.18)",  borderColor: "rgba(239,68,68,0.45)" },
  stockBadgeText:{ fontSize: 11, fontFamily: "Inter_700Bold" },
  stockTextOk:   { color: "#86EFAC" },
  stockTextLow:  { color: "#FDE68A" },
  stockTextOut:  { color: "#FCA5A5" },

  // Add controls
  addBtn:     { borderRadius: 12, overflow: "hidden" },
  addBtnGrad: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  qtyRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  qtyText:    { fontSize: 15, fontFamily: "Inter_700Bold", color: CREAM, minWidth: 18, textAlign: "center" },

  // Cart bar
  cartBarWrap:  { position: "absolute", left: 16, right: 16, bottom: 0 },
  cartBar:      { borderRadius: 18, overflow: "hidden" },
  cartBarGrad:  {
    height: 60, paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  cartCountBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cartCountText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  cartBarText:   { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  cartBarPrice:  { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
