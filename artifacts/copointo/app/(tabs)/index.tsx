import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CafeCard } from "@/components/CafeCard";
import { SearchBar } from "@/components/SearchBar";
import { useApp } from "@/context/AppContext";
import { CAFES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = ["All", "Specialty", "Traditional", "Artisan", "Bistro"];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, cartCount } = useApp();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredCafes = useMemo(() => {
    return CAFES.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" ||
        c.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
        c.tags.some((t) =>
          t.toLowerCase().includes(selectedCategory.toLowerCase())
        );
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const topPadding =
    Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPadding + 12 },
        ]}
      >
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            Good morning,
          </Text>
          <Text style={[styles.userName, { color: colors.foreground }]}>
            {user?.name.split(" ")[0]} ☕
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.cartBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/cart")}
        >
          <Feather name="shopping-bag" size={20} color={colors.primaryForeground} />
          {cartCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.espresso }]}>
              <Text style={[styles.badgeText, { color: "#FFF" }]}>
                {cartCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrapper}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search cafes in Muscat..."
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categories}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                {
                  backgroundColor:
                    selectedCategory === cat ? colors.primary : colors.secondary,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.categoryText,
                  {
                    color:
                      selectedCategory === cat
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                  },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            {selectedCategory === "All" ? "Nearby Cafes" : selectedCategory}
          </Text>
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {filteredCafes.length} cafes
          </Text>
        </View>

        {filteredCafes.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="coffee" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No cafes found
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredCafes.map((cafe, index) => (
              <View key={cafe.id} style={styles.gridItem}>
                <CafeCard cafe={cafe} compact />
              </View>
            ))}
          </View>
        )}

        <View style={{ height: Platform.OS === "web" ? 110 : 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  cartBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  searchWrapper: {
    marginBottom: 16,
  },
  categories: {
    marginBottom: 16,
    marginHorizontal: -20,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  count: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "48%",
  },
});
