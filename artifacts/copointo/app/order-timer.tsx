import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { apiFetch } from "@/constants/api";
import { playLevelUpSound } from "@/lib/notification-sound";


// Ensure OS-level notifications still appear (with their default chime) even
// while the order-timer screen is in the foreground. Module-level so the
// handler is set once per app lifetime — idempotent across navigations.
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

const AR_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const EN_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// 5 ordered milestones — mirrors the order-status journey shown to the
// customer (received → confirm → preparing → ready → level-up).
type StepKey = "received" | "confirm" | "preparing" | "ready" | "levelup";
type StepDef = {
  key: StepKey;
  icon: React.ComponentProps<typeof Feather>["name"];
  ar: string;
  en: string;
};
const STEPS: StepDef[] = [
  { key: "received",  icon: "clipboard",    ar: "استلام الطلب",   en: "Received"  },
  { key: "confirm",   icon: "clock",        ar: "تأكيد الطلب",    en: "Confirm"   },
  { key: "preparing", icon: "coffee",       ar: "التحضير",        en: "Preparing" },
  { key: "ready",     icon: "shopping-bag", ar: "جاهز للاستلام",  en: "Ready"     },
  { key: "levelup",   icon: "star",         ar: "زيادة المستوى",  en: "Level up"  },
];

// ── Animated step icons ────────────────────────────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path);

type StepIconProps = {
  kind: StepKey;
  active: boolean;
  color: string;
  size?: number;
};
function StepIcon({ kind, active, color, size = 20 }: StepIconProps) {
  // Animation drivers — allocating them unconditionally keeps hook order
  // stable across re-renders even though only a couple are used.
  const draw   = useRef(new Animated.Value(1)).current; // 0 hidden → 1 drawn
  const dropA  = useRef(new Animated.Value(0)).current; // 0 top → 1 inside cup
  const dropB  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const loops: Animated.CompositeAnimation[] = [];

    if (kind === "received") {
      const l = Animated.loop(
        Animated.sequence([
          Animated.timing(draw, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          Animated.delay(450),
          Animated.timing(draw, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic),  useNativeDriver: false }),
          Animated.delay(180),
        ]),
      );
      draw.setValue(0);
      loops.push(l);
    } else if (kind === "preparing") {
      const make = (v: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 1, useNativeDriver: true }),
            Animated.delay(Math.max(0, 700 - delay)),
          ]),
        );
      loops.push(make(dropA, 0));
      loops.push(make(dropB, 350));
    }

    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, kind, draw, dropA, dropB]);

  const S = size;

  // ── Active: bespoke animation for received + preparing; plain icon else ──
  if (active && kind === "received") {
    const CHECK_LEN = 16;
    const dashOffset = draw.interpolate({ inputRange: [0, 1], outputRange: [CHECK_LEN, 0] });
    return (
      <Svg width={S} height={S} viewBox="0 0 24 24">
        <Path
          d="M3 14 L3 19 A2 2 0 0 0 5 21 L19 21 A2 2 0 0 0 21 19 L21 14"
          stroke={color} strokeWidth={2} fill="none"
          strokeLinecap="round" strokeLinejoin="round" opacity={0.5}
        />
        <AnimatedPath
          d="M7 11 L11 15 L17 8"
          stroke={color} strokeWidth={2.6} fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
          strokeDashoffset={dashOffset as unknown as number}
        />
      </Svg>
    );
  }

  if (active && kind === "preparing") {
    const dropMaxY = S * 0.45;
    const txA = dropA.interpolate({ inputRange: [0, 1], outputRange: [0, dropMaxY] });
    const opA = dropA.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 1, 0] });
    const txB = dropB.interpolate({ inputRange: [0, 1], outputRange: [0, dropMaxY] });
    const opB = dropB.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0, 1, 0] });
    const dotSize = Math.max(3, Math.round(S * 0.15));
    return (
      <View style={{ width: S, height: S, alignItems: "center", justifyContent: "flex-end" }}>
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: S * 0.30 - dotSize / 2, transform: [{ translateY: txA }], opacity: opA }}
        >
          <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize, backgroundColor: color }} />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: S * 0.62 - dotSize / 2, transform: [{ translateY: txB }], opacity: opB }}
        >
          <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize, backgroundColor: color }} />
        </Animated.View>
        <Feather name="coffee" size={S} color={color} />
      </View>
    );
  }

  const name =
    kind === "received"  ? "clipboard"    :
    kind === "confirm"   ? "clock"        :
    kind === "preparing" ? "coffee"       :
    kind === "ready"     ? "shopping-bag" :
                           "star";
  return <Feather name={name as React.ComponentProps<typeof Feather>["name"]} size={size} color={color} />;
}

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
  const { user, activeOrder, setActiveOrder, addCafeOrder } = useApp();
  const { isAr } = useT();
  const params = useLocalSearchParams<{
    orderId: string; cafeId: string; cafeName?: string; minutes: string; drinks: string;
  }>();

  // ── Source of truth ──
  // Prefer the navigation params (fresh order), then fall back to the
  // persisted `activeOrder` so re-entry from history / the café banner —
  // which pushes this screen WITHOUT params — still works.
  const orderId   = params.orderId   ?? activeOrder?.orderId   ?? "";
  const cafeId    = params.cafeId    ?? activeOrder?.cafeId    ?? "";
  const cafeName  = params.cafeName  ?? activeOrder?.cafeName  ?? "";
  const totalMin  = Math.max(1, Number(params.minutes ?? activeOrder?.prepMinutes ?? 3));
  const drinkQty  = (() => {
    const n = Number(params.drinks ?? activeOrder?.drinkQty ?? 0);
    return Math.max(0, Number.isFinite(n) ? n : 0);
  })();

  // Rich receipt snapshot — only trust it when it belongs to THIS order.
  const rich = activeOrder && activeOrder.orderId === orderId ? activeOrder : null;
  const items = rich?.items ?? [];
  const orderTotal = rich?.total;
  const pickupType = rich?.type;
  const startedAt = rich?.startedAt ?? Date.now();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [order,         setOrder]         = useState<ServerOrder | null>(null);
  const [confirmed,     setConfirmed]     = useState(false); // cafe pressed "تأكيد التحضير"
  const [completed,     setCompleted]     = useState(false); // cafe printed invoice → status:done
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const awardedRef = useRef(false);

  const isReadyOrDone = order?.status === "ready" || order?.status === "done";

  // Active step index drives icon styling — 5-step space:
  //   0 received (always done once placed) · 1 confirm · 2 preparing · 3 ready · 4 levelup
  const activeIdx =
    completed       ? 4 :
    isReadyOrDone   ? 3 :
    confirmed       ? 2 :
                      1;

  // ── Per-step toast banner + OS notification + sound ──
  type BannerState = { title: string; sub: string; color: string; icon: React.ComponentProps<typeof Feather>["name"]; key: number } | null;
  const [banner, setBanner] = useState<BannerState>(null);
  const lastNotifiedIdxRef = useRef<number>(-1);
  const bannerY = useRef(new Animated.Value(-140)).current;
  const bannerHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (lastNotifiedIdxRef.current === -1) {
      lastNotifiedIdxRef.current = activeIdx;
      return;
    }
    if (activeIdx <= lastNotifiedIdxRef.current) return;
    lastNotifiedIdxRef.current = activeIdx;

    const COPY = [
      { titleAr: "تم استلام طلبك 📥",    titleEn: "Order received 📥",      subAr: "بانتظار تأكيد الكوفي",                       subEn: "Waiting for cafe confirmation",     color: "#9CA3AF", icon: "clipboard"    as const },
      { titleAr: "بانتظار التأكيد ⏳",   titleEn: "Awaiting confirmation ⏳", subAr: "سيتم إشعارك فور قبول الطلب",                subEn: "You'll be notified once accepted",  color: "#9CA3AF", icon: "clock"        as const },
      { titleAr: "بدأ تحضير طلبك ☕",   titleEn: "Preparation started ☕", subAr: `سيكون جاهزاً خلال ${totalMin} دقيقة تقريباً`, subEn: `Ready in ~${totalMin} min`,         color: PRIMARY,   icon: "coffee"       as const },
      { titleAr: "طلبك جاهز للاستلام 🎉", titleEn: "Your order is ready 🎉", subAr: "توجّه للكاشير لاستلامه",                    subEn: "Head to the counter to pick it up", color: SUCCESS,   icon: "shopping-bag" as const },
      { titleAr: "ارتفع تصنيفك 🏆",     titleEn: "Your rank rose 🏆",      subAr: "تمت إضافة تقدّمك في اللعبة",                 subEn: "Game progress added",               color: PRIMARY,   icon: "star"         as const },
    ];
    const c = COPY[activeIdx];
    if (!c) return;

    setBanner({
      title: isAr ? c.titleAr : c.titleEn,
      sub:   isAr ? c.subAr   : c.subEn,
      color: c.color,
      icon:  c.icon,
      key:   Date.now(),
    });

    if (activeIdx !== 4) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

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

  // ── Breathing neon glow for the circular timer ──
  const ringPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringPulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(ringPulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ringPulse]);

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
  const PREP_TOTAL_SEC = totalMin * 60;
  const prepStartedAtRef = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(PREP_TOTAL_SEC);
  useEffect(() => {
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
  useEffect(() => {
    if (isReadyOrDone || completed) setSecondsLeft(0);
  }, [isReadyOrDone, completed]);
  const timerActive = confirmed && !isReadyOrDone && !completed;

  // ── High-resolution prep progress (0 .. 100) ──
  const [prepProgress, setPrepProgress] = useState<number>(0);
  useEffect(() => {
    if (isReadyOrDone || completed) { setPrepProgress(100); return; }
    if (!confirmed) { setPrepProgress(0); return; }
    if (prepStartedAtRef.current == null) prepStartedAtRef.current = Date.now();
    const tick = () => {
      const elapsedMs = Date.now() - (prepStartedAtRef.current ?? Date.now());
      const p = (elapsedMs / (PREP_TOTAL_SEC * 1000)) * 100;
      setPrepProgress(Math.min(100, Math.max(0, p)));
    };
    tick();
    const id = setInterval(tick, 50);
    return () => clearInterval(id);
  }, [confirmed, isReadyOrDone, completed, PREP_TOTAL_SEC]);

  // ── Circular progress percentage ──
  const pct = (isReadyOrDone || completed) ? 100 : confirmed ? prepProgress : 8;

  // SVG ring geometry.
  const RING_SIZE   = 112;
  const RING_STROKE = 10;
  const RING_R      = (RING_SIZE - RING_STROKE) / 2;
  const RING_C      = 2 * Math.PI * RING_R;
  const ringDashOffset = RING_C * (1 - pct / 100);
  const isDoneState = isReadyOrDone || completed;
  const gradFrom  = isDoneState ? "#BBF7D0" : confirmed ? "#FFEFC9" : "#FFEFC9";
  const gradMid   = isDoneState ? "#4ADE80" : PRIMARY;
  const gradTo    = isDoneState ? "#22C55E" : "#FFD9A0";
  const glowColor = isDoneState ? SUCCESS : PRIMARY;

  // ── Countdown percentage shown inside the ring (99.99 → 99.98 → 99.97 …) ──
  const elapsedSec = PREP_TOTAL_SEC - secondsLeft;
  const countdownPct = Math.max(0, 99.99 - elapsedSec * 0.01);
  const pctLabel = `${countdownPct.toFixed(2)}%`;

  // ── Status pill text ──
  const pillText = useMemo(() => {
    if (completed)     return isAr ? "اكتمل" : "Done";
    if (isReadyOrDone) return isAr ? "جاهز للاستلام" : "Ready";
    if (confirmed)     return isAr ? "قيد التحضير" : "Preparing";
    return isAr ? "بانتظار التأكيد" : "Pending";
  }, [completed, isReadyOrDone, confirmed, isAr]);

  // ── Current-status card title + sub ──
  const statusTitle =
    completed       ? (isAr ? "تم الدفع — زاد مستواك 🎮" : "Paid — your level went up 🎮") :
    isReadyOrDone   ? (isAr ? "طلبك جاهز للاستلام" : "Your order is ready") :
    confirmed       ? (isAr ? "جاري تحضير طلبك" : "Preparing your order") :
                      (isAr ? "بانتظار تأكيد الكوفي" : "Waiting for cafe confirmation");
  const statusSub =
    completed       ? (isAr ? "تمت إضافة تقدّمك في اللعبة" : "Game progress added") :
    isReadyOrDone   ? (isAr ? "توجّه للكاشير لاستلامه" : "Head to the counter to pick it up") :
    confirmed       ? (isAr ? `سيكون جاهزاً خلال ${totalMin} دقيقة تقريباً` : `Ready in ~${totalMin} min`) :
                      (isAr ? "سيتم إشعارك فور قبول الطلب" : "You'll be notified once accepted");

  // ── Time / date helpers ──
  const fmtTime = (d: Date) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = isAr ? (h < 12 ? "ص" : "م") : (h < 12 ? "AM" : "PM");
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  const fmtDate = (d: Date) =>
    `${d.getDate()} ${(isAr ? AR_MONTHS : EN_MONTHS)[d.getMonth()]} ${d.getFullYear()}`;
  const orderDate  = new Date(startedAt);
  const pickupDate = new Date(startedAt + totalMin * 60 * 1000);

  // ── Navigation helpers ──
  const goBackToMenu = () => {
    if (cafeId) router.replace({ pathname: "/cafe/[id]/order", params: { id: cafeId } });
    else router.back();
  };
  const goCafe = () => { if (cafeId) router.push({ pathname: "/cafe/[id]", params: { id: cafeId } }); };
  const goHelp = () => { if (cafeId) router.push({ pathname: "/cafe/[id]/chat", params: { id: cafeId } }); };
  const goHub  = () => { setActiveOrder(null); router.replace("/(tabs)/game"); };

  // ── Auto-redirect to the Copointo hub once the order is paid/done ──
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!completed || redirectedRef.current) return;
    redirectedRef.current = true;
    playLevelUpSound();
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const t = setTimeout(() => { goHub(); }, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  // ── Step node ──
  const renderNode = (i: number) => {
    const s = STEPS[i];
    const reached  = i <= activeIdx;
    const current  = i === activeIdx;
    const scale    = current ? pulse.interpolate({ inputRange: [0,1], outputRange: [1, 1.1] }) : 1;
    const glow     = current ? pulse.interpolate({ inputRange: [0,1], outputRange: [0.35, 0.95] }) : 0;

    return (
      <View key={s.key} style={styles.iconCol}>
        <Animated.View
          style={[
            styles.nodeShadow,
            current && {
              opacity: glow,
              transform: [{ scale: current ? pulse.interpolate({ inputRange:[0,1], outputRange:[1, 1.4] }) : 1 }],
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
          <StepIcon
            kind={s.key}
            active={current}
            size={19}
            color={reached ? "#0B0604" : "rgba(245,230,204,0.5)"}
          />
          {reached && i < activeIdx && (
            <View style={styles.nodeCheck}>
              <Feather name="check" size={10} color="#0B0604" />
            </View>
          )}
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
        {current && <View style={styles.stepDot} />}
      </View>
    );
  };

  // ── Connector line fill fraction (centre of first → centre of active) ──
  const connectorFill = STEPS.length > 1 ? activeIdx / (STEPS.length - 1) : 0;

  // ── Empty state — neither nav params nor a persisted active order. ──
  if (!orderId) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)")} style={styles.iconBtn} activeOpacity={0.85}>
            <Feather name="arrow-right" size={20} color={CREAM} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{isAr ? "متابعة الطلب" : "Order status"}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIcon}>
            <Feather name="coffee" size={32} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>{isAr ? "لا يوجد طلب نشط" : "No active order"}</Text>
          <Text style={styles.emptySub}>
            {isAr ? "لم نجد طلباً قيد المتابعة الآن." : "We couldn't find an order to track right now."}
          </Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => router.replace("/(tabs)")} activeOpacity={0.88}>
            <LinearGradient
              colors={[PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>{isAr ? "العودة للرئيسية" : "Back to home"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: 0 }]}>
      {/* ── Toast banner ── */}
      {banner && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.bannerWrap, { top: topPad + 6, transform: [{ translateY: bannerY }] }]}
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

      {/* ── Header ── */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBackToMenu} style={styles.iconBtn} activeOpacity={0.85}>
          <Feather name="arrow-right" size={20} color={CREAM} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goCafe} activeOpacity={0.8} style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isAr ? "طلب" : "Order"} #{orderId ? orderId.slice(-6) : "------"}
          </Text>
          {!!cafeName && (
            <View style={styles.headerCafeRow}>
              <Text style={styles.headerCafe} numberOfLines={1}>{cafeName}</Text>
              <Feather name="chevron-left" size={14} color="rgba(245,230,204,0.55)" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={goHelp} style={styles.helpBtn} activeOpacity={0.85}>
          <Feather name="headphones" size={15} color={PRIMARY} />
          <Text style={styles.helpText}>{isAr ? "مساعدة" : "Help"}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Status badge ── */}
      <View style={styles.statusBadgeWrap}>
        <View style={[
          styles.statusBadge,
          completed     ? styles.statusBadgeDone :
          isReadyOrDone ? styles.statusBadgeDone : null,
        ]}>
          <View style={[
            styles.statusDot,
            completed     ? { backgroundColor: SUCCESS } :
            isReadyOrDone ? { backgroundColor: SUCCESS } :
            confirmed     ? { backgroundColor: PRIMARY } :
                            { backgroundColor: "rgba(245,230,204,0.55)" },
          ]} />
          <Text style={styles.statusBadgeText}>{pillText}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 5-step stepper ── */}
        <View style={styles.stepperCard}>
          <View style={styles.connectorWrap} pointerEvents="none">
            <View style={styles.connectorTrack} />
            <View style={[styles.connectorFill, { width: `${connectorFill * 100}%` }]} />
          </View>
          <View style={styles.iconsRow}>
            {STEPS.map((_, i) => renderNode(i))}
          </View>
        </View>

        {/* ── Current status card ── */}
        <View style={[
          styles.statusCard,
          timerActive && styles.statusCardActive,
          isDoneState && styles.statusCardDone,
        ]}>
          <View style={styles.statusCardHead}>
            <Text style={styles.statusCardHeadText}>{isAr ? "الحالة الحالية" : "Current status"}</Text>
            <View style={[styles.statusDot, { backgroundColor: isDoneState ? SUCCESS : PRIMARY }]} />
          </View>

          <View style={styles.statusCardBody}>
            <View style={styles.statusTextCol}>
              <Text style={styles.statusTitle}>{statusTitle}</Text>
              <Text style={styles.statusSub}>{statusSub}</Text>
            </View>

            <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" }}>
              <Svg width={RING_SIZE} height={RING_SIZE}>
                <Defs>
                  <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={gradFrom} />
                    <Stop offset="0.5" stopColor={gradMid} />
                    <Stop offset="1" stopColor={gradTo} />
                  </SvgGradient>
                </Defs>
                <Circle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                  stroke="rgba(245,230,204,0.08)" strokeWidth={RING_STROKE} fill="none"
                />
                <Circle
                  cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
                  stroke="url(#ringGrad)" strokeWidth={RING_STROKE} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${RING_C} ${RING_C}`}
                  strokeDashoffset={ringDashOffset}
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              </Svg>
              <View style={styles.ringCenter}>
                <Text style={styles.ringTop}>{isAr ? "نسبة الإنجاز" : "Progress"}</Text>
                <Text style={[styles.ringTime, isDoneState && { color: SUCCESS }]}>
                  {isDoneState ? (isAr ? "تم" : "Done") : pctLabel}
                </Text>
              </View>
            </View>
          </View>

          {!completed && (
            <View style={styles.noteBox}>
              <View style={styles.noteIcon}>
                <Feather name="bell" size={15} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>{isAr ? "نشكرك على صبرك" : "Thank you for your patience"}</Text>
                <Text style={styles.noteSub}>{isAr ? "سيتم تحضير طلبك بأفضل جودة" : "Your order will be prepared with the best quality"}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Order items ── */}
        {items.map((it, idx) => (
          <View key={`${it.name}-${idx}`} style={styles.itemCard}>
            <Feather name="coffee" size={84} color="rgba(232,184,109,0.05)" style={styles.itemWatermark} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
              <View style={styles.itemChips}>
                {!!it.selectedSize && (
                  <View style={styles.itemChip}><Text style={styles.itemChipText}>{it.selectedSize}</Text></View>
                )}
                <View style={styles.itemChip}><Text style={styles.itemChipText}>× {it.qty}</Text></View>
                {!!it.selectedBean && (
                  <View style={styles.itemChip}>
                    <Feather name="package" size={11} color={PRIMARY} />
                    <Text style={styles.itemChipText}>{it.selectedBean}</Text>
                  </View>
                )}
              </View>
              <View style={styles.itemPriceRow}>
                {!!it.originalPrice && it.originalPrice > it.price && (
                  <Text style={styles.itemPriceOld}>{(it.originalPrice * it.qty).toFixed(3)}</Text>
                )}
                <Text style={styles.itemPrice}>{(it.price * it.qty).toFixed(3)} {isAr ? "ر.ع" : "OMR"}</Text>
              </View>
            </View>
            <View style={styles.itemImageWrap}>
              {it.image ? (
                <Image source={{ uri: it.image }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={styles.itemImagePlaceholder}>
                  <Feather name="coffee" size={30} color={PRIMARY} />
                </View>
              )}
            </View>
          </View>
        ))}

        {/* ── Order total (when known and multiple items) ── */}
        {typeof orderTotal === "number" && items.length > 1 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>{isAr ? "الإجمالي" : "Total"}</Text>
            <Text style={styles.totalValue}>{orderTotal.toFixed(3)} {isAr ? "ر.ع" : "OMR"}</Text>
          </View>
        )}

        {/* ── Info chips ── */}
        <View style={styles.infoRow}>
          <View style={styles.infoChip}>
            <View style={styles.infoIcon}><Feather name="clock" size={14} color={PRIMARY} /></View>
            <Text style={styles.infoLabel}>{isAr ? "وقت الطلب" : "Order time"}</Text>
            <Text style={styles.infoValue}>{fmtTime(orderDate)}</Text>
            <Text style={styles.infoDate}>{fmtDate(orderDate)}</Text>
          </View>
          <View style={styles.infoChip}>
            <View style={styles.infoIcon}><Feather name="check-circle" size={14} color={SUCCESS} /></View>
            <Text style={styles.infoLabel}>{isAr ? "الاستلام المتوقع" : "Est. pickup"}</Text>
            <Text style={styles.infoValue}>{fmtTime(pickupDate)}</Text>
            <Text style={styles.infoDate}>{fmtDate(pickupDate)}</Text>
          </View>
          <View style={styles.infoChip}>
            <View style={styles.infoIcon}><Feather name="shopping-bag" size={14} color={PRIMARY} /></View>
            <Text style={styles.infoLabel}>{isAr ? "طريقة الاستلام" : "Pickup"}</Text>
            <Text style={styles.infoValue}>
              {pickupType === "car"
                ? (isAr ? "للسيارة" : "Car")
                : (isAr ? "من الكوفي" : "In-store")}
            </Text>
            <Text style={styles.infoDate}>
              {pickupType === "car"
                ? (rich?.plateNumber ? `${rich.plateNumber} ${rich.plateSymbol ?? ""}`.trim() : (isAr ? "خدمة السيارة" : "Car service"))
                : (rich?.tableNumber ? `${isAr ? "طاولة" : "Table"} ${rich.tableNumber}` : (isAr ? "داخل الكوفي" : "Inside cafe"))}
            </Text>
          </View>
        </View>

        {/* ── Level-up reward (after payment) ── */}
        {completed && (
          <LinearGradient
            colors={[PRIMARY, "#C9985A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pointsBox}
          >
            <Text style={styles.pointsIcon}>🎮</Text>
            <View>
              <Text style={styles.pointsLabel}>{isAr ? "زاد مستواك في اللعبة" : "Your game level went up"}</Text>
              <Text style={styles.pointsValue}>
                {isAr
                  ? `+${pointsAwarded} ${pointsAwarded === 1 ? "مستوى" : "مستويات"}`
                  : `+${pointsAwarded} level${pointsAwarded === 1 ? "" : "s"}`}
              </Text>
            </View>
          </LinearGradient>
        )}

        {completed ? (
          <TouchableOpacity style={styles.cta} onPress={goHub} activeOpacity={0.88}>
            <LinearGradient
              colors={[PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.ctaGrad}
            >
              <Text style={styles.ctaText}>{isAr ? "اذهب إلى كوبوينتو هَب 🎮" : "Go to Copointo Hub 🎮"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <Text style={styles.tip}>
            {isAr
              ? "اترك الشاشة مفتوحة — ستتحدّث الحالة تلقائياً مع كل خطوة."
              : "Keep this screen open — the status updates with every step."}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // ── Header ──
  headerRow: {
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: CREAM, letterSpacing: 0.3 },
  headerCafeRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  headerCafe: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.7)", maxWidth: 160 },
  helpBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, paddingVertical: 8,
    borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD,
  },
  helpText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: PRIMARY },

  // ── Status badge ──
  statusBadgeWrap: { alignItems: "center", paddingBottom: 6 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: "rgba(232,184,109,0.1)",
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
  },
  statusBadgeDone: { borderColor: "rgba(74,222,128,0.45)", backgroundColor: "rgba(74,222,128,0.1)" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  statusBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: CREAM },

  scrollContent: { paddingHorizontal: 16, paddingTop: 6, gap: 10 },

  // ── Stepper ──
  stepperCard: {
    backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingTop: 18, paddingBottom: 12,
    position: "relative",
  },
  connectorWrap: {
    position: "absolute",
    left: 14 + 28, right: 14 + 28, // inset ≈ half a node column so it spans node centres
    top: 18 + 19, // align to node vertical centre (paddingTop + half node)
    height: 2,
  },
  connectorTrack: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(232,184,109,0.18)", borderRadius: 1 },
  connectorFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: PRIMARY, borderRadius: 1 },
  iconsRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  iconCol: { flex: 1, alignItems: "center", gap: 7 },
  nodeShadow: {
    position: "absolute", top: -4,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(232,184,109,0.35)",
  },
  node: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5,
  },
  nodeIdle: { backgroundColor: "#0A0606", borderColor: "rgba(232,184,109,0.3)" },
  nodeReached: {
    backgroundColor: PRIMARY, borderColor: "#FFD9A0",
    shadowColor: PRIMARY, shadowOpacity: 0.55, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  },
  nodeCheck: {
    position: "absolute", bottom: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: SUCCESS, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: CARD,
  },
  stepLabel: {
    fontSize: 10, fontFamily: "Inter_500Medium",
    color: "rgba(245,230,204,0.45)", textAlign: "center",
    lineHeight: 13, minHeight: 26,
  },
  stepLabelReached: { color: CREAM, fontFamily: "Inter_600SemiBold" },
  stepLabelCurrent: { color: PRIMARY, fontFamily: "Inter_700Bold" },
  stepDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: PRIMARY, marginTop: -2 },

  // ── Current status card ──
  statusCard: {
    backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    padding: 13,
  },
  statusCardActive: {
    borderColor: "rgba(232,184,109,0.5)",
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  statusCardDone: { borderColor: "rgba(74,222,128,0.45)" },
  statusCardHead: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 7, marginBottom: 6 },
  statusCardHeadText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: SUCCESS },
  statusCardBody: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusTextCol: { flex: 1, gap: 6 },
  statusTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: CREAM, lineHeight: 22, textAlign: "right" },
  statusSub: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.6)", lineHeight: 18, textAlign: "right" },

  ringCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ringTop: { fontSize: 10, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.6)" },
  ringTime: {
    fontSize: 21, lineHeight: 26, fontFamily: "Inter_700Bold", color: PRIMARY,
    fontVariant: ["tabular-nums"], letterSpacing: 0.5,
    textShadowColor: "rgba(232,184,109,0.6)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12,
  },
  noteBox: {
    flexDirection: "row", alignItems: "center", gap: 11,
    marginTop: 10, padding: 10,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(232,184,109,0.18)",
    backgroundColor: "rgba(232,184,109,0.05)",
  },
  noteIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.12)", borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
  },
  noteTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "right" },
  noteSub: { fontSize: 11.5, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.55)", marginTop: 2, textAlign: "right" },

  // ── Order item ──
  itemCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    padding: 12, overflow: "hidden",
  },
  itemWatermark: { position: "absolute", left: -14, bottom: -18 },
  itemInfo: { flex: 1, gap: 7 },
  itemName: { fontSize: 15.5, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "right" },
  itemChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" },
  itemChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 9, backgroundColor: "rgba(232,184,109,0.1)", borderWidth: 1, borderColor: "rgba(232,184,109,0.2)",
  },
  itemChipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.8)" },
  itemPriceRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  itemPrice: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  itemPriceOld: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.4)", textDecorationLine: "line-through" },
  itemImageWrap: { width: 72, height: 72, borderRadius: 14, overflow: "hidden" },
  itemImage: { width: "100%", height: "100%" },
  itemImagePlaceholder: {
    width: "100%", height: "100%", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.08)", borderWidth: 1, borderColor: BORDER, borderRadius: 14,
  },

  totalCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  totalLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.6)" },
  totalValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },

  // ── Info chips row ──
  infoRow: { flexDirection: "row", gap: 9 },
  infoChip: {
    flex: 1, alignItems: "center", gap: 4,
    backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 6, paddingVertical: 9,
  },
  infoIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.1)", borderWidth: 1, borderColor: "rgba(232,184,109,0.2)", marginBottom: 2,
  },
  infoLabel: { fontSize: 9.5, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.5)", textAlign: "center" },
  infoValue: { fontSize: 12.5, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "center" },
  infoDate: { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center" },

  // ── Reward + CTA ──
  pointsBox: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 15, borderRadius: 18 },
  pointsIcon: { fontSize: 30 },
  pointsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(0,0,0,0.6)" },
  pointsValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },

  cta: { width: "100%", borderRadius: 16, overflow: "hidden" },
  ctaGrad: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  ctaText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },

  tip: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center", lineHeight: 18, marginTop: 2 },

  // ── Empty state ──
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 12 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.08)", borderWidth: 1, borderColor: BORDER, marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: CREAM, textAlign: "center" },
  emptySub: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.55)", textAlign: "center", lineHeight: 19, marginBottom: 8 },
  emptyBtn: { width: "100%", borderRadius: 16, overflow: "hidden" },

  // ── Toast banner ──
  bannerWrap: { position: "absolute", left: 12, right: 12, zIndex: 100, elevation: 12 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1,
    backgroundColor: "rgba(15,8,4,0.96)",
    shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  bannerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  bannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: CREAM },
  bannerSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.7)", marginTop: 2, lineHeight: 16 },
  bannerClose: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14 },
});
