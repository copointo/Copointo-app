import { Feather, FontAwesome5 } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useApp, SHOWCASE_USER_ID } from "@/context/AppContext";
import { useCommunities } from "@/context/CommunityContext";
import { useResponsive } from "@/hooks/useResponsive";
import { getRank } from "@/data/mockData";
import { apiFetch } from "@/constants/api";
import { playLevelUpSound, playNotificationChime } from "@/lib/notification-sound";
import { useRankOvertakeNotifier } from "@/lib/use-rank-overtake";
import { useLevelRewards } from "@/hooks/useLevelRewards";
import { useCoinMilestones } from "@/hooks/useCoinMilestones";
import CoinMilestoneModal from "@/components/CoinMilestoneModal";
import GiftFeedRain from "@/components/GiftFeedRain";
import CoinGiftModal from "@/components/CoinGiftModal";
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

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const PRIMARY_DIM = "rgba(232,184,109,0.30)";
const PRIMARY_FAINT = "rgba(232,184,109,0.12)";

// Qualifying drinks (== levels) between each free-coffee reward. Reward lands
// at levels 6, 12, 18, … — must stay in lockstep with the server award rule
// (DRINKS_PER_FREE_COFFEE in api-server cafe-dashboard.ts).
const DRINKS_PER_FREE_COFFEE = 6;

const outerSz = (size: number) => Math.ceil(size * Math.SQRT2);

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
            تحصل على كوب قهوة مجاني بعد كل ٦ مشروبات — استخدم الكود في نفس الكوفي الذي ربحته فيه.
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

// ── Rotated-square level marker used by the progress card + the side ladder ──
function HubDiamond({
  size, value, highlighted, done,
}: { size: number; value: number; highlighted?: boolean; done?: boolean }) {
  const osZ = outerSz(size);
  return (
    <View style={{ width: osZ, height: osZ, alignItems: "center", justifyContent: "center" }}>
      {highlighted && (
        <View style={[styles.currentHalo, { width: osZ + 26, height: osZ + 26 }]} />
      )}
      <View style={[styles.diamond, {
        width: size, height: size,
        borderColor: PRIMARY,
        borderWidth: highlighted ? 2.5 : 1.5,
        shadowColor: PRIMARY,
        shadowOpacity: highlighted ? 0.95 : done ? 0.3 : 0.5,
        shadowRadius: highlighted ? 18 : done ? 6 : 10,
        opacity: done ? 0.6 : 1,
      }]}>
        <View style={styles.diamondInner}>
          <Text style={{
            fontFamily: "Inter_700Bold",
            color: highlighted ? PRIMARY : "#FFF",
            fontSize: size * 0.34,
          }}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

export default function GameScreen() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const { user, activeGameCafeId, setActiveGameCafeId, incomingRequests, registeredUsers, friends }  = useApp();
  const { incomingInvites, refresh: refreshCommunities } = useCommunities();
  const r = useResponsive();
  const s = r.scale;
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

  const [status, setStatus] = useState<GameStatus | null>(null);

  // Poll game-suspension status from server (keyed by phone).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const phone = user?.phone;
      if (!phone) { setStatus(null); return; }
      apiFetch<GameStatus>(`/user-status?phone=${encodeURIComponent(phone)}`)
        .then(st => { if (!cancelled) setStatus(st); })
        .catch(() => { /* network errors → leave game accessible */ });
      return () => { cancelled = true; };
    }, [user?.phone]),
  );

  const isBlocked = !!(status && (status.gameBanned || status.gameSuspended));

  // Per-cafe view: when a cafe is selected, the entire game screen reflects
  // the user's progress AT THAT CAFE (level, rank, milestones, etc.).
  // If no cafe has been selected yet (brand-new user), fall back to the
  // global aggregate so the screen never goes blank.
  const level     = activeCafe ? activeCafe.level : (user?.level ?? 0);
  const rank      = getRank(level);
  const levelRewards = useLevelRewards(level);
  const coinMilestones = useCoinMilestones(level);
  const ordersThisLevel = level % DRINKS_PER_FREE_COFFEE;

  const username = user?.gameUsername || user?.name || "";

  const hasActivity = (user?.level ?? 0) > 0 || (user?.totalOrders ?? 0) > 0 || (user?.points ?? 0) > 0;

  // ── Rankings — mirror /leaderboard EXACTLY so the numbers match the screen
  // the button navigates to: rank by totalOrders (coffee count) desc, ties
  // broken by an FNV-1a hash of `id`, and the same showcase-user filter.
  const { omanRankStr, friendsRankStr } = useMemo(() => {
    const hashId = (str: string) => {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return h;
    };
    const sortDesc = (a: typeof registeredUsers[number], b: typeof registeredUsers[number]) =>
      ((b.totalOrders ?? 0) - (a.totalOrders ?? 0)) || (hashId(a.id) - hashId(b.id));
    const isShowcaseViewer = user?.id === SHOWCASE_USER_ID;
    const rankable = isShowcaseViewer
      ? registeredUsers
      : registeredUsers.filter((u) => u.id !== SHOWCASE_USER_ID && !u.id.startsWith("sc-user-"));

    const omanSorted = [...rankable].sort(sortDesc);
    const omanIdx = omanSorted.findIndex((u) => u.id === user?.id);
    const oman = omanIdx >= 0 ? `#${omanIdx + 1}` : "—";

    const friendsSorted = rankable
      .filter((u) => u.id === user?.id || friends.includes(u.id))
      .sort(sortDesc);
    const friendsIdx = friendsSorted.findIndex((u) => u.id === user?.id);
    const friendsRank = friendsIdx >= 0 ? `#${friendsIdx + 1}` : "—";

    return { omanRankStr: oman, friendsRankStr: friendsRank };
  }, [registeredUsers, friends, user?.id]);

  // ── Hub layout helpers ──
  // The "progress to next level" bar uses the real free-coffee cycle
  // (0→100% across the 6 levels between free drinks) — a genuine fractional
  // forward-progress signal, not an invented coins-to-level mechanic.
  const freeCoffeeCyclePct = Math.round((ordersThisLevel / DRINKS_PER_FREE_COFFEE) * 100);
  // Compact vertical ladder around the current level (mirrors the mockup:
  // a couple levels above + the current one + one below). The full board
  // lives on the dedicated /levels screen, reachable by tapping the ladder.
  const ladderLevels = [level + 2, level + 1, level, level - 1].filter((l) => l >= 0 && l <= 999);
  const charSize = Math.round(Math.min(112 * s, 140));

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
      .then(res => {
        if (cancelled) return;
        const all = (res.coffees ?? []).slice().sort((a, b) => {
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
      const res = await apiFetch<{ broadcasts: { id: string; createdAt: string }[] }>(`/broadcasts${uid}`);
      const lastSeen = (await AsyncStorage.getItem("copointo_broadcast_last_seen_v1")) ?? "";
      setUnreadBroadcasts((res.broadcasts ?? []).filter(b => b.createdAt > lastSeen).length);
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

  const openFreeCoffee = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFcOpen(true);
    // Mark free coffees as seen so the bell badge clears (these are now
    // surfaced here + in profile instead of the notifications screen).
    try {
      await AsyncStorage.setItem("copointo_free_coffee_last_seen_v1", new Date().toISOString());
      setUnreadFreeCoffees(0);
    } catch { /* ignore */ }
  }, []);

  const totalUnread =
    incomingRequests.length + incomingInvites.length + unreadBroadcasts + unreadFreeCoffees;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const stripPadBottom = Platform.OS === "web" ? 74 : insets.bottom + 60;

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

      {/* ── Rank-overtake toast ── */}
      {overtakeToast && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => { dismissOvertake(); router.push("/leaderboard"); }}
          style={[styles.overtakeToast, { top: Platform.OS === "web" ? 80 : insets.top + 12 }]}
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

      <View style={[styles.scrollContent, { flex: 1, paddingBottom: stripPadBottom }]}>
        {/* ── Header: notifications + add-friend (small) · coffee-levels ── */}
        <View style={styles.header}>
          <View style={styles.headerIconsRow}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/notifications"); }}
            >
              <Feather name="bell" size={17} color={PRIMARY} />
              {totalUnread > 0 && (
                <View style={styles.headerBadge}><Text style={styles.badgeText}>{totalUnread}</Text></View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/add-friend"); }}
            >
              <Feather name="user-plus" size={17} color={PRIMARY} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.headerLevelsBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/levels"); }}
          >
            <Feather name="award" size={16} color={PRIMARY} />
            <Text style={styles.headerLevelsBtnText}>مستويات الكوفي</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats card: level · coins · free coffees ── */}
        <View style={styles.statsCard}>
          {/* Level + rank name */}
          <View style={styles.statCol}>
            <Text style={styles.statRankIcon}>{rank.icon}</Text>
            <Text style={styles.statValue}>{level}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>{rank.name}</Text>
          </View>

          <View style={styles.statDivider} />

          {/* Coins → buy-coins */}
          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/buy-coins"); }}
          >
            <Image source={COPOINTO_COIN} style={styles.statCoinImg} />
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{coinBalance.toLocaleString("en-US")}</Text>
              <Feather name="plus-circle" size={13} color={PRIMARY} />
            </View>
            <Text style={styles.statLabel}>العملات</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          {/* Unused free coffees → free-coffee codes modal */}
          <TouchableOpacity
            style={styles.statCol}
            activeOpacity={0.85}
            onPress={openFreeCoffee}
          >
            <Feather name="coffee" size={18} color={PRIMARY} />
            <Text style={styles.statValue}>{fcAvailableCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>قهوة مجانية</Text>
          </TouchableOpacity>
        </View>

        {/* ── Progress to next level ── */}
        <View style={styles.progressCard}>
          <Text style={styles.progressCardTitle}>التقدم إلى المستوى التالي</Text>
          <View style={styles.progressDiamondsRow}>
            <HubDiamond size={40} value={level} highlighted />
            <View style={styles.progressBarWrap}>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.max(freeCoffeeCyclePct, 4)}%` as any }]} />
              </View>
              <Text style={styles.progressBarPct}>{freeCoffeeCyclePct}%</Text>
            </View>
            <HubDiamond size={40} value={Math.min(level + 1, 999)} />
          </View>
          <View style={styles.progressSubRow}>
            <Text style={styles.progressSubIcon}>☕</Text>
            <Text style={styles.progressSubText}>
              {level > 0 && ordersThisLevel === 0
                ? "قهوة مجانية متاحة الآن!"
                : `باقي ${DRINKS_PER_FREE_COFFEE - ordersThisLevel} مستوى للقهوة المجانية`}
            </Text>
          </View>
        </View>

        {/* ── Middle: ladder · character · hero buttons ── */}
        <View style={styles.midRow}>
          {/* Level ladder (tap → full board) */}
          <TouchableOpacity
            style={styles.ladderCol}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/levels"); }}
          >
            {ladderLevels.map((lvl, i) => {
              const isCur  = lvl === level;
              const isDone = lvl < level;
              return (
                <View key={lvl} style={styles.ladderItem}>
                  {i > 0 && (
                    <View style={styles.ladderConnector}>
                      <View style={styles.ladderDot} />
                      <View style={styles.ladderDot} />
                    </View>
                  )}
                  <HubDiamond size={isCur ? 42 : 30} value={lvl} highlighted={isCur} done={isDone} />
                  {isCur && <Text style={styles.ladderHereLabel}>أنت هنا</Text>}
                </View>
              );
            })}
          </TouchableOpacity>

          {/* Character on a glowing platform */}
          <View style={styles.centerCol}>
            <View style={styles.charGlow} />
            {equippedCharacter ? (
              <Character def={equippedCharacter} size={charSize} />
            ) : (
              <View style={{ width: charSize, height: charSize, alignItems: "center", justifyContent: "center" }}>
                <FontAwesome5 name="user-astronaut" size={charSize * 0.5} color={PRIMARY} />
              </View>
            )}
            <View style={styles.charPlatform} />
            {!!username && (
              <Text style={styles.charName} numberOfLines={1}>{username}</Text>
            )}
            {hasActivity && (
              <TouchableOpacity
                style={styles.rankButton}
                activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/leaderboard"); }}
              >
                <View style={styles.rankSeg}>
                  <Text style={styles.rankSegIcon}>🇴🇲</Text>
                  <Text style={styles.rankSegValue}>{omanRankStr}</Text>
                </View>
                <View style={styles.rankDivider} />
                <View style={styles.rankSeg}>
                  <Text style={styles.rankSegIcon}>👥</Text>
                  <Text style={styles.rankSegValue}>{friendsRankStr}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Hero buttons */}
          <View style={styles.heroCol}>
            <TouchableOpacity
              style={styles.heroBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/play-win"); }}
            >
              <FontAwesome5 name="gamepad" size={20} color={PRIMARY} />
              <Text style={styles.heroBtnLabel}>العب واربح</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/store"); }}
            >
              <Feather name="shopping-bag" size={20} color={PRIMARY} />
              <Text style={styles.heroBtnLabel}>المتجر</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroBtn}
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/collection"); }}
            >
              <Feather name="package" size={20} color={PRIMARY} />
              <Text style={styles.heroBtnLabel}>أغراضي</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── More features (same gold style) ── */}
        <View style={styles.bottomStripContent}>
          <TouchableOpacity
            style={styles.miniBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/leaderboard"); }}
          >
            <FontAwesome5 name="trophy" size={17} color={PRIMARY} />
            <Text style={styles.miniBtnLabel}>التصنيف</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.miniBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/communities"); }}
          >
            <Feather name="users" size={18} color={PRIMARY} />
            <Text style={styles.miniBtnLabel}>المجتمعات</Text>
            {incomingInvites.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{incomingInvites.length}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.miniBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/my-cafes"); }}
          >
            <Feather name="coffee" size={18} color={PRIMARY} />
            <Text style={styles.miniBtnLabel}>مستوى الكافيهات</Text>
            {cafeIds.length > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{cafeIds.length}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.miniBtn}
            activeOpacity={0.85}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/sent-gifts"); }}
          >
            <Feather name="gift" size={18} color={PRIMARY} />
            <Text style={styles.miniBtnLabel}>الهدايا المرسلة</Text>
            {unseenSentGifts > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unseenSentGifts}</Text></View>
            )}
          </TouchableOpacity>

        </View>
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
          the platform since the user's last visit to this page. */}
      <GiftFeedRain />

      <FreeCoffeeModal visible={fcOpen} onClose={() => setFcOpen(false)} coffees={fcList} />

      {/* Super-admin → user coin gifts. Polls /coin-gifts and shows a
          full-screen celebration modal that credits the local balance. */}
      <CoinGiftModal />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // ── Header ──
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 4, paddingTop: 2, paddingBottom: 6,
  },
  headerIconsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.06)",
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  headerBadge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18,
    borderRadius: 9, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center", backgroundColor: "#E5484D",
  },
  headerLevelsBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 22, borderWidth: 1.5, borderColor: PRIMARY_DIM,
    backgroundColor: "rgba(232,184,109,0.06)",
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  headerLevelsBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },

  // ── Stats card ──
  statsCard: {
    flexDirection: "row", alignItems: "stretch",
    backgroundColor: "rgba(232,184,109,0.06)",
    borderRadius: 20, borderWidth: 1, borderColor: PRIMARY_DIM,
    paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8,
  },
  statCol: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
  statDivider: { width: 1, backgroundColor: PRIMARY_DIM, marginVertical: 4 },
  statValueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  statRankIcon: { fontSize: 18, lineHeight: 22 },
  statLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.6)" },
  statCoinImg: { width: 22, height: 22, resizeMode: "contain" },

  // ── Progress (panel-less, compact) ──
  progressCard: {
    paddingVertical: 2, marginBottom: 4,
  },
  progressCardTitle: {
    fontSize: 12.5, fontFamily: "Inter_700Bold", color: PRIMARY,
    textAlign: "center", marginBottom: 5,
  },
  progressDiamondsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressBarWrap: { flex: 1, justifyContent: "center" },
  progressBarTrack: {
    height: 7, borderRadius: 4,
    backgroundColor: "rgba(232,184,109,0.12)", overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 4, backgroundColor: PRIMARY },
  progressBarPct: { marginTop: 4, fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  progressSubRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 5 },
  progressSubIcon: { fontSize: 13 },
  progressSubText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },

  // ── Middle area ──
  midRow: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    minHeight: 160, marginBottom: 6,
  },
  ladderCol: { width: 80, alignItems: "center", justifyContent: "center" },
  ladderItem: { alignItems: "center" },
  ladderConnector: { flexDirection: "column", alignItems: "center", gap: 3, paddingVertical: 3 },
  ladderDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: PRIMARY, opacity: 0.6 },
  ladderHereLabel: { marginTop: 2, fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },

  centerCol: { flex: 1, alignItems: "center", justifyContent: "center", alignSelf: "stretch" },
  charGlow: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.6, shadowRadius: 40, shadowOffset: { width: 0, height: 0 },
  },
  charPlatform: {
    marginTop: 4, width: 104, height: 18, borderRadius: 60,
    backgroundColor: "rgba(232,184,109,0.16)",
    borderWidth: 1, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 0 },
  },

  charName: { marginTop: -16, fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF", maxWidth: 140, textAlign: "center" },
  rankButton: {
    marginTop: 8, flexDirection: "row", alignItems: "center", alignSelf: "stretch",
    justifyContent: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
  },
  rankSeg: { flexDirection: "row", alignItems: "center", gap: 5 },
  rankSegIcon: { fontSize: 16 },
  rankSegValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  rankDivider: { width: 1, height: 16, backgroundColor: "rgba(232,184,109,0.35)" },

  heroCol: { width: 72, alignItems: "center", justifyContent: "center", gap: 10 },
  heroBtn: {
    width: 52, height: 52, borderRadius: 15,
    alignItems: "center", justifyContent: "center", gap: 2,
    backgroundColor: "rgba(232,184,109,0.14)",
    borderWidth: 1.5, borderColor: PRIMARY_DIM,
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  heroBtnLabel: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },

  // ── Bottom feature strip ──
  bottomStripContent: { flexDirection: "row", justifyContent: "center", gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  miniBtn: {
    width: 60, minHeight: 44, alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 7, paddingHorizontal: 2, borderRadius: 14,
    backgroundColor: "rgba(232,184,109,0.06)",
    borderWidth: 1, borderColor: PRIMARY_DIM,
  },
  miniBtnEmoji: { fontSize: 17 },
  miniBtnLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)", textAlign: "center" },

  // ── Diamonds (shared by HubDiamond) ──
  diamond: {
    borderRadius: 12, backgroundColor: "#0A0606",
    transform: [{ rotate: "45deg" }],
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  diamondInner: { transform: [{ rotate: "-45deg" }], alignItems: "center", justifyContent: "center" },
  currentHalo: {
    position: "absolute", borderRadius: 999,
    backgroundColor: "rgba(232,184,109,0.18)",
    shadowColor: PRIMARY, shadowOpacity: 0.9, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
  },

  // ── Badge ──
  badge: {
    position: "absolute", top: -5, right: -5,
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#EF5350",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: BG,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },

  // ── Rank-overtake toast ──
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
  overtakeTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000", marginBottom: 2 },
  overtakeSub: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(0,0,0,0.75)" },

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

  // ── Suspension / ban screen ──
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
