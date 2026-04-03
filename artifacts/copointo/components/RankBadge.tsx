import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { getRank } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

interface RankBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export function RankBadge({ level, size = "md", showName = true }: RankBadgeProps) {
  const colors = useColors();
  const rank = getRank(level);

  const sizeMap = {
    sm: { badge: 32, icon: 14, text: 10 },
    md: { badge: 48, icon: 22, text: 12 },
    lg: { badge: 72, icon: 34, text: 15 },
  };

  const s = sizeMap[size];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          {
            width: s.badge,
            height: s.badge,
            borderRadius: s.badge / 2,
            backgroundColor: rank.color + "22",
            borderColor: rank.color,
          },
        ]}
      >
        <Text style={{ fontSize: s.icon }}>{rank.icon}</Text>
      </View>
      {showName && (
        <View style={styles.labelBox}>
          <Text style={[styles.rankName, { color: rank.color, fontSize: s.text }]}>
            {rank.nameEn}
          </Text>
          <Text style={[styles.rankAr, { color: colors.mutedForeground, fontSize: s.text - 1 }]}>
            {rank.name}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  labelBox: {
    gap: 1,
  },
  rankName: {
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  rankAr: {
    fontFamily: "Inter_400Regular",
  },
});
