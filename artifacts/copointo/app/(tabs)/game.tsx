import { Feather, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCoins } from "@/hooks/useCoins";

const COPOINTO_COIN = require("../../assets/images/copointo-coin.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, DAILY_LEVEL_CAP } from "@/context/AppContext";
import { useCommunities } from "@/context/CommunityContext";
import { useResponsive } from "@/hooks/useResponsive";
import { RANKS, getRank } from "@/data/mockData";
import { apiFetch } from "@/constants/api";
import { playLevelUpSound, playNotificationChime } from "@/lib/notification-sound";
import { useRankOvertakeNotifier } from "@/lib/use-rank-overtake";

interface GameStatus {
  gameBanned: boolean;
  gameSuspended: boolean;
  gameSuspendedUntil?: string | null;
  gameSuspendReason?: string | null;
  gameSuspendedAt?: string | null;
}

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
  const { user, activeGameCafeId, setActiveGameCafeId, incomingRequests }  = useApp();
  const { incomingInvites, refresh: refreshCommunities } = useCommunities();
  const r = useResponsive();
  const { toast: overtakeToast, dismiss: dismissOvertake } = useRankOvertakeNotifier();

  // Per-café progress: pick the currently-viewed café, or first available.
  const cafeProgress = user?.cafeProgress ?? {};
  const cafeIds = Object.keys(cafeProgress);
  const effectiveCafeId =
    (activeGameCafeId && cafeProgress[activeGameCafeId]) ? activeGameCafeId
    : (cafeIds[0] ?? null);
  const activeCafe = effectiveCafeId ? cafeProgress[effectiveCafeId] : null;
  const { balance: coinBalance } = useCoins();

  // Auto-heal stale activeGameCafeId (e.g. after data wipe).
  useEffect(() => {
    if (activeGameCafeId && !cafeProgress[activeGameCafeId] && cafeIds.length === 0) {
      setActiveGameCafeId(null);
    }
  }, [activeGameCafeId, cafeIds.length]);

  // Re-read invite badge whenever the Game tab gains focus
  useFocusEffect(
    useCallback(() => {
      refreshCommunities();
    }, [refreshCommunities]),
  );
  const scrollRef = useRef<ScrollView>(null);
  const [showGoBack, setShowGoBack] = useState(false);
  const [status, setStatus] = useState<GameStatus | null>(null);

  // Poll game-suspension status from server (keyed by phone).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const phone = user?.phone;
      if (!phone) { setStatus(null); return; }
      apiFetch<GameStatus>(`/user-status?phone=${encodeURIComponent(phone)}`)
        .then(s => { if (!cancelled) setStatus(s); })
        .catch(() => { /* network errors → leave game accessible */ });
      return () => { cancelled = true; };
    }, [user?.phone]),
  );

  const isBlocked = !!(status && (status.gameBanned || status.gameSuspended));

  const level     = activeCafe?.level ?? 0;
  const rank      = getRank(level);
  const ordersThisLevel = level % 7;
  const nextFreeLevel   = ordersThisLevel === 0 ? 0 : 7 - ordersThisLevel;
  const overallProgress = Math.min((level / 999) * 100, 100);

  // ── Daily level cap progress (resets each calendar day) ──
  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  const levelsTodayUsed = (user?.levelsTodayDate === todayStr) ? (user?.levelsToday ?? 0) : 0;
  const dailyCapReached = levelsTodayUsed >= DAILY_LEVEL_CAP;

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

  // ── Sound: play a triumphant chime whenever the user levels up ──
  const prevLevelRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevLevelRef.current !== null && level > prevLevelRef.current) {
      playLevelUpSound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevLevelRef.current = level;
  }, [level]);

  // ── Sound: play a soft chime when a new in-game notification arrives
  // (incoming friend request OR community invite). Skips the very first
  // mount so existing pending items don't trigger on screen open.
  const prevNotifCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = incomingRequests.length + incomingInvites.length;
    if (prevNotifCountRef.current !== null && count > prevNotifCountRef.current) {
      playNotificationChime();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    prevNotifCountRef.current = count;
  }, [incomingRequests.length, incomingInvites.length]);

  // ── Unread Copointo broadcasts (system messages from super-admin) ──
  // Polls the public broadcasts endpoint and counts ones newer than the
  // last-seen timestamp stored when the user last opened /notifications.
  const [unreadBroadcasts, setUnreadBroadcasts] = useState(0);
  // ── Unread free coffees (newly-earned, not yet seen on /notifications) ──
  const [unreadFreeCoffees, setUnreadFreeCoffees] = useState(0);

  const refreshBadges = useCallback(async () => {
    try {
      const r = await apiFetch<{ broadcasts: { id: string; createdAt: string }[] }>("/broadcasts");
      const lastSeen = (await AsyncStorage.getItem("copointo_broadcast_last_seen_v1")) ?? "";
      setUnreadBroadcasts((r.broadcasts ?? []).filter(b => b.createdAt > lastSeen).length);
    } catch { /* ignore */ }
    const phone = user?.phone?.trim();
    if (!phone) { setUnreadFreeCoffees(0); return; }
    try {
      const fc = await apiFetch<{ coffees: { earnedAt: string; redeemedAt: string | null }[] }>(
        `/free-coffees?phone=${encodeURIComponent(phone)}`,
      );
      const lastSeenFc = (await AsyncStorage.getItem("copointo_free_coffee_last_seen_v1")) ?? "";
      setUnreadFreeCoffees(
        (fc.coffees ?? []).filter(c => !c.redeemedAt && c.earnedAt > lastSeenFc).length,
      );
    } catch { /* ignore */ }
  }, [user?.phone]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => { if (!cancelled) await refreshBadges(); };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [refreshBadges]);

  // Refresh on focus so the badge clears immediately after returning from
  // /notifications (which writes the new last-seen timestamps).
  useFocusEffect(
    useCallback(() => { refreshBadges(); }, [refreshBadges])
  );

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

  // ── Suspension/Ban screen (replaces game UI; other tabs keep working) ──
  if (isBlocked && status) {
    const isPerm = status.gameBanned;
    const untilTxt = status.gameSuspendedUntil
      ? new Date(status.gameSuspendedUntil).toLocaleDateString("ar-OM", {
          year: "numeric", month: "long", day: "numeric",
        })
      : "";
    const daysLeft = status.gameSuspendedUntil
      ? Math.max(0, Math.ceil(
          (new Date(status.gameSuspendedUntil).getTime() - Date.now()) / 86400000,
        ))
      : 0;
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
       <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.blockedScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.blockedIconWrap}>
            <Text style={styles.blockedIcon}>{isPerm ? "🚫" : "⏳"}</Text>
          </View>
          <Text style={styles.blockedTitle}>
            {isPerm ? "تم حظرك من اللعبة نهائياً" : "تم إيقاف اللعبة معك مؤقتاً"}
          </Text>
          <Text style={styles.blockedSubtitle}>
            {isPerm
              ? "لن يظهر تصنيفك في اللعبة ولن تتمكن من الوصول لشاشة التقدم."
              : `سيُرفع الإيقاف بعد ${daysLeft} يوم${daysLeft === 1 ? "" : ""} (${untilTxt}).`}
          </Text>

          {!!status.gameSuspendReason && (
            <View style={styles.reasonCard}>
              <Text style={styles.reasonLabel}>سبب الإجراء</Text>
              <Text style={styles.reasonText}>{status.gameSuspendReason}</Text>
            </View>
          )}

          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>✓ ما الذي لا يزال يعمل؟</Text>
            <Text style={styles.noticeItem}>• الطلب من الكافيهات</Text>
            <Text style={styles.noticeItem}>• حجز الطاولات</Text>
            <Text style={styles.noticeItem}>• تجميع النقاط للحصول على مشروب مجاني ☕</Text>
            <Text style={styles.noticeItem}>• تصفّح المطاعم والفيديوهات</Text>
          </View>

          <Text style={styles.blockedHelp}>
            للاستفسار، تواصل مع إدارة Copointo.
          </Text>
        </ScrollView>
       </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
     <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>

      {/* ── Notifications bell (top-left) ── */}
      <TouchableOpacity
        style={[styles.bellTopLeft, { top: topPad + 8 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications"); }}
        activeOpacity={0.85}
      >
        <Feather name="bell" size={20} color={PRIMARY} />
        {(incomingRequests.length + unreadBroadcasts + unreadFreeCoffees) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{incomingRequests.length + unreadBroadcasts + unreadFreeCoffees}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Add friend (top-right) ── */}
      <TouchableOpacity
        style={[styles.addFriendTopRight, { top: topPad + 8 }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-friend"); }}
        activeOpacity={0.85}
      >
        <Feather name="user-plus" size={20} color={PRIMARY} />
      </TouchableOpacity>

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

      {/* ── Active café indicator ── */}
      {activeCafe ? (
        <TouchableOpacity
          style={styles.cafePill}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/my-cafes"); }}
          activeOpacity={0.85}
        >
          <Feather name="coffee" size={14} color={PRIMARY} />
          <Text style={styles.cafePillText} numberOfLines={1}>{activeCafe.cafeName}</Text>
          <Feather name="chevron-down" size={14} color={PRIMARY} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.coinsPill}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/buy-coins"); }}
          activeOpacity={0.85}
        >
          <Image source={COPOINTO_COIN} style={styles.coinsPillImg} />
          <Text style={styles.coinsPillText}>{coinBalance.toLocaleString("en-US")}</Text>
          <Text style={styles.coinsPillLabel}>عملة Copointo</Text>
          <Feather name="plus-circle" size={14} color={PRIMARY} />
        </TouchableOpacity>
      )}

      {/* ── Daily level cap indicator ── */}
      <View style={[
        styles.dailyCapPill,
        dailyCapReached && styles.dailyCapPillFull,
      ]}>
        <Feather
          name={dailyCapReached ? "lock" : "zap"}
          size={12}
          color={dailyCapReached ? "#EF5350" : PRIMARY}
        />
        <Text style={[
          styles.dailyCapText,
          dailyCapReached && { color: "#EF5350" },
        ]}>
          {dailyCapReached
            ? `وصلت لحد اليوم (${DAILY_LEVEL_CAP}/${DAILY_LEVEL_CAP}) — يتجدّد غدًا`
            : `تقدم اليوم: ${levelsTodayUsed}/${DAILY_LEVEL_CAP} مستويات`}
        </Text>
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

      {/* ── Rank-overtake toast ── */}
      {overtakeToast && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { dismissOvertake(); router.push("/leaderboard"); }}
          style={[styles.overtakeToast, {
            top: Platform.OS === "web" ? 80 : insets.top + 12,
          }]}
        >
          <Text style={styles.overtakeIcon}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.overtakeTitle}>تجاوزك في التصنيف!</Text>
            <Text style={styles.overtakeSub} numberOfLines={1}>
              {overtakeToast.name} وصل إلى مستوى {overtakeToast.level}
            </Text>
          </View>
          <Feather name="chevron-left" size={18} color="#000" />
        </TouchableOpacity>
      )}

      {/* ── Floating action buttons ── */}
      <View style={[styles.fabGroup, {
        bottom: Platform.OS === "web" ? 90 : insets.bottom + 80,
      }]}>

        {/* Communities */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/communities"); }}
          activeOpacity={0.85}
        >
          <Feather name="users" size={22} color={PRIMARY} />
          {incomingInvites.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incomingInvites.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* My Cafés */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/my-cafes"); }}
          activeOpacity={0.85}
        >
          <Feather name="coffee" size={22} color={PRIMARY} />
          {cafeIds.length > 0 && (
            <View style={styles.cafeCountBadge}>
              <Text style={styles.cafeCountText}>{cafeIds.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Store */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/store"); }}
          activeOpacity={0.85}
        >
          <Feather name="shopping-bag" size={22} color={PRIMARY} />
        </TouchableOpacity>

        {/* My Collection */}
        <TouchableOpacity
          style={styles.fabSmall}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/collection"); }}
          activeOpacity={0.85}
        >
          <Feather name="package" size={22} color={PRIMARY} />
        </TouchableOpacity>

        {/* Leaderboard - purple distinctive */}
        <TouchableOpacity
          style={styles.fabLeaderboard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/leaderboard"); }}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="trophy" size={26} color="#FFF" />
          <Text style={styles.fabLeaderboardLabel}>التصنيف</Text>
        </TouchableOpacity>

      </View>
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
  overtakeToast: {
    position: "absolute",
    left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
    zIndex: 50,
  },
  overtakeIcon: { fontSize: 22 },
  overtakeTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#000",
    marginBottom: 2,
  },
  overtakeSub: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(0,0,0,0.75)",
  },
  bellTopLeft: {
    position: "absolute",
    left: 16,
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
    zIndex: 50,
  },
  addFriendTopRight: {
    position: "absolute",
    right: 16,
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
    zIndex: 50,
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
  cafeCountBadge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: BG,
  },
  cafeCountText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#000" },
  cafePill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.08)",
    marginBottom: 6, maxWidth: "85%",
  },
  cafePillEmpty: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.04)",
    marginBottom: 6, maxWidth: "90%",
  },
  cafePillText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: PRIMARY, maxWidth: 220,
  },
  coinsPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.08)",
    marginBottom: 6, maxWidth: "90%",
  },
  coinsPillImg: { width: 18, height: 18, resizeMode: "contain" },
  coinsPillText: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },
  coinsPillLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)" },
  dailyCapPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.06)",
    marginBottom: 8, maxWidth: "92%",
  },
  dailyCapPillFull: {
    borderColor: "rgba(239,83,80,0.55)",
    backgroundColor: "rgba(239,83,80,0.10)",
  },
  dailyCapText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: PRIMARY,
  },
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
  blockedScroll: {
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 80,
    alignItems: "center",
  },
  blockedIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(239,83,80,0.12)",
    borderWidth: 2, borderColor: "rgba(239,83,80,0.4)",
    alignItems: "center", justifyContent: "center",
    marginTop: 30, marginBottom: 24,
  },
  blockedIcon: { fontSize: 56 },
  blockedTitle: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center", marginBottom: 10,
  },
  blockedSubtitle: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center", marginBottom: 24, lineHeight: 22,
  },
  reasonCard: {
    width: "100%", borderRadius: 16, padding: 16,
    backgroundColor: "rgba(239,83,80,0.08)",
    borderWidth: 1, borderColor: "rgba(239,83,80,0.3)",
    marginBottom: 16,
  },
  reasonLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#EF5350", marginBottom: 6, letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: "#FFF", lineHeight: 22, textAlign: "right",
  },
  noticeCard: {
    width: "100%", borderRadius: 16, padding: 16,
    backgroundColor: PRIMARY_FAINT,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: PRIMARY, marginBottom: 10, textAlign: "right",
  },
  noticeItem: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)", marginBottom: 6,
    textAlign: "right", lineHeight: 22,
  },
  blockedHelp: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)", textAlign: "center",
  },
});
