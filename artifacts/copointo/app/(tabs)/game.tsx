import { Feather, FontAwesome5 } from "@expo/vector-icons";
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

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const PRIMARY_DIM = "rgba(232,184,109,0.30)";
const PRIMARY_FAINT = "rgba(232,184,109,0.12)";
const PURPLE  = "#7B5CFF";

const SZ_CURRENT = 110;
const SZ_OTHER   = 78;
const SZ_DONE    = 60;

const outerSz = (s: number) => Math.ceil(s * Math.SQRT2);

const POSITIONS = [-90, 0, 90];

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
  const ordersThisLevel = level % 7;
  const nextFreeLevel   = ordersThisLevel === 0 ? 0 : 7 - ordersThisLevel;
  const overallProgress = Math.min((level / 999) * 100, 100);

  const startLvl = Math.max(0,    level - BEFORE);
  const endLvl   = Math.min(999, level + AFTER);

  const visibleLevels = Array.from(
    { length: endLvl - startLvl + 1 },
    (_, i) => endLvl - i
  );

  const ROW_H = outerSz(SZ_OTHER) + 14 + 2;

  const currentIdxInList = endLvl - level;
  const currentTileY     = currentIdxInList * ROW_H;

  useEffect(() => {
    const target = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.55);
    setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 250);
  }, [level]);

  const handleScroll = useCallback(
    (e: any) => {
      const y       = e.nativeEvent.contentOffset.y;
      const targetY = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.55);
      setShowGoBack(Math.abs(y - targetY) > 160);
    },
    [currentTileY]
  );

  const goToCurrent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = Math.max(0, currentTileY - SCREEN_HEIGHT * 0.55);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerLevel}>
          <Text style={styles.headerLevelNum}>{level}</Text>
          <Text style={styles.headerLevelSlash}> / 999 </Text>
          <Text style={styles.headerLevelLabel}>المستوى</Text>
        </Text>
        <View style={styles.rankChip}>
          <Text style={styles.rankChipIcon}>{rank.icon}</Text>
          <Text style={styles.rankChipText}>{rank.name}</Text>
        </View>
      </View>

      {/* ── Progress bar + Free indicator ── */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${overallProgress}%` as any }]} />
          <View style={[styles.progressGlow, { width: `${overallProgress}%` as any }]} />
        </View>
        <Text style={styles.progressNote}>
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

        {visibleLevels.map((lvl) => {
          const isCurrent    = lvl === level;
          const isDone       = lvl < level;
          const isFreeCoffee = lvl > 0 && lvl % 7 === 0;
          const sz           = isCurrent ? SZ_CURRENT : isDone ? SZ_DONE : SZ_OTHER;
          const osZ          = outerSz(sz);
          const xOff         = POSITIONS[lvl % 3];
          const rankForLvl   = RANKS.find((r) => r.min === lvl);

          return (
            <View key={lvl} style={{ alignItems: "center" }}>

              {/* ── Tier milestone label ── */}
              {rankForLvl && lvl > 0 && (
                <View style={styles.milestone}>
                  <Text style={styles.milestoneText}>{rankForLvl.icon}  {rankForLvl.name}</Text>
                </View>
              )}

              {/* ── Dotted connector above (diagonal, follows snake from upper tile to this tile) ── */}
              {lvl < endLvl && (() => {
                const xAbove = POSITIONS[(lvl + 1) % 3];
                const xBelow = xOff;
                const N = 5;
                return (
                  <View style={styles.dottedConnector}>
                    {Array.from({ length: N }).map((_, i) => {
                      const t = (i + 1) / (N + 1);
                      const x = xAbove + (xBelow - xAbove) * t;
                      return (
                        <View
                          key={i}
                          style={[styles.dot, { transform: [{ translateX: x }] }]}
                        />
                      );
                    })}
                  </View>
                );
              })()}

              {/* ── Diamond tile ── */}
              <View style={{
                width: osZ, height: osZ,
                alignItems: "center", justifyContent: "center",
                transform: [{ translateX: xOff }],
                marginVertical: 6,
              }}>
                {/* Glow halo behind current tile */}
                {isCurrent && (
                  <View style={[styles.currentHalo, { width: osZ + 60, height: osZ + 60 }]} />
                )}

                <View style={[
                  styles.diamond,
                  {
                    width: sz, height: sz,
                    borderColor: PRIMARY,
                    borderWidth: isCurrent ? 2.5 : 1.5,
                    shadowColor: PRIMARY,
                    shadowOpacity: isCurrent ? 0.95 : isDone ? 0.35 : 0.55,
                    shadowRadius:  isCurrent ? 22 : isDone ? 6 : 12,
                  }
                ]}>
                  <View style={styles.diamondInner}>
                    {isCurrent ? (
                      <>
                        <Text style={[styles.curEmoji, { fontSize: sz * 0.34 }]}>☕</Text>
                        <Text style={[styles.curNum, { fontSize: sz * 0.16 }]}>{lvl}</Text>
                      </>
                    ) : isDone ? (
                      <Text style={styles.doneCheck}>✓</Text>
                    ) : (
                      <>
                        <Text style={[styles.futureNum, { fontSize: sz * 0.32 }]}>{lvl}</Text>
                        <FontAwesome5 name="lock" size={sz * 0.16} color={PRIMARY} style={{ marginTop: 2 }} />
                      </>
                    )}
                  </View>
                </View>
              </View>

              {/* ── Free-coffee hint label (future multiples of 7) ── */}
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
            left: 20,
            bottom: Platform.OS === "web" ? 100 : insets.bottom + 90,
          }]}
          onPress={goToCurrent}
          activeOpacity={0.85}
        >
          <Feather name="crosshair" size={16} color="#000" />
          <Text style={styles.goBackText}>مستواي</Text>
        </TouchableOpacity>
      )}

      {/* ── Floating action buttons ── */}
      <View style={[styles.fabGroup, {
        bottom: Platform.OS === "web" ? 90 : insets.bottom + 80,
      }]}>

        {/* Notifications */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications"); }}
          activeOpacity={0.85}
        >
          <Feather name="bell" size={22} color={PRIMARY} />
          <View style={styles.badge}><Text style={styles.badgeText}>3</Text></View>
        </TouchableOpacity>

        {/* Add Friends */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-friend"); }}
          activeOpacity={0.85}
        >
          <Feather name="user-plus" size={22} color={PRIMARY} />
        </TouchableOpacity>

        {/* Leaderboard - purple distinctive */}
        <TouchableOpacity
          style={styles.fabLeaderboard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/leaderboard"); }}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="trophy" size={26} color="#FFF" />
          <Text style={styles.fabLeaderboardLabel}>Leaderboard</Text>
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
  headerLevel: { color: PRIMARY },
  headerLevelNum: { fontSize: 26, fontFamily: "Inter_700Bold", color: PRIMARY },
  headerLevelSlash: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  headerLevelLabel: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  rankChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 22, borderWidth: 1.5, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.06)",
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  rankChipIcon: { fontSize: 16 },
  rankChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  progressRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, gap: 12, paddingBottom: 14,
  },
  progressTrack: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: "rgba(232,184,109,0.10)", overflow: "visible",
  },
  progressFill: {
    height: "100%", borderRadius: 2,
    backgroundColor: PRIMARY,
  },
  progressGlow: {
    position: "absolute", left: 0, top: -2, height: 8, borderRadius: 4,
    backgroundColor: "transparent",
    shadowColor: PRIMARY, shadowOpacity: 1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  progressNote: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF",
    minWidth: 64, textAlign: "right",
  },
  board: { flex: 1 },
  boardContent: { alignItems: "center", paddingHorizontal: 20 },
  milestone: {
    borderWidth: 1, borderColor: PRIMARY_DIM, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: "rgba(232,184,109,0.06)",
    marginTop: 18, marginBottom: 4,
  },
  milestoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  dottedConnector: {
    height: 18,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  dot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: PRIMARY,
    opacity: 0.65,
  },
  diamond: {
    borderRadius: 14,
    backgroundColor: "#0A0606",
    transform: [{ rotate: "45deg" }],
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 0 }, elevation: 8,
  },
  currentHalo: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.18)",
    shadowColor: PRIMARY,
    shadowOpacity: 0.9,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  diamondInner: {
    transform: [{ rotate: "-45deg" }],
    alignItems: "center", justifyContent: "center", gap: 1,
  },
  curEmoji:  {},
  curNum:    { fontFamily: "Inter_700Bold", color: "#FFF" },
  doneCheck: { fontSize: 22, color: "rgba(232,184,109,0.55)", fontFamily: "Inter_700Bold" },
  futureNum: { fontFamily: "Inter_700Bold", color: "#FFF" },
  goBackBtn: {
    position: "absolute", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 8,
  },
  goBackText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },
  fabGroup: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    gap: 12,
  },
  fabSmall: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  badge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#EF5350",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: BG,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  fabLeaderboard: {
    width: 88, height: 88, borderRadius: 22,
    alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: PURPLE,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 16, elevation: 10,
  },
  fabLeaderboardLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "center",
  },
  freeHint: {
    marginTop: 5, marginBottom: 4,
    backgroundColor: PRIMARY_FAINT,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: 215, alignItems: "center",
  },
  freeHintText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: PRIMARY, textAlign: "center",
  },
});
