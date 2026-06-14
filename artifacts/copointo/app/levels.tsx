import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RANKS } from "../data/mockData";
import { RANK_LOGOS } from "../data/rankLogos";
import { RANK_BADGES } from "../data/rankBadges";
import { FRAMES } from "../data/frames";
import { getMilestonesInRange, getMilestonesUpToLevel, COIN_MILESTONES, COIN_MILESTONE_STEP, COIN_PER_MILESTONE } from "../data/coinMilestones";
import { useApp } from "../context/AppContext";

const COIN_IMG = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

function RankRow({
  rank, index, isCurrent, isUnlocked, currentLevel,
}: {
  rank: typeof RANKS[number];
  index: number;
  isCurrent: boolean;
  isUnlocked: boolean;
  currentLevel: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(20)).current;
  const tier = index + 1;
  const logo = RANK_LOGOS[tier];
  const badge = RANK_BADGES[tier];
  const frame = FRAMES[tier - 1];
  // Coin milestones (every 2 levels) that fall inside this rank's range —
  // summarised into a total + earned-so-far progress line for clarity.
  const milestones = getMilestonesInRange(rank.min, rank.max);
  const coinsTotal = milestones.reduce((s, m) => s + m.coins, 0);
  const reachedInRank = milestones.filter((m) => currentLevel >= m.level).length;
  const coinsEarnedInRank = reachedInRank * COIN_PER_MILESTONE;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 380, delay: index * 70, useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0, duration: 420, delay: index * 70,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateX]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      <View style={[styles.row, isCurrent && styles.rowCurrent, !isUnlocked && styles.rowLocked]}>
        <View style={styles.emblemColumn}>
          <View style={[
            styles.badgeWrap,
            { borderColor: isUnlocked ? rank.color : "rgba(255,255,255,0.12)",
              shadowColor: isUnlocked ? rank.color : "transparent" },
          ]}>
            {logo ? (
              <Image
                source={logo}
                style={[styles.badgeImg, !isUnlocked && { opacity: 0.25 }]}
              />
            ) : (
              <Text style={styles.badgeIcon}>{rank.icon}</Text>
            )}
            {!isUnlocked && (
              <View style={styles.lockOverlay}>
                <Feather name="lock" size={18} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </View>
          {badge && (
            <View style={styles.shieldWrap}>
              <Image
                source={badge}
                style={[styles.shieldImg, !isUnlocked && { opacity: 0.25 }]}
              />
              {!isUnlocked && (
                <View style={styles.lockOverlay}>
                  <Feather name="lock" size={14} color="rgba(255,255,255,0.7)" />
                </View>
              )}
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.tierLabel}>المستوى {tier}</Text>
            {isCurrent && (
              <View style={styles.currentChip}>
                <Feather name="check" size={10} color="#000" />
                <Text style={styles.currentChipText}>أنت الآن</Text>
              </View>
            )}
            {isUnlocked && !isCurrent && (
              <View style={styles.unlockedChip}>
                <Feather name="award" size={10} color={PRIMARY} />
                <Text style={styles.unlockedChipText}>تم الفوز</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rankName, !isUnlocked && { color: "rgba(255,255,255,0.55)" }]}>
            {rank.name}
          </Text>
          <Text style={styles.rankRange}>المستويات {rank.min} – {rank.max}</Text>
          <Text style={styles.rewardLabel}>
            🎁 الجوائز: إطار + وسام "{rank.name}"
          </Text>
          <View style={styles.prizeRow}>
            {frame && (
              <View style={styles.prizeMini}>
                <Image
                  source={frame.source}
                  style={[styles.prizeMiniImg, !isUnlocked && { opacity: 0.25 }]}
                />
                <Text style={styles.prizeMiniLabel}>إطار</Text>
              </View>
            )}
            {badge && (
              <View style={styles.prizeMini}>
                <Image
                  source={badge}
                  style={[styles.prizeMiniImg, !isUnlocked && { opacity: 0.25 }]}
                />
                <Text style={styles.prizeMiniLabel}>وسام</Text>
              </View>
            )}
          </View>

          {milestones.length > 0 && (
            <View style={styles.coinSection}>
              <View style={styles.coinHeaderRow}>
                <Image source={COIN_IMG} style={styles.coinHeaderImg} />
                <Text style={styles.coinHeaderText}>
                  عملات هذه الرتبة — {COIN_PER_MILESTONE} عملة كل مستويين
                </Text>
              </View>
              <Text style={styles.coinSummary}>
                اربح حتى{" "}
                <Text style={styles.coinSummaryStrong}>{coinsTotal} عملة</Text>
                {" "}في هذه الرتبة ({rank.min}–{rank.max})
              </Text>
              {isUnlocked ? (
                <View style={styles.coinProgressRow}>
                  <Image source={COIN_IMG} style={styles.coinHeaderImg} />
                  <Text style={styles.coinProgressText}>
                    ربحت{" "}
                    <Text style={styles.coinSummaryStrong}>{coinsEarnedInRank}</Text>
                    {" "}من {coinsTotal} عملة
                  </Text>
                </View>
              ) : (
                <Text style={styles.coinMotivation}>
                  💪 ارفع مستواك لتفتح هذه الجوائز
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function LevelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  // Mirror the actual user level shown on the game screen header.
  const { user } = useApp();
  const currentLevel = user?.level ?? 0;
  // Coins earned so far across all levels vs. the total pool of level rewards.
  const earnedCoins = getMilestonesUpToLevel(currentLevel).length * COIN_PER_MILESTONE;
  const totalCoins = COIN_MILESTONES.length * COIN_PER_MILESTONE;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/game")}
        >
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الجوائز والمستويات</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          تقدّم في الكوفي واربح شعارًا حصريًا مع كل مستوى — كل ما ارتفعت زادت قيمتك في عالم Copointo
        </Text>

        {/* How coins are earned — explained clearly per completed level. */}
        <View style={styles.ruleCard}>
          <View style={styles.ruleTopRow}>
            <View style={styles.ruleCoinBubble}>
              <Image source={COIN_IMG} style={styles.ruleCoinImg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleHeadline}>
                كل مستويين تربح {COIN_PER_MILESTONE} عملة 🪙
              </Text>
              <Text style={styles.ruleSub}>
                كل ما تكمل مستوى كامل (من 0٪ إلى 100٪) تقترب من مكافأتك — وعند إكمال كل {COIN_MILESTONE_STEP} مستويات تُضاف لك {COIN_PER_MILESTONE} عملة تلقائياً
              </Text>
            </View>
          </View>
          <View style={styles.ruleStatsRow}>
            <View style={styles.ruleStat}>
              <Text style={styles.ruleStatValue}>{earnedCoins}</Text>
              <Text style={styles.ruleStatLabel}>عملات ربحتها</Text>
            </View>
            <View style={styles.ruleStatDivider} />
            <View style={styles.ruleStat}>
              <Text style={styles.ruleStatValue}>{COIN_PER_MILESTONE}</Text>
              <Text style={styles.ruleStatLabel}>عملة كل مستويين</Text>
            </View>
            <View style={styles.ruleStatDivider} />
            <View style={styles.ruleStat}>
              <Text style={styles.ruleStatValue}>{totalCoins}</Text>
              <Text style={styles.ruleStatLabel}>إجمالي الجوائز</Text>
            </View>
          </View>
        </View>

        {RANKS.map((r, i) => (
          <RankRow
            key={i}
            rank={r}
            index={i}
            isCurrent={currentLevel >= r.min && currentLevel <= r.max}
            isUnlocked={currentLevel >= r.min}
            currentLevel={currentLevel}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    transform: [{ scaleX: -1 }],
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },

  scroll: { padding: 18, paddingBottom: 60, gap: 12 },
  intro: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    marginBottom: 8, lineHeight: 20,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  rowCurrent: {
    borderColor: PRIMARY, borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  rowLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  emblemColumn: { alignItems: "center", gap: 6 },
  badgeWrap: {
    width: 78, height: 78, borderRadius: 39,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
    overflow: "hidden",
  },
  badgeImg: { width: 70, height: 70, resizeMode: "contain" },
  badgeIcon: { fontSize: 32 },
  shieldWrap: {
    width: 56, height: 56,
    alignItems: "center", justifyContent: "center",
  },
  shieldImg: { width: 56, height: 56, resizeMode: "contain" },
  lockOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" },
  tierLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  currentChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: PRIMARY,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
  currentChipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#000" },
  unlockedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(232,184,109,0.15)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 8,
  },
  unlockedChipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: PRIMARY },
  rankName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  rankRange: { fontSize: 11, fontFamily: "Inter_500Medium", color: PRIMARY },
  rewardLabel: {
    marginTop: 4,
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  prizeRow: {
    flexDirection: "row", gap: 10, marginTop: 8,
  },
  prizeMini: {
    alignItems: "center", gap: 2,
    backgroundColor: "rgba(232,184,109,0.06)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.20)",
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4,
  },
  prizeMiniImg: { width: 32, height: 32, resizeMode: "contain" },
  prizeMiniLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Coin-rule hero card
  ruleCard: {
    backgroundColor: "rgba(232,184,109,0.07)",
    borderWidth: 1, borderColor: "rgba(255,214,107,0.30)",
    borderRadius: 18, padding: 14, marginBottom: 6, gap: 12,
  },
  ruleTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  ruleCoinBubble: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,214,107,0.12)",
    borderWidth: 1, borderColor: "rgba(255,214,107,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  ruleCoinImg: { width: 34, height: 34, resizeMode: "contain" },
  ruleHeadline: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFD66B", marginBottom: 3, textAlign: "right" },
  ruleSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", lineHeight: 17, textAlign: "right" },
  ruleStatsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6,
  },
  ruleStat: { flex: 1, alignItems: "center", gap: 2 },
  ruleStatValue: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFD66B" },
  ruleStatLabel: { fontSize: 9, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)", textAlign: "center" },
  ruleStatDivider: { width: 1, height: 28, backgroundColor: "rgba(255,214,107,0.18)" },

  coinProgressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  coinProgressText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },

  // Coin milestones section
  coinSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,214,107,0.18)",
  },
  coinHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4,
  },
  coinHeaderImg: { width: 18, height: 18, resizeMode: "contain" },
  coinHeaderText: {
    flex: 1,
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFD66B",
  },
  coinSummary: {
    fontSize: 10, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)", marginBottom: 6,
  },
  coinSummaryStrong: { color: "#FFD66B", fontFamily: "Inter_700Bold" },
  coinChipsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  coinChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    borderWidth: 1,
  },
  coinChipPending: {
    backgroundColor: "rgba(255,214,107,0.06)",
    borderColor: "rgba(255,214,107,0.30)",
  },
  coinChipReached: {
    backgroundColor: "#FFD66B",
    borderColor: "#FFD66B",
  },
  coinChipImg: { width: 14, height: 14, resizeMode: "contain" },
  coinChipLevel: { fontSize: 9, fontFamily: "Inter_700Bold" },
  coinChipAmount: { fontSize: 10, fontFamily: "Inter_700Bold" },
  coinMotivation: {
    marginTop: 6,
    fontSize: 10, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)", textAlign: "right",
  },
});
