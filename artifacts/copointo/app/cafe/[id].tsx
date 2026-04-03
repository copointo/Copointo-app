import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
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
import { useColors } from "@/hooks/useColors";

const CATEGORY_TABS = [
  { key: "hot", label: "Hot Drinks", icon: "☕" },
  { key: "cold", label: "Cold Drinks", icon: "🧊" },
  { key: "dessert", label: "Desserts", icon: "🍰" },
];

export default function CafeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cartCount, cartTotal } = useApp();

  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];
  const [activeCategory, setActiveCategory] = useState<"hot" | "cold" | "dessert">("hot");

  const products = PRODUCTS.filter(
    (p) => p.cafeId === "cafe_1" && p.category === activeCategory
  );

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.headerImage]}>
          <Image source={cafe.image} style={styles.coverImage} resizeMode="cover" />
          <TouchableOpacity
            style={[styles.backBtn, { top: topPadding + 8, backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>

          <View style={[styles.cafeInfo, { backgroundColor: colors.card }]}>
            <View style={styles.cafeInfoHeader}>
              <View style={[styles.logoCircle, { backgroundColor: colors.cream }]}>
                <Text style={styles.logoEmoji}>{cafe.logo}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cafeName, { color: colors.foreground }]}>{cafe.name}</Text>
                <Text style={[styles.cafeCategory, { color: colors.mutedForeground }]}>
                  {cafe.category}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: cafe.isOpen ? colors.success + "20" : colors.muted }]}>
                <View style={[styles.statusDot, { backgroundColor: cafe.isOpen ? colors.success : colors.mutedForeground }]} />
                <Text style={[styles.statusText, { color: cafe.isOpen ? colors.success : colors.mutedForeground }]}>
                  {cafe.isOpen ? "Open" : "Closed"}
                </Text>
              </View>
            </View>
            <View style={styles.cafeMeta}>
              <View style={styles.metaItem}>
                <Feather name="star" size={14} color={colors.gold} />
                <Text style={[styles.metaText, { color: colors.foreground }]}>{cafe.rating}</Text>
                <Text style={[styles.metaSubtext, { color: colors.mutedForeground }]}>
                  ({cafe.reviewCount})
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="map-pin" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{cafe.distance}</Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="clock" size={14} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {cafe.isOpen ? "7am – 11pm" : "Opens 7am"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => {}}
            activeOpacity={0.85}
          >
            <Feather name="shopping-cart" size={18} color={colors.primaryForeground} />
            <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Order Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary, flex: 0, width: 52 }]}
            onPress={() => router.push(`/cafe/${id}/chat`)}
          >
            <Text style={{ fontSize: 22 }}>🤖</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.secondary, flex: 0, width: 52 }]}
            onPress={() => router.push(`/cafe/${id}/book`)}
          >
            <Feather name="calendar" size={18} color={colors.secondaryForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.menu}>
          <View style={styles.categoryTabs}>
            {CATEGORY_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor:
                      activeCategory === tab.key ? colors.primary : colors.secondary,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveCategory(tab.key as any);
                }}
              >
                <Text style={styles.categoryIcon}>{tab.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    {
                      color:
                        activeCategory === tab.key
                          ? colors.primaryForeground
                          : colors.secondaryForeground,
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.products}>
            {products.length === 0 ? (
              <View style={styles.emptyProducts}>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No items in this category
                </Text>
              </View>
            ) : (
              products.map((p) => (
                <ProductCard key={p.id} product={p} cafeName={cafe.name} />
              ))
            )}
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {cartCount > 0 && (
        <TouchableOpacity
          style={[styles.cartFloating, { backgroundColor: colors.primary, bottom: bottomPadding + 20 }]}
          onPress={() => router.push("/cart")}
        >
          <View style={[styles.cartBadge, { backgroundColor: colors.espresso }]}>
            <Text style={[styles.cartBadgeText, { color: "#FFF" }]}>{cartCount}</Text>
          </View>
          <Text style={[styles.cartFloatingText, { color: colors.primaryForeground }]}>
            View Cart
          </Text>
          <Text style={[styles.cartFloatingPrice, { color: colors.primaryForeground }]}>
            {cartTotal.toFixed(3)} OMR
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerImage: { position: "relative" },
  coverImage: { width: "100%", height: 240, resizeMode: "cover" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  cafeInfo: {
    marginHorizontal: 16,
    marginTop: -24,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  cafeInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 28 },
  cafeName: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  cafeCategory: { fontSize: 13, fontFamily: "Inter_400Regular" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cafeMeta: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  metaSubtext: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  menu: { paddingHorizontal: 16 },
  categoryTabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
  categoryTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
    gap: 4,
  },
  categoryIcon: { fontSize: 18 },
  categoryLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  products: { gap: 0 },
  emptyProducts: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  cartFloating: {
    position: "absolute",
    left: 20,
    right: 20,
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  cartBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  cartFloatingText: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cartFloatingPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
