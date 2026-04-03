import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RankBadge } from "@/components/RankBadge";
import { useApp } from "@/context/AppContext";
import { CAFES, RANKS, getRank } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const LEADERBOARD = [
  { name: "Mohammed Al-Habsi", level: 892, rank: 1 },
  { name: "Sara Al-Zahra", level: 743, rank: 2 },
  { name: "Khalid Mansoor", level: 698, rank: 3 },
  { name: "Fatima Al-Balushi", level: 621, rank: 4 },
  { name: "Ahmed Al-Rashidi", level: 42, rank: 47, isMe: true },
];

const CAFE_STATS = CAFES.slice(0, 4).map((c, i) => ({
  ...c,
  orders: [34, 21, 18, 12][i],
}));

export default function GameScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<"stats" | "ranks" | "leaderboard">("stats");

  const level = user?.level ?? 1;
  const rank = getRank(level);
  const nextFreeLevel = 7 - (level % 7) === 7 ? 0 : 7 - (level % 7);
  const progressInRank = ((level - rank.min) / (rank.max - rank.min)) * 100;
  const ordersThisLevel = level % 7;
  const freeCoffeesEarned = Math.floor(level / 7);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Copointo Game</Text>
        <View style={[styles.levelBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.levelText, { color: colors.primaryForeground }]}>
            Lv. {level}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: Platform.OS === "web" ? 110 : 100 }]}
      >
        <View style={[styles.heroCard, { backgroundColor: rank.color + "15", borderColor: rank.color + "40" }]}>
          <RankBadge level={level} size="lg" />
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: colors.foreground }]}>{level}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>Level</Text>
            </View>
            <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: colors.foreground }]}>{freeCoffeesEarned}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>Free Coffees</Text>
            </View>
            <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatValue, { color: colors.foreground }]}>{nextFreeLevel}</Text>
              <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>To Free Coffee</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
                Rank Progress
              </Text>
              <Text style={[styles.progressValue, { color: colors.foreground }]}>
                {level}/{rank.max}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(progressInRank, 100)}%` as any,
                    backgroundColor: rank.color,
                  },
                ]}
              />
            </View>
          </View>

          <View style={[styles.freeCoffeeInfo, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
            <Text style={{ fontSize: 20 }}>☕</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.freeCoffeeTitle, { color: colors.primary }]}>
                Free coffee every 7 levels!
              </Text>
              <Text style={[styles.freeCoffeeDesc, { color: colors.mutedForeground }]}>
                {ordersThisLevel}/7 orders this cycle — {nextFreeLevel} more to unlock
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.tabBar}>
          {(["stats", "ranks", "leaderboard"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabItem,
                {
                  backgroundColor:
                    activeTab === tab ? colors.primary : colors.secondary,
                },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab);
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      activeTab === tab
                        ? colors.primaryForeground
                        : colors.secondaryForeground,
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "stats" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your Cafe Orders
            </Text>
            {CAFE_STATS.map((cafe) => (
              <View
                key={cafe.id}
                style={[styles.cafeStatRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={styles.cafeEmoji}>{cafe.logo}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cafeName, { color: colors.foreground }]}>{cafe.name}</Text>
                  <View style={[styles.miniBar, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.miniFill,
                        {
                          width: `${(cafe.orders / 40) * 100}%` as any,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.orderCount, { color: colors.primary }]}>
                  {cafe.orders} orders
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === "ranks" && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              All Ranks
            </Text>
            {RANKS.map((r) => {
              const isCurrent = level >= r.min && level <= r.max;
              return (
                <View
                  key={r.name}
                  style={[
                    styles.rankRow,
                    {
                      backgroundColor: isCurrent ? r.color + "15" : colors.card,
                      borderColor: isCurrent ? r.color + "50" : colors.border,
                    },
                  ]}
                >
                  <Text style={styles.rankRowIcon}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rankRowName, { color: isCurrent ? r.color : colors.foreground }]}>
                      {r.nameEn}
                    </Text>
                    <Text style={[styles.rankRowAr, { color: colors.mutedForeground }]}>
                      {r.name} • Lv. {r.min}–{r.max}
                    </Text>
                  </View>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: r.color }]}>
                      <Text style={{ color: "#FFF", fontSize: 10, fontFamily: "Inter_700Bold" }}>
                        Current
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {activeTab === "leaderboard" && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Oman Rankings
              </Text>
              <View style={[styles.omanFlag, { backgroundColor: colors.secondary }]}>
                <Text style={{ fontSize: 16 }}>🇴🇲</Text>
              </View>
            </View>
            {LEADERBOARD.map((entry) => (
              <View
                key={entry.name}
                style={[
                  styles.leaderRow,
                  {
                    backgroundColor: entry.isMe ? colors.primary + "15" : colors.card,
                    borderColor: entry.isMe ? colors.primary + "50" : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.leaderRank,
                    {
                      color:
                        entry.rank === 1
                          ? "#FFD700"
                          : entry.rank === 2
                          ? "#C0C0C0"
                          : entry.rank === 3
                          ? "#CD7F32"
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  #{entry.rank}
                </Text>
                <View style={[styles.leaderAvatar, { backgroundColor: colors.secondary }]}>
                  <Text style={{ fontSize: 18 }}>
                    {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : "👤"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.leaderName, { color: entry.isMe ? colors.primary : colors.foreground }]}>
                    {entry.name} {entry.isMe ? "(You)" : ""}
                  </Text>
                  <Text style={[styles.leaderLevel, { color: colors.mutedForeground }]}>
                    Level {entry.level} • {getRank(entry.level).nameEn}
                  </Text>
                </View>
                <Text style={{ fontSize: 16 }}>{getRank(entry.level).icon}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  levelText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  scroll: { paddingHorizontal: 20 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
    gap: 16,
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  heroStat: { alignItems: "center", gap: 4 },
  heroStatValue: { fontSize: 26, fontFamily: "Inter_700Bold" },
  heroStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  heroDivider: { width: 1, height: 36 },
  progressSection: { gap: 8 },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  progressValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
  },
  freeCoffeeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  freeCoffeeTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  freeCoffeeDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { gap: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  omanFlag: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cafeStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cafeEmoji: { fontSize: 24 },
  cafeName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  miniBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  miniFill: { height: "100%", borderRadius: 3 },
  orderCount: { fontSize: 13, fontFamily: "Inter_700Bold" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  rankRowIcon: { fontSize: 28 },
  rankRowName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  rankRowAr: { fontSize: 12, fontFamily: "Inter_400Regular" },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  leaderRank: { fontSize: 16, fontFamily: "Inter_700Bold", width: 28 },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  leaderName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  leaderLevel: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
