import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { Cafe } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

function isImgSrc(s: string | null | undefined): boolean {
  return !!(s && (s.startsWith("http") || s.startsWith("data:") || s.startsWith("blob:")));
}

interface CafeCardProps {
  cafe: Cafe;
  compact?: boolean;
  onPress?: (cafe: Cafe) => void;
}

export function CafeCard({ cafe, compact = false, onPress }: CafeCardProps) {
  const colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) { onPress(cafe); return; }
    router.push(`/cafe/${cafe.id}`);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { backgroundColor: colors.card, shadowColor: colors.espresso }]}
        onPress={handlePress}
        activeOpacity={0.92}
      >
        <Image source={cafe.image} style={styles.compactImage} resizeMode="cover" />
        <View style={[styles.compactStatusBadge, { backgroundColor: cafe.isOpen ? colors.success : colors.muted }]}>
          <Text style={[styles.compactStatusText, { color: cafe.isOpen ? colors.successForeground : colors.mutedForeground }]}>
            {cafe.isOpen ? "Open" : "Closed"}
          </Text>
        </View>
        <View style={styles.compactContent}>
          <View style={styles.compactLogoRow}>
            <View style={styles.compactLogoCircle}>
              {isImgSrc(cafe.logo)
                ? <Image source={{ uri: cafe.logo }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                : <Text style={styles.compactLogoEmoji}>{cafe.logo || "☕"}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.compactName, { color: colors.foreground }]} numberOfLines={1}>
                {cafe.name}
              </Text>
              <Text style={[styles.compactCategory, { color: colors.mutedForeground }]} numberOfLines={1}>
                {cafe.category}
              </Text>
            </View>
          </View>
          <View style={styles.compactMeta}>
            <View style={styles.metaItem}>
              <Feather name="star" size={11} color={colors.gold} />
              <Text style={[styles.compactMetaText, { color: colors.foreground }]}>
                {cafe.rating}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={11} color={colors.mutedForeground} />
              <Text style={[styles.compactMetaText, { color: colors.mutedForeground }]}>
                {cafe.distance}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, shadowColor: colors.espresso }]}
      onPress={handlePress}
      activeOpacity={0.92}
    >
      <Image source={cafe.image} style={styles.image} resizeMode="cover" />
      <View style={[styles.statusBadge, { backgroundColor: cafe.isOpen ? colors.success : colors.muted }]}>
        <Text style={[styles.statusText, { color: cafe.isOpen ? colors.successForeground : colors.mutedForeground }]}>
          {cafe.isOpen ? "Open" : "Closed"}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            {isImgSrc(cafe.logo)
              ? <Image source={{ uri: cafe.logo }} style={{ width: 42, height: 42, borderRadius: 21 }} />
              : <Text style={styles.logoEmoji}>{cafe.logo || "☕"}</Text>}
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {cafe.name}
            </Text>
            <Text style={[styles.category, { color: colors.mutedForeground }]}>
              {cafe.category}
            </Text>
          </View>
        </View>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="star" size={13} color={colors.gold} />
            <Text style={[styles.metaText, { color: colors.foreground }]}>
              {cafe.rating}
            </Text>
            <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
              ({cafe.reviewCount})
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {cafe.distance}
            </Text>
          </View>
        </View>
        <View style={styles.tags}>
          {cafe.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.tagText, { color: colors.secondaryForeground }]}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  image: {
    width: "100%",
    height: 160,
    resizeMode: "cover",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  content: {
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  reviewCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tags: {
    flexDirection: "row",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },

  // Compact (grid) styles
  compactCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  compactImage: {
    width: "100%",
    height: 110,
    resizeMode: "cover",
  },
  compactStatusBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  compactStatusText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  compactContent: {
    padding: 10,
    gap: 6,
  },
  compactLogoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  compactLogoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactLogoEmoji: {
    fontSize: 14,
  },
  compactName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 1,
  },
  compactCategory: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  compactMeta: {
    flexDirection: "row",
    gap: 10,
  },
  compactMetaText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
