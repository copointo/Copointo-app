import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { apiFetch } from "@/constants/api";

// Ensure OS-level notifications still appear (with their default chime) even
// while the order-timer screen is in the foreground. Module-level so the
// handler is set once per app lifetime — idempotent across navigations.
// We cast the handler shape because expo-notifications exposes two key
// schemas across SDK versions (legacy `shouldShowAlert` vs the newer
// `shouldShowBanner`/`shouldShowList`); we set both so the chime + banner
// fire regardless of which SDK is in play.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    } as any),
  });
} catch { /* never crash the screen because of a notification quirk */ }

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const CREAM   = "#F5E6CC";
const SUCCESS = "#4ADE80";
const TRACK   = "rgba(232,184,109,0.12)";

// 4 ordered milestones in the customer-facing progress journey.
// `pos` is the centre of each node along the bar (0..1) so the fill
// can land exactly under the active icon.
type StepKey = "received" | "preparing" | "ready" | "levelup";
type StepDef = {
  key: StepKey;
  icon: React.ComponentProps<typeof Feather>["name"];
  ar: string;
  en: string;
  pos: number;
};
const STEPS: StepDef[] = [
  { key: "received",  icon: "inbox",         ar: "استلام الطلب",      en: "Received",  pos: 0.125 },
  { key: "preparing", icon: "coffee",        ar: "تحضير الطلب",       en: "Preparing", pos: 0.375 },
  { key: "ready",     icon: "check-circle",  ar: "جاهز للاستلام",     en: "Ready",     pos: 0.625 },
  { key: "levelup",   icon: "trending-up",   ar: "زيادة المستوى",     en: "Level up",  pos: 0.875 },
];

interface ServerOrder {
  id: string;
  status: "pending" | "preparing" | "ready" | "done";
  customerName: string;
  type: "dine" | "car";
  tableNumber?: string;
  plateNumber?: string;
  plateSymbol?: string;
  pointsAwarded?: boolean;
}

export default function OrderTimerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, setActiveOrder, addCafeOrder } = useApp();
  const { isAr } = useT();
  const params = useLocalSearchParams<{
    orderId: string; cafeId: string; cafeName?: string; minutes: string; drinks: string;
  }>();
  const orderId   = params.orderId;
  const cafeId    = params.cafeId;
  const cafeName  = params.cafeName ?? "";
  const totalMin  = Math.max(1, Number(params.minutes ?? "3"));
  const drinkQty  = (() => { const n = Number(params.drinks ?? "0"); return Math.max(0, Number.isFinite(n) ? n : 0); })();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [order,         setOrder]         = useState<ServerOrder | null>(null);
  const [confirmed,     setConfirmed]     = useState(false); // cafe pressed "تأكيد التحضير"
  const [completed,     setCompleted]     = useState(false); // cafe printed invoice → status:done
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const awardedRef = useRef(false);

  const isReadyOrDone = order?.status === "ready" || order?.status === "done";

  // Active step index drives icon styling.
  // Currently animating step = activeIdx (the latest one reached).
  const activeIdx =
    completed       ? 3 :
    isReadyOrDone   ? 2 :
    confirmed       ? 1 :
                      0;

  // ── Per-step toast banner + OS notification + sound ──
  // We watch `activeIdx` and fire a celebratory chime/banner the FIRST time
  // each milestone is reached. Initial mount (idx 0 → 0) is silent — only
  // forward transitions count.
  type BannerState = { title: string; sub: string; color: string; icon: React.ComponentProps<typeof Feather>["name"]; key: number } | null;
  const [banner, setBanner] = useState<BannerState>(null);
  const lastNotifiedIdxRef = useRef<number>(-1);
  const bannerY = useRef(new Animated.Value(-140)).current;
  const bannerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slide the banner in whenever a new one is set, then auto-hide.
  useEffect(() => {
    if (!banner) return;
    Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 80 }).start();
    if (bannerHideTimer.current) clearTimeout(bannerHideTimer.current);
    bannerHideTimer.current = setTimeout(() => {
      Animated.timing(bannerY, { toValue: -160, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setBanner(null));
    }, 3600);
    return () => { if (bannerHideTimer.current) clearTimeout(bannerHideTimer.current); };
  }, [banner, bannerY]);

  useEffect(() => {
    // First render — establish the baseline silently.
    if (lastNotifiedIdxRef.current === -1) {
      lastNotifiedIdxRef.current = activeIdx;
      return;
    }
    if (activeIdx <= lastNotifiedIdxRef.current) return;
    lastNotifiedIdxRef.current = activeIdx;

    const COPY = [
      { titleAr: "تم استلام طلبك 📥",    titleEn: "Order received 📥",      subAr: "بانتظار تأكيد الكوفي",                  subEn: "Waiting for cafe confirmation",     color: "#9CA3AF", icon: "inbox"        as const },
      { titleAr: "بدأ تحضير طلبك ☕",   titleEn: "Preparation started ☕", subAr: `سيكون جاهزاً خلال ${totalMin} دقيقة تقريباً`, subEn: `Ready in ~${totalMin} min`,         color: PRIMARY,   icon: "coffee"       as const },
      { titleAr: "طلبك جاهز للاستلام 🎉", titleEn: "Your order is ready 🎉", subAr: "توجّه للكاشير لاستلامه",                 subEn: "Head to the counter to pick it up", color: SUCCESS,   icon: "check-circle" as const },
      { titleAr: "ارتفع تصنيفك 🏆",     titleEn: "Your rank rose 🏆",      subAr: "تمت إضافة تقدّمك في اللعبة",            subEn: "Game progress added",                color: PRIMARY,   icon: "trending-up"  as const },
    ];
    const c = COPY[activeIdx];
    if (!c) return;

    // 1) In-app banner from the top — works on every platform incl. web.
    setBanner({
      title: isAr ? c.titleAr : c.titleEn,
      sub:   isAr ? c.subAr   : c.subEn,
      color: c.color,
      icon:  c.icon,
      key:   Date.now(),
    });

    // 2) Haptic — same celebratory pattern across all steps.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // 3) OS-level local notification with default chime. Native only — the
    //    web stack throws on scheduleNotificationAsync without a service
    //    worker registration, so we skip it there (the in-app banner is
    //    enough on web).
    if (Platform.OS !== "web") {
      Notifications.scheduleNotificationAsync({
        content: {
          title: isAr ? c.titleAr : c.titleEn,
          body:  isAr ? c.subAr   : c.subEn,
          sound: "default",
        },
        trigger: null,
      }).catch(() => { /* missing permission → silently skip */ });
    }
  }, [activeIdx, isAr, totalMin]);

  // Request notification permission once on mount so the OS chime actually
  // fires on the first transition. Best-effort — denied is fine, the
  // in-app banner still works.
  useEffect(() => {
    if (Platform.OS === "web") return;
    (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (perm.status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
      } catch { /* never block the screen */ }
    })();
  }, []);

  // ── Bar fill (0 .. 1) ──
  // The bar must always *look alive* until the final step. While waiting at
  // any non-final milestone we run a looping fill animation: the bar grows
  // from the current step's anchor toward the next step's anchor, then
  // resets and grows again, over and over. Only the final "completed" step
  // freezes the fill in place.
  const fillAnim = useRef(new Animated.Value(STEPS[0].pos)).current;
  useEffect(() => {
    // Final step — freeze the bar fully filled.
    if (completed) {
      Animated.timing(fillAnim, {
        toValue: STEPS[3].pos,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }

    // For every non-final stage, build a [from → to] looping crawl. The
    // `from` is the current step's anchor and `to` is the next step's
    // anchor minus a hair so the next-step icon doesn't visually fill in
    // before the server actually advances us.
    let from: number;
    let to: number;
    let crawlMs: number;
    if (isReadyOrDone) {
      // Ready → done: short, brisk loop between step 3 and step 4.
      from = STEPS[2].pos;
      to   = STEPS[3].pos - 0.03;
      crawlMs = 2200;
    } else if (confirmed) {
      // Preparing: loop between step 2 and step 3, paced by prep time but
      // capped so the user always sees movement within a few seconds.
      from = STEPS[1].pos;
      to   = STEPS[2].pos - 0.03;
      crawlMs = Math.min(Math.max(2500, totalMin * 60 * 1000), 12000);
    } else {
      // Pending: loop between step 1 and step 2 while waiting for the
      // cafe to confirm — keeps the bar feeling alive from the very start.
      from = STEPS[0].pos;
      to   = STEPS[1].pos - 0.03;
      crawlMs = 2400;
    }

    fillAnim.setValue(from);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fillAnim, {
          toValue: to,
          duration: crawlMs,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(fillAnim, {
          toValue: from,
          duration: 450,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [confirmed, isReadyOrDone, completed, totalMin, fillAnim]);

  // ── Shimmer sweep ──
  // A lighter gold band travels left-to-right across the whole bar over
  // and over so it always feels alive — even while waiting.
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();
  }, [shimmerAnim]);

  // ── Pulse for the currently-active step icon ──
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  // ── Server polling — drives status transitions ──
  useEffect(() => {
    if (completed || !orderId || !cafeId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await apiFetch<{ order: ServerOrder }>(`/cafe/${cafeId}/orders/${orderId}`);
        if (cancelled) return;
        setOrder(data.order);
        if (data.order.status !== "pending" && !confirmed) {
          setConfirmed(true);
          // Haptic intentionally omitted — the activeIdx effect below fires
          // a single success haptic per milestone to avoid double-tapping.
        }
        if (data.order.pointsAwarded && !awardedRef.current) {
          awardedRef.current = true;
          setPointsAwarded(drinkQty);
          if (user && drinkQty > 0) {
            addCafeOrder(cafeId, cafeName, drinkQty);
          }
        }
        if (data.order.status === "done" && !completed) {
          setCompleted(true);
        }
      } catch {/* ignore transient */}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, cafeId, completed, confirmed, drinkQty]);

  // ── Live MM:SS countdown ──
  // Starts the moment the cafe confirms the order, counts down totalMin*60
  // seconds to 00:00, and freezes when the order becomes ready/done so the
  // customer can see how long the prep actually took. Persisted across
  // re-renders by anchoring on a single `prepStartedAt` timestamp so polling
  // refreshes don't restart the count.
  const PREP_TOTAL_SEC = totalMin * 60;
  const prepStartedAtRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(PREP_TOTAL_SEC);
  useEffect(() => {
    // Stop the clock as soon as the drink is ready — freeze whatever value
    // we landed on (could be a small positive number, 0, or "early").
    if (!confirmed || isReadyOrDone || completed) return;
    if (prepStartedAtRef.current == null) prepStartedAtRef.current = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - (prepStartedAtRef.current ?? Date.now())) / 1000);
      setSecondsLeft(Math.max(0, PREP_TOTAL_SEC - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [confirmed, isReadyOrDone, completed, PREP_TOTAL_SEC]);
  // When the order becomes ready before the count reaches zero, snap to 0
  // so the timer doesn't look like it's still ticking.
  useEffect(() => {
    if (isReadyOrDone || completed) setSecondsLeft(0);
  }, [isReadyOrDone, completed]);
  const timerActive = confirmed && !isReadyOrDone && !completed;
  // ── Circular progress percentage ──
  // 0% before the cafe confirms; ramps up linearly during prep based on
  // elapsed time vs total prep minutes; locks at 100% once the order is
  // ready or done.
  const pct = (isReadyOrDone || completed)
    ? 100
    : confirmed
      ? Math.min(100, Math.max(0, Math.round(((PREP_TOTAL_SEC - secondsLeft) / PREP_TOTAL_SEC) * 100)))
      : 0;
  // SVG ring geometry.
  const RING_SIZE   = 168;
  const RING_STROKE = 14;
  const RING_R      = (RING_SIZE - RING_STROKE) / 2;
  const RING_C      = 2 * Math.PI * RING_R;
  const ringDashOffset = RING_C * (1 - pct / 100);
  const ringColor = (isReadyOrDone || completed) ? SUCCESS : confirmed ? PRIMARY : "rgba(245,230,204,0.35)";

  // ── Status pill text (top-right) ──
  const pillText = useMemo(() => {
    if (completed)     return isAr ? "اكتمل" : "Done";
    if (isReadyOrDone) return isAr ? "جاهز للاستلام" : "Ready";
    if (confirmed)     return isAr ? "قيد التحضير" : "Preparing";
    return isAr ? "بانتظار التأكيد" : "Pending";
  }, [completed, isReadyOrDone, confirmed, isAr]);

  // Big subtitle under the stepper.
  const headlineAr =
    completed       ? "تم استلام الطلب وارتفع تصنيفك 🎉" :
    isReadyOrDone   ? "طلبك جاهز — توجّه لاستلامه ☕" :
    confirmed       ? `جاري تحضير طلبك… (${totalMin} دقيقة تقريباً)` :
                      "تم استلام طلبك — بانتظار تأكيد الكوفي";
  const headlineEn =
    completed       ? "Order picked up — your rank went up 🎉" :
    isReadyOrDone   ? "Your order is ready — come pick it up ☕" :
    confirmed       ? `Preparing your order… (~${totalMin} min)` :
                      "Order received — waiting for cafe confirmation";
  const headline = isAr ? headlineAr : headlineEn;

  const goBackToMenu = () => {
    if (cafeId) router.replace({ pathname: "/cafe/[id]/order", params: { id: cafeId } });
    else router.back();
  };

  const goHome = () => { setActiveOrder(null); router.replace("/(tabs)"); };

  // ── Step node with pulse on the active one ──
  const renderNode = (i: number) => {
    const s = STEPS[i];
    const reached  = i <= activeIdx;
    const current  = i === activeIdx;
    const scale    = current ? pulse.interpolate({ inputRange: [0,1], outputRange: [1, 1.12] }) : 1;
    const glow     = current ? pulse.interpolate({ inputRange: [0,1], outputRange: [0.35, 0.95] }) : 0.0;

    return (
      <View key={s.key} style={styles.iconCol}>
        <Animated.View
          style={[
            styles.nodeShadow,
            current && {
              opacity: glow,
              transform: [{ scale: current ? pulse.interpolate({ inputRange:[0,1], outputRange:[1, 1.45] }) : 1 }],
            },
          ]}
          pointerEvents="none"
        />
        <Animated.View
          style={[
            styles.node,
            reached ? styles.nodeReached : styles.nodeIdle,
            { transform: [{ scale }] },
          ]}
        >
          <Feather
            name={s.icon}
            size={20}
            color={reached ? "#0B0604" : "rgba(245,230,204,0.55)"}
          />
        </Animated.View>
        <Text
          numberOfLines={2}
          style={[
            styles.stepLabel,
            reached && styles.stepLabelReached,
            current && styles.stepLabelCurrent,
          ]}
        >
          {isAr ? s.ar : s.en}
        </Text>
      </View>
    );
  };

  // Shimmer translate range — measured at runtime so it spans the full bar.
  const [barWidth, setBarWidth] = useState(0);
  const SHIMMER_WIDTH = 110;
  const shimmerTx = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_WIDTH, barWidth + SHIMMER_WIDTH],
  });

  // Animated fill width (in %) — converts 0..1 to "0%..100%".
  const fillWidth = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      {/* ── Top-of-screen toast banner — slides down on each step transition ── */}
      {banner && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.bannerWrap,
            { top: topPad + 6, transform: [{ translateY: bannerY }] },
          ]}
        >
          <View style={[styles.banner, { borderColor: `${banner.color}88` }]}>
            <View style={[styles.bannerIcon, { backgroundColor: `${banner.color}22`, borderColor: `${banner.color}66` }]}>
              <Feather name={banner.icon} size={20} color={banner.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle} numberOfLines={1}>{banner.title}</Text>
              <Text style={styles.bannerSub} numberOfLines={2}>{banner.sub}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (bannerHideTimer.current) clearTimeout(bannerHideTimer.current);
                Animated.timing(bannerY, { toValue: -160, duration: 220, useNativeDriver: true })
                  .start(() => setBanner(null));
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.bannerClose}
            >
              <Feather name="x" size={16} color="rgba(245,230,204,0.55)" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBackToMenu} style={styles.backBtn} activeOpacity={0.85}>
          <Feather name="arrow-right" size={18} color={CREAM} />
          <Text style={styles.backBtnText}>{isAr ? "للقائمة" : "Menu"}</Text>
        </TouchableOpacity>
        <View style={[styles.statusPill, completed && { borderColor: "rgba(74,222,128,0.55)", backgroundColor: "rgba(74,222,128,0.10)" }]}>
          <View style={[
            styles.statusDot,
            completed     ? { backgroundColor: SUCCESS } :
            isReadyOrDone ? { backgroundColor: SUCCESS } :
            confirmed     ? { backgroundColor: PRIMARY } :
                            { backgroundColor: "rgba(245,230,204,0.45)" },
          ]} />
          <Text style={styles.statusText}>{pillText}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.title}>{isAr ? "متابعة طلبك" : "Tracking your order"}</Text>

        {/* ── 4-step progress block ── */}
        <View style={styles.stepperBlock}>
          <View style={styles.iconsRow}>
            {STEPS.map((_, i) => renderNode(i))}
          </View>

          <View
            style={styles.barTrackWrap}
            onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          >
            <View style={styles.barTrack} />

            <Animated.View style={[styles.barFillWrap, { width: fillWidth }]}>
              <LinearGradient
                colors={[PRIMARY, "#FFD9A0", PRIMARY]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {/* Shimmer band sweeping across the full bar repeatedly. */}
            {barWidth > 0 && (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmer,
                  { width: SHIMMER_WIDTH, transform: [{ translateX: shimmerTx }, { skewX: "-18deg" }] },
                ]}
              >
                <LinearGradient
                  colors={["transparent", "rgba(255,232,180,0.55)", "transparent"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            )}
          </View>
        </View>

        <Text style={styles.headline}>{headline}</Text>

        {/* ── Circular progress ring with percentage ── */}
        <View style={[
          styles.timerCard,
          timerActive && styles.timerCardActive,
          (isReadyOrDone || completed) && styles.timerCardDone,
        ]}>
          <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              {/* Track */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke="rgba(245,230,204,0.10)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              {/* Progress arc — rotated -90° so 0% starts at 12 o'clock */}
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={ringColor}
                strokeWidth={RING_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                strokeDashoffset={ringDashOffset}
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[
                styles.ringPct,
                (isReadyOrDone || completed) && { color: SUCCESS },
                !confirmed && { color: "rgba(245,230,204,0.45)" },
              ]}>
                {pct}%
              </Text>
              <Text style={styles.ringSub}>
                {completed || isReadyOrDone
                  ? (isAr ? "اكتمل" : "Complete")
                  : confirmed
                    ? (isAr ? "قيد التحضير" : "Preparing")
                    : (isAr ? "بانتظار التأكيد" : "Pending")}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Order details ── */}
        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Feather name="hash" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{isAr ? "رقم الطلب" : "Order #"}</Text>
            <Text style={styles.detailValue}>#{orderId?.slice(-6)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="coffee" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{isAr ? "عدد المشروبات" : "Drinks"}</Text>
            <Text style={styles.detailValue}>{drinkQty}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{isAr ? "زمن التحضير" : "Prep time"}</Text>
            <Text style={styles.detailValue}>{totalMin} {isAr ? "د" : "min"}</Text>
          </View>
        </View>

        {/* ── Level-up reward (step 4) ── */}
        {completed && (
          <LinearGradient
            colors={[PRIMARY, "#C9985A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pointsBox}
          >
            <Text style={styles.pointsIcon}>🎮</Text>
            <View>
              <Text style={styles.pointsLabel}>{isAr ? "ارتفع تصنيفك" : "Your rank rose"}</Text>
              <Text style={styles.pointsValue}>
                {isAr
                  ? `+${pointsAwarded} ${pointsAwarded === 1 ? "مستوى" : "مستويات"}`
                  : `+${pointsAwarded} level${pointsAwarded === 1 ? "" : "s"}`}
              </Text>
            </View>
          </LinearGradient>
        )}

        {completed ? (
          <TouchableOpacity style={styles.cta} onPress={goHome} activeOpacity={0.88}>
            <LinearGradient
              colors={[PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>{isAr ? "العودة للرئيسية" : "Back home"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Text style={styles.tip}>
            {isAr
              ? "اترك الشاشة مفتوحة — سيتحرك الشريط تلقائياً مع كل خطوة."
              : "Keep this screen open — the bar moves with every step."}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  headerRow: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  backBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: CREAM },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: CREAM },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 22, gap: 18 },

  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: CREAM, letterSpacing: 0.3 },

  // ── Stepper block ──
  stepperBlock: {
    width: "100%",
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
  },
  iconsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  iconCol: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  nodeShadow: {
    position: "absolute",
    top: -4,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(232,184,109,0.35)",
  },
  node: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  nodeIdle: {
    backgroundColor: "rgba(232,184,109,0.05)",
    borderColor: "rgba(232,184,109,0.30)",
  },
  nodeReached: {
    backgroundColor: PRIMARY,
    borderColor: "#FFD9A0",
    shadowColor: PRIMARY,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  stepLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(245,230,204,0.45)",
    textAlign: "center",
    lineHeight: 14,
    minHeight: 28,
  },
  stepLabelReached: { color: CREAM, fontFamily: "Inter_600SemiBold" },
  stepLabelCurrent: { color: PRIMARY, fontFamily: "Inter_700Bold" },

  // ── Bar ──
  barTrackWrap: {
    width: "100%",
    height: 10,
    borderRadius: 5,
    backgroundColor: TRACK,
    overflow: "hidden",
    position: "relative",
  },
  barTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TRACK,
  },
  barFillWrap: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    borderRadius: 5,
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0, bottom: 0,
    left: 0,
  },

  headline: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(245,230,204,0.85)",
    textAlign: "center",
    lineHeight: 22,
  },

  detailsBox: {
    width: "100%", backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10,
  },
  detailRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  detailLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.55)" },
  detailValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: CREAM },
  divider:     { height: 1, backgroundColor: BORDER },

  pointsBox: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 22, paddingVertical: 16,
    borderRadius: 18,
  },
  pointsIcon:  { fontSize: 32 },
  pointsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(0,0,0,0.6)" },
  pointsValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },

  cta: { width: "100%", borderRadius: 16, overflow: "hidden" },
  ctaGrad: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },

  tip: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center", lineHeight: 18 },

  // ── Live countdown timer card ──
  timerCard: {
    width: "100%",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    marginBottom: 14,
  },
  timerCardActive: {
    borderColor: "rgba(232,184,109,0.55)",
    backgroundColor: "rgba(232,184,109,0.08)",
  },
  timerCardDone: {
    borderColor: "rgba(74,222,128,0.45)",
    backgroundColor: "rgba(74,222,128,0.08)",
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ringPct: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.5,
  },
  ringSub: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(245,230,204,0.65)",
    marginTop: 4,
  },

  // ── Top-of-screen step toast banner ──
  bannerWrap: {
    position: "absolute",
    left: 12, right: 12,
    zIndex: 100, elevation: 12,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "rgba(15,8,4,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  bannerIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  bannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: CREAM },
  bannerSub:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.70)", marginTop: 2, lineHeight: 16 },
  bannerClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
});
