import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { getRank } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

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
const TILE_FUTURE = "#C8965A";
const TILE_DONE = "#5D4037";
const TILE_BORDER_FUTURE = "#8B6330";
const TILE_BORDER_DONE = "#4A3027";

type LeaderTab = "friends" | "city" | "oman" | "world";

const LEADERBOARD: Record<LeaderTab, { name: string; level: number; isMe?: boolean }[]> = {
  friends: [
    { name: "Mohammed Al-Habsi", level: 45 },
    { name: "Ahmed (You)", level: 42, isMe: true },
    { name: "Khalid Mansoor", level: 38 },
    { name: "Sara Al-Zahra", level: 31 },
  ],
  city: [
    { name: "Muscat Champion", level: 892 },
    { name: "City King", level: 743 },
    { name: "Coffee Lover", level: 621 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
  oman: [
    { name: "Oman #1", level: 980 },
    { name: "Coffee Master", level: 901 },
    { name: "Top Tier", level: 867 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
  world: [
    { name: "World Champion", level: 999 },
    { name: "Global Hero", level: 998 },
    { name: "Legend Player", level: 995 },
    { name: "Ahmed (You)", level: 42, isMe: true },
  ],
};

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderTab, setLeaderTab] = useState<LeaderTab>("friends");

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
        <View style={styles.headerActions}>
          <View style={[styles.coffeeChip, nextFreeLevel === 0 && { backgroundColor: "#C67C4E" }]}>
            <Text style={styles.coffeeChipText}>
              {nextFreeLevel === 0 ? "☕ Free!" : `☕ ${nextFreeLevel} left`}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.leaderBtn, { backgroundColor: rank.color }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowLeaderboard(true);
            }}
            activeOpacity={0.85}
          >
            <Feather name="users" size={15} color="#FFF" />
            <Text style={styles.leaderBtnText}>Leaderboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Overall progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressBarOuter}>
          <View style={[styles.progressBarFill, { width: `${overallProgress}%` as any, backgroundColor: rank.color }]} />
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
              {/* Inner inset shadow effect */}
              <View style={[styles.tileInner, { borderColor: isCurrent ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.15)" }]}>
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

      {/* Leaderboard Modal */}
      <Modal visible={showLeaderboard} animationType="slide" transparent statusBarTranslucent>
        <View style={styles.modalWrap}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowLeaderboard(false)}
            activeOpacity={1}
          />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>🏆 Leaderboard</Text>

            {/* Tabs */}
            <View style={styles.tabsRow}>
              {(["friends", "city", "oman", "world"] as LeaderTab[]).map((tab) => {
                const labels: Record<LeaderTab, string> = {
                  friends: "👥 Friends",
                  city: "🏙️ City",
                  oman: "🇴🇲 Oman",
                  world: "🌍 World",
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tabBtn, leaderTab === tab && { backgroundColor: "#FFF", shadowOpacity: 0.12 }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setLeaderTab(tab);
                    }}
                  >
                    <Text style={[styles.tabBtnText, leaderTab === tab && { color: "#C67C4E" }]}>
                      {labels[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Entries */}
            <View style={styles.entriesList}>
              {LEADERBOARD[leaderTab].map((entry, i) => (
                <View
                  key={i}
                  style={[
                    styles.entryRow,
                    entry.isMe && { backgroundColor: "#FFF3EA", borderColor: "#C67C4E" },
                  ]}
                >
                  <Text style={[
                    styles.entryRank,
                    { color: i === 0 ? "#FFD700" : i === 1 ? "#A0A0A0" : i === 2 ? "#CD7F32" : "#999" },
                  ]}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </Text>
                  <View style={styles.entryAvatarCircle}>
                    <Text style={{ fontSize: 18 }}>👤</Text>
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, entry.isMe && { color: "#C67C4E" }]}>
                      {entry.name}
                    </Text>
                    <Text style={styles.entryLevel}>
                      Level {entry.level} · {getRank(entry.level).nameEn}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>{getRank(entry.level).icon}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coffeeChip: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  coffeeChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  leaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  leaderBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
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
  // Modal
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  modalSheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDD",
    alignSelf: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1C",
    textAlign: "center",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#F3F3F3",
    borderRadius: 16,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 0,
  },
  tabBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#999",
  },
  entriesList: {
    gap: 10,
  },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EEE",
    backgroundColor: "#FAFAFA",
  },
  entryRank: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    width: 30,
    textAlign: "center",
  },
  entryAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#1C1C1C",
    marginBottom: 2,
  },
  entryLevel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#888",
  },
});
