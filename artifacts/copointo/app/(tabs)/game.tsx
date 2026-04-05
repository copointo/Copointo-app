import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Tier colors per 100 levels ───────────────────────────────────────────
const TIER_COLORS = [
  "#E8B86D", // 0–99    Coffee Beginner   — golden sand
  "#4FC3F7", // 100–199 Coffee Enthusiast — sky blue
  "#81C784", // 200–299 Coffee Pro        — light green
  "#FFD54F", // 300–399 Coffee Expert     — amber
  "#CE93D8", // 400–499 Coffee Global     — lavender
  "#FF8A65", // 500–599 Coffee Fanatic    — orange
  "#EF5350", // 600–699 Coffee Veteran    — red
  "#BA68C8", // 700–799 Coffee Mayor      — purple
  "#F06292", // 800–899 Coffee King       — pink
  "#00E5FF", // 900–1000 Coffee Elite     — cyan
];

function getTierColor(lvl: number): string {
  return TIER_COLORS[Math.min(Math.floor(lvl / 100), 9)];
}

// ─── Tile sizes ────────────────────────────────────────────────────────────
const SZ_CURRENT = 92;
const SZ_OTHER   = 68;
const SZ_DONE    = 52;

const outerSz = (s: number) => Math.ceil(s * Math.SQRT2);

// ─── 3-position snake (keyed on level number for consistency) ─────────────
const POSITIONS = [-85, 0, 85];


// ─── Background coffee beans ───────────────────────────────────────────────
const BEANS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x:   Math.round((i * 173.1) % SCREEN_WIDTH),
  y:   Math.round((i * 131)   % 1100),
  rot: (i * 47) % 360,
  sz:  i % 4 === 0 ? 54 : i % 4 === 1 ? 40 : i % 4 === 2 ? 66 : 48,
  op:  0.09 + (i % 5) * 0.04,
}));

const BG     = "#2C1400";
const BEFORE = 12;
const AFTER  = 48;

export default function GameScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { user }  = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [showGoBack, setShowGoBack] = useState(false);

  const level     = user?.level ?? 0;
  const rank      = getRank(level);
  const tierColor = getTierColor(level);
  const ordersThisLevel = level % 7;
  const nextFreeLevel   = ordersThisLevel === 0 ? 0 : 7 - ordersThisLevel;
  const overallProgress = Math.min((level / 1000) * 100, 100);

  // Visible window around current level
  const startLvl = Math.max(0,    level - BEFORE);
  const endLvl   = Math.min(1000, level + AFTER);

  // Descending: highest at top, lowest (current) at bottom
  const visibleLevels = Array.from(
    { length: endLvl - startLvl + 1 },
    (_, i) => endLvl - i
  );

  // Row height = outer tile size + connector gap
  const ROW_H = outerSz(SZ_OTHER) + 14 + 2; // tile outer size + margins

  // Y-position of current level in scroll
  const currentIdxInList = endLvl - level;
  const currentTileY     = currentIdxInList * ROW_H;

  // Scroll to current level on mount
  useEffect(() => {
    const target = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.45);
    setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 250);
  }, [level]);

  // Show/hide "go to current" button when scrolling away
  const handleScroll = useCallback(
    (e: any) => {
      const y       = e.nativeEvent.contentOffset.y;
      const targetY = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.45);
      setShowGoBack(Math.abs(y - targetY) > 160);
    },
    [currentTileY]
  );

  const goToCurrent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.45);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── Coffee bean background ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {BEANS.map((b) => (
          <Text key={b.id} style={{
            position: "absolute", left: b.x, top: b.y,
            fontSize: b.sz, opacity: b.op,
            transform: [{ rotate: `${b.rot}deg` }],
          }}>
            🫘
          </Text>
        ))}
      </View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerLevel}>المستوى {level} / 999</Text>
        <View style={[styles.rankChip, { borderColor: tierColor + "80" }]}>
          <Text style={styles.rankChipIcon}>{rank.icon}</Text>
          <Text style={[styles.rankChipText, { color: tierColor }]}>{rank.name}</Text>
        </View>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {
            width: `${overallProgress}%` as any,
            backgroundColor: tierColor,
          }]} />
        </View>
        <Text style={[styles.progressNote, { color: tierColor }]}>
          {nextFreeLevel === 0 ? "☕ Free!" : `☕ −${nextFreeLevel}`}
        </Text>
      </View>

      {/* ── Game Board ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={40}
      >
        <View style={{ height: 16 }} />

        {visibleLevels.map((lvl, listIdx) => {
          const isCurrent   = lvl === level;
          const isDone      = lvl < level;
          const isFreeCoffee = lvl > 0 && lvl % 7 === 0;
          const sz          = isCurrent ? SZ_CURRENT : isDone ? SZ_DONE : SZ_OTHER;
          const osZ         = outerSz(sz);
          const tc          = getTierColor(lvl);
          const xOff        = POSITIONS[lvl % 3];
          const rankForLvl  = RANKS.find((r) => r.min === lvl);


          return (
            <View key={lvl} style={{ alignItems: "center" }}>

              {/* ── Tier milestone badge ── */}
              {rankForLvl && lvl > 0 && (
                <View style={[styles.milestone, { borderColor: tc + "55" }]}>
                  <Text style={[styles.milestoneText, { color: tc }]}>
                    {rankForLvl.icon}  {rankForLvl.name}
                  </Text>
                </View>
              )}

              {/* ── Diamond tile ── */}
              <View style={{
                width: osZ, height: osZ,
                alignItems: "center", justifyContent: "center",
                transform: [{ translateX: xOff }],
                marginVertical: 6,
                opacity: isCurrent ? 1 : isDone ? 0.85 : 0.3,
              }}>
                <View style={[styles.diamond, {
                  width: sz, height: sz,
                  backgroundColor: isCurrent
                    ? tc
                    : isFreeCoffee && isDone
                    ? "rgba(232,184,109,0.18)"
                    : isFreeCoffee
                    ? "rgba(232,184,109,0.10)"
                    : isDone
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(255,255,255,0.07)",
                  borderColor: isCurrent
                    ? "#FFFFFF"
                    : isFreeCoffee
                    ? "#E8B86D"
                    : isDone
                    ? "rgba(255,255,255,0.10)"
                    : tc,
                  borderWidth: isCurrent ? 3 : isFreeCoffee ? 2.5 : 2,
                  shadowColor:   isCurrent ? tc : isFreeCoffee ? "#E8B86D" : "#000",
                  shadowOpacity: isCurrent ? 0.75 : isFreeCoffee ? 0.5 : 0.2,
                  shadowRadius:  isCurrent ? 16 : isFreeCoffee ? 10 : 4,
                }]}>
                  <View style={styles.diamondInner}>

                    {/* Current level: always ☕ + number */}
                    {isCurrent ? (
                      <>
                        <Text style={styles.curEmoji}>☕</Text>
                        <Text style={[styles.curNum, { color: "#1A0800" }]}>{lvl}</Text>
                      </>

                    /* Past free-coffee level */
                    ) : isDone && isFreeCoffee ? (
                      <>
                        <Text style={{ fontSize: 16 }}>☕</Text>
                        <Text style={[styles.doneCheck, { color: "#E8B86D88" }]}>✓</Text>
                      </>

                    /* Past regular level */
                    ) : isDone ? (
                      <Text style={styles.doneCheck}>✓</Text>

                    /* Future free-coffee level */
                    ) : isFreeCoffee ? (
                      <Text style={{ fontSize: sz === SZ_CURRENT ? 28 : 22 }}>☕</Text>

                    /* Future regular level */
                    ) : (
                      <Text style={[styles.futureNum, { color: tc }]}>{lvl}</Text>
                    )}

                  </View>
                </View>
              </View>

              {/* ── Free-coffee hint label (future multiples of 7 only) ── */}
              {isFreeCoffee && !isDone && !isCurrent && (
                <View style={[styles.freeHint, { transform: [{ translateX: xOff > 0 ? -30 : xOff < 0 ? 30 : 0 }] }]}>
                  <Text style={styles.freeHintText}>{"▲ ☕ اصل لهذا المستوى للحصول على مشروب مجاني"}</Text>
                </View>
              )}

            </View>
          );
        })}

        <View style={{ height: Platform.OS === "web" ? 130 : insets.bottom + 120 }} />
      </ScrollView>

      {/* ── "Go to my level" button ── */}
      {showGoBack && (
        <TouchableOpacity
          style={[styles.goBackBtn, {
            backgroundColor: tierColor,
            left: 20,
            bottom: Platform.OS === "web" ? 100 : insets.bottom + 90,
          }]}
          onPress={goToCurrent}
          activeOpacity={0.85}
        >
          <Feather name="crosshair" size={16} color="#1A0800" />
          <Text style={styles.goBackText}>مستواي</Text>
        </TouchableOpacity>
      )}

      {/* ── Floating action buttons ── */}
      <View style={[styles.fabGroup, {
        bottom: Platform.OS === "web" ? 90 : insets.bottom + 80,
      }]}>

        {/* Notifications */}
        <TouchableOpacity
          style={[styles.fabSmall, { backgroundColor: "rgba(255,255,255,0.10)", borderColor: tierColor + "60" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications"); }}
          activeOpacity={0.85}
        >
          <Feather name="bell" size={20} color={tierColor} />
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </TouchableOpacity>

        {/* Add Friends */}
        <TouchableOpacity
          style={[styles.fabSmall, { backgroundColor: "rgba(255,255,255,0.10)", borderColor: tierColor + "60" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-friend"); }}
          activeOpacity={0.85}
        >
          <Feather name="user-plus" size={20} color={tierColor} />
        </TouchableOpacity>

        {/* Leaderboard */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: tierColor }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/leaderboard"); }}
          activeOpacity={0.85}
        >
          <Feather name="users" size={22} color="#1A0800" />
          <Text style={styles.fabLabel}>Leaderboard</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerLevel: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FF8C42" },
  rankChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  rankChipIcon: { fontSize: 16 },
  rankChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  progressRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 12, paddingBottom: 12,
  },
  progressTrack: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },
  progressNote: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 64, textAlign: "right" },
  board: { flex: 1 },
  boardContent: { alignItems: "center", paddingHorizontal: 20 },
  milestone: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 18, marginBottom: 4,
  },
  milestoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  diamond: {
    borderRadius: 14,
    transform: [{ rotate: "45deg" }],
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  diamondInner: {
    transform: [{ rotate: "-45deg" }],
    alignItems: "center", justifyContent: "center", gap: 2,
  },
  curEmoji:  { fontSize: 28 },
  curNum:    { fontSize: 12, fontFamily: "Inter_700Bold" },
  doneCheck: { fontSize: 16, color: "rgba(255,255,255,0.22)", fontFamily: "Inter_700Bold" },
  futureNum: { fontSize: 18, fontFamily: "Inter_700Bold" },
  goBackBtn: {
    position: "absolute", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  goBackText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#1A0800" },
  fabGroup: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    gap: 10,
  },
  fabSmall: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF5350",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  fab: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: "center", justifyContent: "center", gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
  fabLabel: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#1A0800", textAlign: "center" },
  freeHint: {
    marginTop: 5,
    marginBottom: 4,
    backgroundColor: "rgba(232,184,109,0.13)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.35)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 215,
    alignItems: "center",
  },
  freeHintText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#E8B86D",
    textAlign: "center",
  },
});
