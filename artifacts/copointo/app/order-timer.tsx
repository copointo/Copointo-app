import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { apiFetch } from "@/constants/api";

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

  // ── Bar fill (0 .. 1) ──
  // Smoothly progresses across the 4 step centres. While the order is
  // being prepared the bar advances linearly with the prep-minutes timer
  // (from step 2 centre toward — but not past — step 3 centre) so the
  // customer sees real-time progress without the bar ever jumping back.
  const fillAnim = useRef(new Animated.Value(STEPS[0].pos)).current;
  useEffect(() => {
    if (completed) {
      Animated.timing(fillAnim, {
        toValue: STEPS[3].pos,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    if (isReadyOrDone) {
      Animated.timing(fillAnim, {
        toValue: STEPS[2].pos,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    if (confirmed) {
      // Jump to step 2 centre, then crawl to just before step 3 centre
      // over the full prep-time so the bar appears to "fill" with time.
      Animated.sequence([
        Animated.timing(fillAnim, {
          toValue: STEPS[1].pos,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(fillAnim, {
          toValue: STEPS[2].pos - 0.03, // stop just shy of step 3
          duration: Math.max(2000, totalMin * 60 * 1000),
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]).start();
      return;
    }
    // Pending — sit at step 1.
    Animated.timing(fillAnim, {
      toValue: STEPS[0].pos,
      duration: 400,
      useNativeDriver: false,
    }).start();
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (data.order.pointsAwarded && !awardedRef.current) {
          awardedRef.current = true;
          setPointsAwarded(drinkQty);
          if (user && drinkQty > 0) {
            addCafeOrder(cafeId, cafeName, drinkQty);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        if (data.order.status === "done" && !completed) {
          setCompleted(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {/* ignore transient */}
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, cafeId, completed, confirmed, drinkQty]);

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
});
