import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
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
import { useApp } from "@/context/AppContext";
import { RANKS, getRank } from "@/data/mockData";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Tier Colors (vibrant on dark bg) ─────────────────────────────────────
const TIER_COLORS = [
  "#E8B86D", // 1–100   Coffee Beginner   — golden sand
  "#4FC3F7", // 101–200 Coffee Enthusiast — sky blue
  "#81C784", // 201–300 Coffee Pro        — light green
  "#FFD54F", // 301–400 Coffee Expert     — amber
  "#CE93D8", // 401–500 Coffee Global     — lavender
  "#FF8A65", // 501–600 Coffee Fanatic    — orange
  "#EF5350", // 601–700 Coffee Veteran    — red
  "#BA68C8", // 701–800 Coffee Mayor      — purple
  "#F06292", // 801–900 Coffee King       — pink
  "#00E5FF", // 901–1000 Coffee Elite     — cyan
];

function getTierColor(level: number): string {
  return TIER_COLORS[Math.min(Math.floor((level - 1) / 100), 9)];
}

// ─── Tile sizes ────────────────────────────────────────────────────────────
const SZ_CURRENT = 90;
const SZ_FUTURE = 70;
const SZ_DONE = 55;

// Outer wrapper = tile rotated 45°, so visual bounding = size * √2
const outer = (sz: number) => Math.round(sz * Math.SQRT2);

// ─── Zigzag X offset per index ────────────────────────────────────────────
const ZIGZAG: number[] = [0, 65, -65, 35, -35, 0];

// ─── Background stars ─────────────────────────────────────────────────────
const STARS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: Math.round((i * 137.5) % SCREEN_WIDTH),
  y: Math.round((i * 97) % 900),
  char: i % 3 === 0 ? "✦" : "✧",
  size: i % 4 === 0 ? 18 : 13,
  opacity: 0.08 + (i % 4) * 0.04,
}));

const BG = "#0F0A2E";
const BEFORE = 5;
const AFTER = 45;

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const level = user?.level ?? 1;
  const rank = getRank(level);
  const tierColor = getTierColor(level);
  const ordersThisLevel = level % 7;
  const nextFreeLevel = ordersThisLevel === 0 ? 0 : 7 - ordersThisLevel;
  const overallProgress = Math.min((level / 1000) * 100, 100);

  const startLvl = Math.max(1, level - BEFORE);
  const endLvl = Math.min(1000, level + AFTER);
  const visibleLevels = Array.from(
    { length: endLvl - startLvl + 1 },
    (_, i) => endLvl - i          // render top-to-bottom = high → low (scroll down = past)
  );

  // Scroll so current level appears near top
  const currentIdx = visibleLevels.indexOf(level);
  useEffect(() => {
    if (currentIdx < 0 || !scrollRef.current) return;
    const approxY = currentIdx * (outer(SZ_CURRENT) + 8);
    setTimeout(() => scrollRef.current?.scrollTo({ y: approxY, animated: false }), 250);
  }, [level]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* ── Fixed star background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STARS.map((s) => (
          <Text
            key={s.id}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              fontSize: s.size,
              color: `rgba(255,255,255,${s.opacity})`,
            }}
          >
            {s.char}
          </Text>
        ))}
      </View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.levelProgress}>
          المستوى {level} / 999
        </Text>
        <TouchableOpacity
          style={[styles.rankChip, { borderColor: tierColor + "80" }]}
          activeOpacity={0.85}
        >
          <Text style={styles.rankChipIcon}>{rank.icon}</Text>
          <Text style={[styles.rankChipText, { color: tierColor }]}>{rank.name}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${overallProgress}%` as any, backgroundColor: tierColor },
            ]}
          />
        </View>
        <Text style={[styles.progressNote, { color: tierColor }]}>
          {nextFreeLevel === 0 ? "☕ Free!" : `☕ −${nextFreeLevel}`}
        </Text>
      </View>

      {/* ── Game board ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
      >
        {visibleLevels.map((lvl, idx) => {
          const isCurrent = lvl === level;
          const isDone = lvl < level;
          const sz = isCurrent ? SZ_CURRENT : isDone ? SZ_DONE : SZ_FUTURE;
          const outerSz = outer(sz);
          const tc = getTierColor(lvl);
          const xOff = isCurrent ? 0 : ZIGZAG[idx % ZIGZAG.length];

          // Tier-change milestone label (every 100 levels)
          const rankForLvl = RANKS.find((r) => r.min === lvl);

          return (
            <View key={lvl} style={{ alignItems: "center" }}>
              {/* Milestone badge at tier start */}
              {rankForLvl && (
                <View style={[styles.milestone, { borderColor: tc + "60", marginBottom: 6 }]}>
                  <Text style={[styles.milestoneText, { color: tc }]}>
                    {rankForLvl.icon}  {rankForLvl.name}
                  </Text>
                </View>
              )}

              {/* Diamond wrapper */}
              <View
                style={{
                  width: outerSz,
                  height: outerSz,
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ translateX: xOff }],
                  marginVertical: 4,
                }}
              >
                <View
                  style={[
                    styles.diamond,
                    {
                      width: sz,
                      height: sz,
                      backgroundColor: isCurrent
                        ? tc
                        : isDone
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.07)",
                      borderColor: isCurrent
                        ? "#FFFFFF"
                        : isDone
                        ? "rgba(255,255,255,0.12)"
                        : tc,
                      borderWidth: isCurrent ? 3 : 2,
                      shadowColor: isCurrent ? tc : "#000",
                      shadowOpacity: isCurrent ? 0.7 : 0.3,
                      shadowRadius: isCurrent ? 14 : 4,
                    },
                  ]}
                >
                  {/* Counter-rotate content so text stays upright */}
                  <View style={styles.diamondInner}>
                    {isCurrent ? (
                      <>
                        <Text style={styles.currentEmoji}>☕</Text>
                        <Text style={[styles.currentNum, { color: "#0F0A2E" }]}>{lvl}</Text>
                      </>
                    ) : isDone ? (
                      <Text style={styles.doneCheck}>✓</Text>
                    ) : (
                      <Text style={[styles.futureNum, { color: tc }]}>{lvl}</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: Platform.OS === "web" ? 130 : insets.bottom + 120 }} />
      </ScrollView>

      {/* ── Floating Leaderboard Button ── */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            bottom: Platform.OS === "web" ? 90 : insets.bottom + 80,
            backgroundColor: tierColor,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/leaderboard");
        }}
        activeOpacity={0.85}
      >
        <Feather name="users" size={22} color="#0F0A2E" />
        <Text style={styles.fabLabel}>Leaderboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  levelProgress: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FF8C42",
  },
  rankChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  rankChipIcon: {
    fontSize: 16,
  },
  rankChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressNote: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    minWidth: 64,
    textAlign: "right",
  },
  board: {
    flex: 1,
  },
  boardContent: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  milestone: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 16,
  },
  milestoneText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  diamond: {
    borderRadius: 14,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  diamondInner: {
    transform: [{ rotate: "-45deg" }],
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  currentEmoji: {
    fontSize: 28,
  },
  currentNum: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  doneCheck: {
    fontSize: 18,
    color: "rgba(255,255,255,0.25)",
    fontFamily: "Inter_700Bold",
  },
  futureNum: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#0F0A2E",
    textAlign: "center",
  },
});
