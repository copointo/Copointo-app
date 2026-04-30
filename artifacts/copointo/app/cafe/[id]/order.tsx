import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { useApp } from "@/context/AppContext";
import { CAFES, PRODUCTS } from "@/data/mockData";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";

const CATEGORY_TABS = [
  { key: "hot",     label: "مشروبات ساخنة", icon: "☕" },
  { key: "cold",    label: "مشروبات باردة",  icon: "🧊" },
  { key: "dessert", label: "حلويات",         icon: "🍰" },
];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cartCount, cartTotal } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];
  const [activeCategory, setActiveCategory] = useState<"hot" | "cold" | "dessert">("hot");

  const products = PRODUCTS.filter(
    (p) => p.cafeId === "cafe_1" && p.category === activeCategory
  );

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{cafe.name}</Text>
          <Text style={styles.headerSub}>اختر مشروبك</Text>
        </View>
      </View>

      {/* Category tabs */}
      <View style={styles.tabs}>
        {CATEGORY_TABS.map((tab) => {
          const active = activeCategory === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => { Haptics.selectionAsync(); setActiveCategory(tab.key as any); }}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Products */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + (cartCount > 0 ? 90 : 30) }]}
      >
        {products.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>☕</Text>
            <Text style={styles.emptyText}>لا توجد منتجات في هذه الفئة</Text>
          </View>
        ) : (
          products.map((p) => (
            <ProductCard key={p.id} product={p} cafeName={cafe.name} />
          ))
        )}
      </ScrollView>

      {/* Cart floating button */}
      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartBtn, { bottom: botPad + 16 }]}
          onPress={() => router.push("/cart")}
          activeOpacity={0.9}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartLabel}>عرض السلة</Text>
          <Text style={styles.cartPrice}>{cartTotal.toFixed(3)} OMR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },

  tabs: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  tabActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  tabLabel:  { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.60)" },
  tabLabelActive: { color: "#FFF" },

  list:  { paddingHorizontal: 16, paddingTop: 4 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },

  cartBtn: {
    position: "absolute", left: 16, right: 16,
    height: 58, borderRadius: 18, backgroundColor: PRIMARY,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  cartBadge:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
  cartBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },
  cartLabel:     { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  cartPrice:     { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
});
