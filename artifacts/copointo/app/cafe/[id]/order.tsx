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
}

const CATEGORIES: { key: string; icon: string }[] = [
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
  const { cartCount, cartTotal, addToCart, cart, updateQuantity } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];

  const [items, setItems]     = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].key);

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
    return () => { cancelled = true; };
  }, [id]);

  const visibleItems = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
        <Feather name="arrow-left" size={20} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{cafe.name}</Text>
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
      cafeId: cafe.id,
      cafeName: cafe.name,
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

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {renderHeader()}

      {/* Category tabs (always shown) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {CATEGORIES.map((c) => {
          const active = activeCategory === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveCategory(c.key); }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16 }}>{c.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{c.key}</Text>
            </TouchableOpacity>
          );
        })}
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
                <View style={styles.cardBottom}>
                  <Text style={styles.cardPrice}>{item.price.toFixed(3)} OMR</Text>
                  {qty > 0 ? (
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => { Haptics.selectionAsync(); updateQuantity(item.id, qty - 1); }}
                      >
                        <Feather name="minus" size={14} color="#FFF" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity
                        style={[styles.qtyBtn, { backgroundColor: PRIMARY }]}
                        onPress={() => handleAdd(item)}
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

  // Tabs
  tabs: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  tabActive: { backgroundColor: "rgba(232,184,109,0.18)", borderColor: PRIMARY },
  tabLabel:        { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.7)" },
  tabLabelActive:  { color: PRIMARY },

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
