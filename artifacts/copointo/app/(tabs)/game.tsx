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
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { getRank } from "@/data/mockData";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const TOTAL_LEVELS = 1000;
const TILES_PER_ROW = 3;
const TOTAL_ROWS = Math.ceil(TOTAL_LEVELS / TILES_PER_ROW);
const ROW_HEIGHT = 100;
const TILE_SIZE = 76;
const TOP_PAD = 30;
const SIDE_PAD = 32;
const SPACING = (SCREEN_WIDTH - TILE_SIZE - 2 * SIDE_PAD) / (TILES_PER_ROW - 1);
const TOTAL_CONTENT_HEIGHT = TOP_PAD + TOTAL_ROWS * ROW_HEIGHT + 120;

const BG_COLOR = "#1C3B1E";
const TILE_DONE = "#5D4037";
const TILE_FUTURE = "#C8965A";
const TILE_BORDER_DONE = "#4A3027";
const TILE_BORDER_FUTURE = "#8B6330";

function getTilePos(lvl: number): { x: number; y: number } {
  const idx = lvl - 1;
  const groupIndex = Math.floor(idx / TILES_PER_ROW);
  const posInGroup = idx % TILES_PER_ROW;
  const isRTL = groupIndex % 2 === 1;
  const col = isRTL ? TILES_PER_ROW - 1 - posInGroup : posInGroup;
  const rowFromTop = TOTAL_ROWS - 1 - groupIndex;
  return {
    x: SIDE_PAD + col * SPACING,
    y: TOP_PAD + rowFromTop * ROW_HEIGHT,
  };
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const level = user?.level ?? 1;
  const rank = getRank(level);
  const ordersThisLevel = level % 7;
  const nextFreeLevel = ordersThisLevel === 0 ? 0 : 7 - ordersThisLevel;
  const overallProgress = Math.min((level / 1000) * 100, 100);

  const BEFORE = 15;
  const AFTER = 35;
  const startLvl = Math.max(1, level - BEFORE);
  const endLvl = Math.min(1000, level + AFTER);
  const visibleLevels = Array.from({ length: endLvl - startLvl + 1 }, (_, i) => startLvl + i);

  useEffect(() => {
    const pos = getTilePos(level);
    const scrollY = Math.max(0, pos.y - SCREEN_HEIGHT * 0.5 + TILE_SIZE / 2);
    setTimeout(() => scrollRef.current?.scrollTo({ y: scrollY, animated: false }), 200);
  }, [level]);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.rankInfo}>
          <Text style={styles.rankIcon}>{rank.icon}</Text>
          <View>
            <Text style={styles.rankName}>{rank.nameEn}</Text>
            <Text style={styles.levelLabel}>Level {level} / 1000</Text>
          </View>
        </View>
        <View style={[styles.coffeeChip, nextFreeLevel === 0 && { backgroundColor: "#C67C4E" }]}>
          <Text style={styles.coffeeChipText}>
            {nextFreeLevel === 0 ? "☕ Free!" : `☕ ${nextFreeLevel} left`}
          </Text>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressBarOuter}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${overallProgress}%` as any, backgroundColor: rank.color },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{level}/1000</Text>
      </View>

      {/* Game Board */}
      <ScrollView
        ref={scrollRef}
        style={styles.board}
        contentContainerStyle={{ height: TOTAL_CONTENT_HEIGHT }}
        showsVerticalScrollIndicator={false}
      >
        {visibleLevels.map((lvl) => {
          const pos = getTilePos(lvl);
          const isDone = lvl < level;
          const isCurrent = lvl === level;

          return (
            <View
              key={lvl}
              style={[
                styles.tile,
                {
                  left: pos.x,
                  top: pos.y,
                  backgroundColor: isCurrent ? rank.color : isDone ? TILE_DONE : TILE_FUTURE,
                  borderColor: isCurrent ? "#FFF" : isDone ? TILE_BORDER_DONE : TILE_BORDER_FUTURE,
                  borderWidth: isCurrent ? 3 : 2,
                  shadowOpacity: isCurrent ? 0.7 : 0.3,
                  shadowRadius: isCurrent ? 12 : 5,
                  elevation: isCurrent ? 10 : 3,
                },
              ]}
            >
              <View
                style={[
                  styles.tileInner,
                  {
                    borderColor: isCurrent
                      ? "rgba(255,255,255,0.3)"
                      : "rgba(0,0,0,0.15)",
                  },
                ]}
              >
                {isCurrent ? (
                  <View style={styles.currentContent}>
                    <Text style={styles.currentEmoji}>☕</Text>
                    <Text style={styles.currentNum}>{lvl}</Text>
                  </View>
                ) : isDone ? (
                  <Text style={styles.doneCheck}>✓</Text>
                ) : (
                  <Text style={styles.tileNum}>{lvl}</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Floating Leaderboard Button — bottom right */}
      <TouchableOpacity
        style={[
          styles.fabLeader,
          {
            bottom: (Platform.OS === "web" ? 90 : insets.bottom + 80),
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/leaderboard");
        }}
        activeOpacity={0.85}
      >
        <Feather name="users" size={22} color="#FFF" />
        <Text style={styles.fabLabel}>Leaderboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  rankInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rankIcon: {
    fontSize: 36,
  },
  rankName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  levelLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    marginTop: 1,
  },
  coffeeChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  coffeeChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 10,
  },
  progressBarOuter: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.75)",
    minWidth: 55,
    textAlign: "right",
  },
  board: {
    flex: 1,
  },
  tile: {
    position: "absolute",
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    alignItems: "center",
    justifyContent: "center",
  },
  tileInner: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tileNum: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#3E2003",
  },
  doneCheck: {
    fontSize: 26,
    color: "#FFCCAA",
    fontFamily: "Inter_700Bold",
  },
  currentContent: {
    alignItems: "center",
    gap: 1,
  },
  currentEmoji: {
    fontSize: 26,
  },
  currentNum: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
  fabLeader: {
    position: "absolute",
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#C67C4E",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textAlign: "center",
  },
});
