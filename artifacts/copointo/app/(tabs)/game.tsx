import { Feather, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
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
import { useLevelRewards } from "@/hooks/useLevelRewards";
import { useCoinMilestones } from "@/hooks/useCoinMilestones";
import CoinMilestoneModal from "@/components/CoinMilestoneModal";
import GiftFeedRain from "@/components/GiftFeedRain";
import CoinGiftModal from "@/components/CoinGiftModal";
import { LEVEL_REWARDS } from "@/data/levelRewards";
import { getNextCoinMilestone, COIN_PER_MILESTONE, isCoinMilestone } from "@/data/coinMilestones";
import LevelRewardModal from "@/components/LevelRewardModal";
import Character from "@/components/Character";
import { useCharacters } from "@/hooks/useCharacters";
import { getCharacter } from "@/data/characters";
import { useUnseenSentGifts } from "@/hooks/useUnseenSentGifts";

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

interface FreeCoffeeItem {
  id: string;
  code: string;
  earnedAtLevel: number;
  earnedAt: string;
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
}

function FreeCoffeeModal({
  visible, onClose, coffees,
}: { visible: boolean; onClose: () => void; coffees: FreeCoffeeItem[] }) {
  const available = coffees.filter(c => !c.redeemedAt);
  const used      = coffees.filter(c => c.redeemedAt);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.fcOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.fcCard}>
          <View style={styles.fcHeader}>
            <Text style={styles.fcTitle}>🎁 الكوفي المجاني</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.fcSubtitle}>
            تحصل على كوب قهوة مجاني بعد كل ٧ مشروبات — استخدم الكود في نفس الكوفي الذي ربحته فيه.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
            {coffees.length === 0 && (
              <View style={styles.fcEmptyWrap}>
                <Text style={styles.fcEmptyIcon}>☕</Text>
                <Text style={styles.fcEmptyText}>لا يوجد لديك كوفي مجاني بعد</Text>
              </View>
            )}

            {available.map(c => (
              <View key={`fc-av-${c.id}`} style={styles.fcCodeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fcCodeValue}>{c.code}</Text>
                  <Text style={styles.fcCodeMeta}>
                    {c.earnedAtCafeName ? `في ${c.earnedAtCafeName}` : "متاح للاستخدام"}
                  </Text>
                </View>
                <View style={styles.fcStatusPillOk}>
                  <Text style={styles.fcStatusPillOkText}>متاح</Text>
                </View>
              </View>
            ))}

            {used.map(c => (
              <View key={`fc-us-${c.id}`} style={[styles.fcCodeRow, styles.fcCodeRowUsed]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fcCodeValue, styles.fcCodeValueUsed]}>{c.code}</Text>
                  <Text style={styles.fcCodeMeta}>
                    {c.earnedAtCafeName ? `في ${c.earnedAtCafeName}` : "تم الاستخدام"}
                  </Text>
                </View>
                <View style={styles.fcStatusPillUsed}>
                  <Text style={styles.fcStatusPillUsedText}>مستعمل</Text>
                </View>
              </View>
            ))}
            <View style={{ height: 8 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function GameScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { user, activeGameCafeId, setActiveGameCafeId, incomingRequests }  = useApp();
  const { incomingInvites, refresh: refreshCommunities } = useCommunities();
  const r = useResponsive();
  const { toast: overtakeToast, dismiss: dismissOvertake } = useRankOvertakeNotifier();
  const unseenSentGifts = useUnseenSentGifts();

  // Per-café progress: pick the currently-viewed café, or first available.
  const cafeProgress = user?.cafeProgress ?? {};
  const cafeIds = Object.keys(cafeProgress);
  const effectiveCafeId =
    (activeGameCafeId && cafeProgress[activeGameCafeId]) ? activeGameCafeId
    : (cafeIds[0] ?? null);
  const activeCafe = effectiveCafeId ? cafeProgress[effectiveCafeId] : null;
  const { balance: coinBalance } = useCoins();
  const { equipped: equippedCharacterId } = useCharacters();
  const equippedCharacter = getCharacter(equippedCharacterId);

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
  const [boardH, setBoardH] = useState(0);
  // Actual measured Y position of the current-level tile inside the
  // scroll content. Set via onLayout once the tile renders.
  const [currentTileMeasuredY, setCurrentTileMeasuredY] = useState<number | null>(null);
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

  // Per-cafe view: when a cafe is selected, the entire game screen reflects
  // the user's progress AT THAT CAFE (level, rank, board, milestones, etc.).
  // If no cafe has been selected yet (brand-new user), fall back to the
  // global aggregate so the screen never goes blank.
  const level     = activeCafe ? activeCafe.level : (user?.level ?? 0);
  const rank      = getRank(level);
  const levelRewards = useLevelRewards(level);
  const coinMilestones = useCoinMilestones(level);
  const nextReward = LEVEL_REWARDS.find(r => r.unlockLevel > level);
  const levelsToNextReward = nextReward ? nextReward.unlockLevel - level : 0;
  const nextCoinMilestone = getNextCoinMilestone(level);
  const levelsToNextCoin  = nextCoinMilestone ? nextCoinMilestone.level - level : 0;
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

  // Center the current tile inside the actual board viewport (not the full
  // screen) so the button always lands on the user's current level.
  // Prefer the actual measured Y from the tile's onLayout (accurate even
  // when row heights vary because of milestone labels / free-coffee hints);
  // fall back to the index-based estimate before the measurement arrives.
  const computeTarget = useCallback(() => {
    const viewport = boardH > 0 ? boardH : SCREEN_HEIGHT * 0.7;
    const tileY = currentTileMeasuredY ?? currentTileY;
    return Math.max(0, tileY - viewport / 2 + ROW_H / 2);
  }, [boardH, currentTileMeasuredY, currentTileY, ROW_H]);

  useEffect(() => {
    const target = computeTarget();
    setTimeout(() => scrollRef.current?.scrollTo({ y: target, animated: false }), 250);
  }, [level, boardH, currentTileMeasuredY]);

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
  // ── Free-coffee codes button (modal lists all codes incl. redeemed) ──
  const [fcOpen, setFcOpen] = useState(false);
  const [fcList, setFcList] = useState<FreeCoffeeItem[]>([]);

  useEffect(() => {
    const phone = user?.phone?.trim();
    if (!phone) { setFcList([]); return; }
    let cancelled = false;
    apiFetch<{ coffees: FreeCoffeeItem[] }>(
      `/free-coffees?phone=${encodeURIComponent(phone)}`,
    )
      .then(r => {
        if (cancelled) return;
        const all = (r.coffees ?? []).slice().sort((a, b) => {
          const au = a.redeemedAt ? 1 : 0;
          const bu = b.redeemedAt ? 1 : 0;
          if (au !== bu) return au - bu;
          return (b.earnedAt ?? "").localeCompare(a.earnedAt ?? "");
        });
        setFcList(all);
      })
      .catch(() => { /* ignore network errors */ });
    return () => { cancelled = true; };
  }, [user?.phone, fcOpen]);

  const fcAvailableCount = fcList.filter(c => !c.redeemedAt).length;

  const refreshBadges = useCallback(async () => {
    try {
      const uid = user?.id ? `?userId=${encodeURIComponent(user.id)}` : "";
      const r = await apiFetch<{ broadcasts: { id: string; createdAt: string }[] }>(`/broadcasts${uid}`);
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
      const targetY = computeTarget();
      setShowGoBack(Math.abs(y - targetY) > 160);
    },
    [computeTarget]
  );

  const goToCurrent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = computeTarget();
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
        {(incomingRequests.length + incomingInvites.length + unreadBroadcasts + unreadFreeCoffees) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{incomingRequests.length + incomingInvites.length + unreadBroadcasts + unreadFreeCoffees}</Text>
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

      {nextReward && (
        <View style={styles.nextRewardBanner}>
          <Feather name="gift" size={14} color={PRIMARY} />
          <Text style={styles.nextRewardText}>
            {levelsToNextReward === 1
              ? `متبقي مستوى واحد لجائزة "${nextReward.rankName}"`
              : `متبقي ${levelsToNextReward} مستويات لجائزة "${nextReward.rankName}"`}
          </Text>
        </View>
      )}

      {/* ── Compact pills row: coins + cafe + daily cap (icon-only) ── */}
      <View style={styles.compactPillsRow}>
        {/* Coins pill: coin icon + balance + plus (no text label) */}
        <TouchableOpacity
          style={styles.compactCoinsPill}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/buy-coins"); }}
          activeOpacity={0.85}
        >
          <Image source={COPOINTO_COIN} style={styles.compactCoinsImg} />
          <Text style={styles.compactCoinsText}>{coinBalance.toLocaleString("en-US")}</Text>
          <Feather name="plus-circle" size={14} color={PRIMARY} />
        </TouchableOpacity>

        {/* Active cafe pill — shown only when there's an active cafe.
            Compact, single line, truncates long names. */}
        {activeCafe && (
          <TouchableOpacity
            style={styles.compactCafePill}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/my-cafes"); }}
            activeOpacity={0.85}
          >
            <Feather name="coffee" size={12} color={PRIMARY} />
            <Text style={styles.compactCafeText} numberOfLines={1}>{activeCafe.cafeName}</Text>
          </TouchableOpacity>
        )}

        {/* Daily cap pill: bolt icon + "used/cap" only — no Arabic label */}
        <View style={[
          styles.compactDailyPill,
          dailyCapReached && styles.compactDailyPillFull,
        ]}>
          <Feather
            name={dailyCapReached ? "lock" : "zap"}
            size={12}
            color={dailyCapReached ? "#EF5350" : PRIMARY}
          />
          <Text style={[
            styles.compactDailyText,
            dailyCapReached && { color: "#EF5350" },
          ]}>
            {levelsTodayUsed}/{DAILY_LEVEL_CAP}
          </Text>
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
        onLayout={e => setBoardH(e.nativeEvent.layout.height)}
      >
        <View style={{ height: 16 }} />

        {visibleLevels.map((lvl) => {
          const isCurrent    = lvl === level;
          const isDone       = lvl < level;
          const isFreeCoffee = lvl > 0 && lvl % 7 === 0;
          const isCoinLvl    = isCoinMilestone(lvl);
          const sz           = isCurrent ? SZ_CURRENT : isDone ? SZ_DONE : SZ_OTHER;
          const osZ          = outerSz(sz);
          const xOff         = POSITIONS[lvl % 3];
          const rankForLvl   = RANKS.find((r) => r.min === lvl);

          return (
            <View
              key={lvl}
              style={{ alignItems: "center" }}
              onLayout={isCurrent ? (e) => setCurrentTileMeasuredY(e.nativeEvent.layout.y) : undefined}
            >

              {/* ── Tier milestone label ── */}
              {rankForLvl && lvl > 0 && (() => {
                const earned = lvl <= level;
                const isNextReward = !earned && nextReward?.unlockLevel === lvl;
                const stepsAway = lvl - level;
                return (
                  <View style={[styles.milestone, earned && styles.milestoneEarned, isNextReward && styles.milestoneNext]}>
                    <Text style={styles.milestoneText}>{rankForLvl.icon}  {rankForLvl.name}</Text>
                    {earned ? (
                      <View style={styles.milestoneEarnedChip}>
                        <Feather name="check" size={10} color="#000" />
                        <Text style={styles.milestoneEarnedChipText}>تم ربح الجوائز</Text>
                      </View>
                    ) : isNextReward ? (
                      <View style={styles.milestoneNextChip}>
                        <Feather name="gift" size={10} color={PRIMARY} />
                        <Text style={styles.milestoneNextChipText}>
                          {stepsAway === 1 ? "متبقي مستوى واحد للجائزة" : `متبقي ${stepsAway} مستويات للجائزة`}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                );
              })()}

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

                {/* Equipped companion character — floats above the current level tile */}
                {isCurrent && equippedCharacter && (
                  <View pointerEvents="none" style={{
                    position: "absolute",
                    top: -Math.round(sz * 1.10),
                    alignItems: "center", justifyContent: "center",
                  }}>
                    <Character def={equippedCharacter} size={Math.round(sz * 1.00)} />
                  </View>
                )}

                <View style={[
                  styles.diamond,
                  {
                    width: sz, height: sz,
                    borderColor: isCoinLvl ? "#FFD66B" : PRIMARY,
                    borderWidth: isCurrent ? 2.5 : isCoinLvl ? 2 : 1.5,
                    shadowColor: isCoinLvl ? "#FFD66B" : PRIMARY,
                    shadowOpacity: isCurrent ? 0.95 : isCoinLvl ? 0.85 : isDone ? 0.35 : 0.55,
                    shadowRadius:  isCurrent ? 22 : isCoinLvl ? 16 : isDone ? 6 : 12,
                  }
                ]}>
                  {/* Coin milestone overlay — sits on the diamond tile for
                      levels 50, 100, 150 ... so users see the bonus reward
                      right where they're aiming on the main game board. */}
                  {isCoinLvl && (
                    <>
                      <View style={[styles.coinTileBadge, { top: -10, right: -10 }]}>
                        <Image source={COPOINTO_COIN} style={styles.coinTileBadgeImg} />
                        <Text style={styles.coinTileBadgeText}>+{COIN_PER_MILESTONE}</Text>
                      </View>
                      <View style={[styles.coinTileGlowRing, { width: sz + 12, height: sz + 12 }]} pointerEvents="none" />
                    </>
                  )}
                  <View style={styles.diamondInner}>
                    {isCurrent ? (
                      <>
                        <Text style={[styles.curHere, { fontSize: sz * 0.16 }]} numberOfLines={1}>أنت هنا</Text>
                        <Text style={[styles.curNum, { fontSize: sz * 0.20 }]}>{lvl}</Text>
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

              {/* ── Coin milestone hint label (every 50 levels) ── */}
              {isCoinLvl && !isCurrent && (
                <View style={[styles.coinHint, { transform: [{ translateX: xOff > 0 ? -30 : xOff < 0 ? 30 : 0 }] }]}>
                  <Image source={COPOINTO_COIN} style={styles.coinHintImg} />
                  <Text style={styles.coinHintText}>
                    {isDone
                      ? `ربحت ${COIN_PER_MILESTONE} عملة من هذا المستوى`
                      : `اصل لهذا المستوى واربح ${COIN_PER_MILESTONE} عملة`}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Bottom spacer — half of viewport so the bottom tiles (e.g. level 0)
            can actually be centered by goToCurrent without being clamped. */}
        <View style={{ height: Math.max(Platform.OS === "web" ? 130 : insets.bottom + 120, boardH * 0.55) }} />
      </ScrollView>

      {/* ── "Go to my level" button (sits ABOVE the المستويات button on the left) ── */}
      {showGoBack && (
        <TouchableOpacity
          style={[styles.goBackBtn, {
            left: 20,
            bottom: (Platform.OS === "web" ? 90 : insets.bottom + 80) + 58 + 12,
          }]}
          onPress={goToCurrent}
          activeOpacity={0.85}
        >
          <Feather name="crosshair" size={16} color="#000" />
          <Text style={styles.goBackText}>اذهب إلى مستواي</Text>
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

        {/* Communities — انشاء مجتمع (blue) */}
        <TouchableOpacity
          style={[styles.fabThemed, { backgroundColor: "#4A90E2", shadowColor: "#4A90E2" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/communities"); }}
          activeOpacity={0.85}
        >
          <Feather name="users" size={18} color="#FFF" />
          <Text style={styles.fabThemedLabel}>انشاء مجتمع</Text>
          {incomingInvites.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incomingInvites.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Store — المتجر (green) */}
        <TouchableOpacity
          style={[styles.fabThemed, { backgroundColor: "#4CAF50", shadowColor: "#4CAF50" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/store"); }}
          activeOpacity={0.85}
        >
          <View style={styles.storeIconWrap}>
            <FontAwesome5
              name="user-astronaut"
              size={16}
              color="#FFF"
              style={styles.storeIconChar}
            />
            <Feather
              name="gift"
              size={11}
              color="#FFF"
              style={styles.storeIconGift}
            />
            <Feather
              name="image"
              size={11}
              color="#FFF"
              style={styles.storeIconBg}
            />
          </View>
          <Text style={styles.fabThemedLabel}>المتجر</Text>
        </TouchableOpacity>

        {/* My Collection — اغراضي (purple) */}
        <TouchableOpacity
          style={[styles.fabThemed, { backgroundColor: "#9B59E8", shadowColor: "#9B59E8" }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/collection"); }}
          activeOpacity={0.85}
        >
          <Feather name="package" size={18} color="#FFF" />
          <Text style={styles.fabThemedLabel}>اغراضي</Text>
        </TouchableOpacity>

        {/* Leaderboard - purple distinctive */}
        <TouchableOpacity
          style={styles.fabLeaderboard}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/leaderboard"); }}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="trophy" size={22} color="#FFF" />
          <Text style={styles.fabLeaderboardLabel}>التصنيف</Text>
        </TouchableOpacity>

      </View>

      {/* Free coffee (small) - sits directly above مستوى الكافيهات on the LEFT (gold) */}
      <TouchableOpacity
        style={[styles.fabFreeCoffee, {
          bottom: (Platform.OS === "web" ? 90 : insets.bottom + 80) + 70 + 70 + 70,
        }]}
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setFcOpen(true);
          // Mark free coffees as seen so the bell badge clears (these are now
          // surfaced here + in profile instead of the notifications screen).
          try {
            await AsyncStorage.setItem("copointo_free_coffee_last_seen_v1", new Date().toISOString());
            setUnreadFreeCoffees(0);
          } catch { /* ignore */ }
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabFreeCoffeeIcon}>🎁</Text>
        <Text style={styles.fabFreeCoffeeLabel}>الكوفي المجاني</Text>
        {fcAvailableCount > 0 && (
          <View style={styles.fabFreeCoffeeBadge}>
            <Text style={styles.fabFreeCoffeeBadgeText}>{fcAvailableCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* My Cafés - sits directly above الهدايا المرسلة on the LEFT (orange) */}
      <TouchableOpacity
        style={[styles.fabSentGifts, {
          backgroundColor: "#FF8A3D",
          shadowColor: "#FF8A3D",
          bottom: (Platform.OS === "web" ? 90 : insets.bottom + 80) + 70 + 70,
        }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/my-cafes"); }}
        activeOpacity={0.85}
      >
        <Feather name="coffee" size={18} color="#FFF" />
        <Text style={styles.fabSentGiftsLabel}>مستوى الكافيهات</Text>
        {cafeIds.length > 0 && (
          <View style={styles.cafeCountBadge}>
            <Text style={styles.cafeCountText}>{cafeIds.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Sent Gifts - sits directly above المستويات on the LEFT */}
      <TouchableOpacity
        style={[styles.fabSentGifts, {
          bottom: (Platform.OS === "web" ? 90 : insets.bottom + 80) + 70,
        }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sent-gifts"); }}
        activeOpacity={0.85}
      >
        <Feather name="gift" size={18} color="#FFF" />
        <Text style={styles.fabSentGiftsLabel}>الهدايا المرسلة</Text>
        {unseenSentGifts > 0 && (
          <View style={styles.sentGiftsBadge}>
            <Text style={styles.sentGiftsBadgeText}>{unseenSentGifts}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Levels - gold, mirrors Leaderboard on the LEFT */}
      <TouchableOpacity
        style={[styles.fabLevels, {
          bottom: Platform.OS === "web" ? 90 : insets.bottom + 80,
        }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/levels"); }}
        activeOpacity={0.85}
      >
        <Feather name="award" size={18} color="#000" />
        <Text style={styles.fabLevelsLabel}>المستويات</Text>
      </TouchableOpacity>
     </View>

      {/* Celebration modal for newly-earned frame + badge rewards. */}
      <LevelRewardModal
        reward={levelRewards.current}
        remaining={levelRewards.remaining}
        onDismiss={levelRewards.dismiss}
      />

      {/* Coin milestone celebration — fires every 50 levels with +25 coins. */}
      <CoinMilestoneModal
        milestone={coinMilestones.current}
        remaining={coinMilestones.remaining}
        onDismiss={coinMilestones.dismiss}
      />

      {/* Global gift feed — falling-rain animation for any gift sent on
          the platform since the user's last visit to this page. Lives only
          on the Levels page so the rain never interrupts other screens. */}
      <GiftFeedRain />

      <FreeCoffeeModal visible={fcOpen} onClose={() => setFcOpen(false)} coffees={fcList} />

      {/* Super-admin → user coin gifts. Polls /coin-gifts and shows a
          full-screen celebration modal that credits the local balance. */}
      <CoinGiftModal />
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
  milestoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PRIMARY, textAlign: "center" },
  milestoneEarned: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.14)",
  },
  milestoneNext: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 10,
  },
  milestoneEarnedChip: {
    marginTop: 6, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: PRIMARY,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  milestoneEarnedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  milestoneNextChip: {
    marginTop: 6, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: PRIMARY,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  milestoneNextChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  nextRewardBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "center",
    marginTop: 8, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.08)",
  },
  nextRewardText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  nextCoinBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "center",
    marginTop: 4, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,214,107,0.45)",
    backgroundColor: "rgba(255,214,107,0.10)",
    shadowColor: "#FFD66B", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  nextCoinImg: { width: 22, height: 22, resizeMode: "contain" },
  nextCoinText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", flexShrink: 1 },
  nextCoinHint: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#000",
    backgroundColor: "#FFD66B",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },
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
  curHere:   { color: "#E8B86D", fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
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
  fabWithLabel: {
    alignItems: "center",
    gap: 3,
  },
  fabThemed: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center", gap: 2,
    paddingHorizontal: 2,
    borderWidth: 1.2, borderColor: "rgba(255,255,255,0.18)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 10, elevation: 6,
  },
  fabThemedLabel: {
    fontSize: 7, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "center",
  },
  fabSmall: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 6,
  },
  storeIconWrap: {
    width: 32, height: 32, alignItems: "center", justifyContent: "center",
  },
  storeIconChar: {
    position: "absolute", top: -1, left: 7,
  },
  storeIconGift: {
    position: "absolute", bottom: -2, left: -2,
  },
  storeIconBg: {
    position: "absolute", bottom: -2, right: -2,
  },
  fabSmallLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: PRIMARY,
    marginTop: 2,
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
  sentGiftsBadge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#E8484C",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 1.5, borderColor: BG,
  },
  sentGiftsBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
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
  // Compact horizontal row that replaces the previous stacked pills above
  // the level board. Three pills (coins / active-cafe / daily-cap) sit side
  // by side and stay icon-first to free up vertical space for the levels.
  compactPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
  },
  compactCoinsPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.08)",
  },
  compactCoinsImg: { width: 16, height: 16, resizeMode: "contain" },
  compactCoinsText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  compactCafePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.08)",
    maxWidth: 160,
  },
  compactCafeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: PRIMARY, maxWidth: 130 },
  compactDailyPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.06)",
  },
  compactDailyPillFull: {
    borderColor: "rgba(239,83,80,0.55)",
    backgroundColor: "rgba(239,83,80,0.10)",
  },
  compactDailyText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
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
    width: 70, height: 70, borderRadius: 18,
    alignItems: "center", justifyContent: "center", gap: 3,
    backgroundColor: PURPLE,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: PURPLE, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 16, elevation: 10,
  },
  fabLeaderboardLabel: {
    fontSize: 9, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "center",
  },
  fabSentGifts: {
    position: "absolute",
    left: 20,
    width: 58, height: 58, borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 2,
    paddingHorizontal: 3,
    backgroundColor: "#E8484C",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#E8484C", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 16, elevation: 10,
    zIndex: 60,
  },
  fabSentGiftsLabel: {
    fontSize: 8, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "center",
  },
  fabLevels: {
    position: "absolute",
    left: 20,
    width: 58, height: 58, borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 2,
    backgroundColor: PRIMARY,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 16, elevation: 10,
    zIndex: 60,
  },
  fabLevelsLabel: {
    fontSize: 8, fontFamily: "Inter_700Bold",
    color: "#000", textAlign: "center",
  },
  // ── Small free-coffee FAB (above مستوى الكافيهات) ──
  fabFreeCoffee: {
    position: "absolute",
    left: 25,
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center", gap: 1,
    paddingHorizontal: 2,
    backgroundColor: "rgba(232,184,109,0.16)",
    borderWidth: 1.5, borderColor: PRIMARY,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 9,
    zIndex: 60,
  },
  fabFreeCoffeeIcon: { fontSize: 14 },
  fabFreeCoffeeLabel: {
    fontSize: 7, fontFamily: "Inter_700Bold",
    color: PRIMARY, textAlign: "center",
  },
  fabFreeCoffeeBadge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#000",
  },
  fabFreeCoffeeBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  // ── Free coffee codes modal ──
  fcOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  fcCard: {
    width: "100%", maxWidth: 420, maxHeight: "80%",
    backgroundColor: "#121212", borderRadius: 24,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    padding: 20,
  },
  fcHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fcTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  fcSubtitle: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", textAlign: "right", marginTop: 8, lineHeight: 18,
  },
  fcEmptyWrap: { alignItems: "center", paddingVertical: 30, gap: 8 },
  fcEmptyIcon: { fontSize: 40 },
  fcEmptyText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)" },
  fcCodeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(232,184,109,0.08)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
  },
  fcCodeRowUsed: {
    backgroundColor: "rgba(229,83,83,0.08)", borderColor: "rgba(229,83,83,0.4)",
  },
  fcCodeValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY, letterSpacing: 3, textAlign: "right" },
  fcCodeValueUsed: { color: "#E55353", textDecorationLine: "line-through" },
  fcCodeMeta: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)", marginTop: 3, textAlign: "right" },
  fcStatusPillOk: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.18)", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  fcStatusPillOkText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  fcStatusPillUsed: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
    backgroundColor: "rgba(229,83,83,0.18)", borderWidth: 1, borderColor: "rgba(229,83,83,0.5)",
  },
  fcStatusPillUsedText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E55353" },
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
  coinTileBadge: {
    position: "absolute",
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FFD66B",
    borderWidth: 1.5, borderColor: "#000",
    borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2,
    shadowColor: "#FFD66B", shadowOpacity: 0.9, shadowRadius: 8, elevation: 6,
    zIndex: 5,
  },
  coinTileBadgeImg: { width: 14, height: 14, resizeMode: "contain" },
  coinTileBadgeText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#000",
  },
  coinTileGlowRing: {
    position: "absolute",
    borderRadius: 4,
    borderWidth: 1, borderColor: "rgba(255,214,107,0.55)",
    transform: [{ rotate: "45deg" }],
  },
  coinHint: {
    marginTop: 5, marginBottom: 4,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,214,107,0.10)",
    borderWidth: 1, borderColor: "rgba(255,214,107,0.45)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
    maxWidth: 250,
  },
  coinHintImg: { width: 18, height: 18, resizeMode: "contain" },
  coinHintText: {
    flexShrink: 1,
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#FFD66B", textAlign: "center",
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
