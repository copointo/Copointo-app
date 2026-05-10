import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

function makeLevelsLabel(t: (k: string, p?: Record<string, string | number>) => string) {
  return (n: number): string => {
    if (n === 1) return t("timer.levelsOne");
    if (n === 2) return t("timer.levelsTwo");
    if (n >= 3 && n <= 10) return t("timer.levelsFew", { n });
    return t("timer.levelsMany", { n });
  };
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
  const { user, setActiveOrder, addCafeOrder } = useApp();
  const { t } = useT();
  const levelsLabel = makeLevelsLabel(t);
  const params = useLocalSearchParams<{
    orderId: string; cafeId: string; cafeName?: string; minutes: string; drinks: string;
  }>();
  const orderId   = params.orderId;
  const cafeId    = params.cafeId;
  const cafeName  = params.cafeName ?? "";
  const totalMin  = Math.max(1, Number(params.minutes ?? "3"));
  const drinkQty  = Math.max(1, Number(params.drinks  ?? "1"));

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // 100.0 → 0.0 in 0.1 decrements over (totalMin × 60s)
  const [progress, setProgress] = useState(100.0);
  const [order,    setOrder]    = useState<ServerOrder | null>(null);
  const [confirmed,setConfirmed]= useState(false); // manager moved out of pending
  const [completed,setCompleted]= useState(false); // manager pressed print → final
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const awardedRef = useRef(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Pulsing ring animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Countdown ticker — totalMin*60s split into 1000 ticks of 0.1.
  // Stops as soon as the order is `ready` (manager pressed "طلبك جاهز")
  // or `done` (manager printed the invoice). We also force progress → 0
  // when the order reaches "ready" so the ring shows the order is fulfilled
  // even if the simulated countdown hadn't reached zero yet.
  const isReadyOrDone = order?.status === "ready" || order?.status === "done";
  useEffect(() => {
    if (completed || isReadyOrDone) return;
    const tickMs = (totalMin * 60 * 1000) / 1000; // ms per 0.1 step
    const id = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) { clearInterval(id); return 0; }
        return +(p - 0.1).toFixed(1);
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [totalMin, completed, isReadyOrDone]);

  // Snap progress to 0 the moment the order becomes ready.
  useEffect(() => {
    if (isReadyOrDone) setProgress(0);
  }, [isReadyOrDone]);

  // Poll server every 4s for status + pointsAwarded
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
          // Manager confirmed → award per-café progress (drink count) immediately.
          awardedRef.current = true;
          setPointsAwarded(drinkQty);
          if (user) {
            addCafeOrder(cafeId, cafeName, drinkQty);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        // Only switch to the "completed" screen when the order is fully done
        // (manager printed / status === "done").
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

  const ringScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const ringOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  // ── Completed (final) view — shown after manager prints invoice ──
  if (completed) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.center}>
          <View style={styles.successIcon}>
            <Text style={{ fontSize: 64 }}>✅</Text>
          </View>
          <Text style={styles.successTitle}>{t("timer.successTitle")}</Text>
          <Text style={styles.successSub}>
            {order?.type === "dine"
              ? t("timer.successSubDine", { table: order.tableNumber ?? "" })
              : t("timer.successSubCar", { plateNum: order?.plateNumber ?? "", plateSym: order?.plateSymbol ?? "" })}
          </Text>

          <LinearGradient
            colors={[PRIMARY, "#C9985A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pointsBox}
          >
            <Text style={styles.pointsIcon}>🎮</Text>
            <View>
              <Text style={styles.pointsLabel}>{t("timer.gameProgress")}</Text>
              <Text style={styles.pointsValue}>{levelsLabel(pointsAwarded)}</Text>
            </View>
          </LinearGradient>

          <TouchableOpacity
            style={[styles.btn, { marginTop: 8 }]}
            onPress={() => { setActiveOrder(null); router.replace("/(tabs)"); }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{t("timer.backHome")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Countdown view ──
  const goBackToMenu = () => {
    if (cafeId) router.replace({ pathname: "/cafe/[id]/order", params: { id: cafeId } });
    else router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBackToMenu} style={styles.backBtn} activeOpacity={0.85}>
          <Feather name="arrow-right" size={18} color={CREAM} />
          <Text style={styles.backBtnText}>{t("timer.headerMenuBack")}</Text>
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, (confirmed || isReadyOrDone) && { backgroundColor: SUCCESS }]} />
          <Text style={styles.statusText}>
            {isReadyOrDone ? t("timer.pillReady") : confirmed ? t("timer.pillPreparing") : t("timer.pillPending")}
          </Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.ringLabel}>{t("timer.ringLabel")}</Text>

        <View style={styles.ringWrap}>
          {/* Pulse ring */}
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          {/* Outer ring */}
          <LinearGradient
            colors={[PRIMARY, "#7A4F1F"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.outerRing}
          >
            <View style={styles.innerRing}>
              <Text style={styles.percentBig}>
                {progress.toFixed(1)}
              </Text>
              <Text style={styles.percentSign}>%</Text>
            </View>
          </LinearGradient>
        </View>

        <Text style={styles.subline}>
          {isReadyOrDone
            ? t("timer.subReady")
            : progress > 0
              ? t("timer.subPreparing", { min: Math.ceil((progress / 100) * totalMin) })
              : t("timer.subWaiting")}
        </Text>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Feather name="hash" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{t("timer.detailOrderId")}</Text>
            <Text style={styles.detailValue}>#{orderId?.slice(-6)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="coffee" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{t("timer.detailDrinks")}</Text>
            <Text style={styles.detailValue}>{drinkQty}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>{t("timer.detailPrepTime")}</Text>
            <Text style={styles.detailValue}>{t("timer.minuteUnit", { n: totalMin })}</Text>
          </View>
        </View>

        <Text style={styles.tip}>
          {t("timer.tip")}
        </Text>
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

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, gap: 18 },

  ringLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.55)" },
  ringWrap: { width: 240, height: 240, alignItems: "center", justifyContent: "center", marginVertical: 6 },
  pulseRing: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    borderWidth: 2, borderColor: PRIMARY,
  },
  outerRing: {
    width: 220, height: 220, borderRadius: 110,
    alignItems: "center", justifyContent: "center",
    padding: 6,
  },
  innerRing: {
    width: 208, height: 208, borderRadius: 104,
    backgroundColor: "#0A0606",
    alignItems: "center", justifyContent: "center",
    flexDirection: "row",
  },
  percentBig: { fontSize: 64, fontFamily: "Inter_700Bold", color: PRIMARY, lineHeight: 72 },
  percentSign:{ fontSize: 28, fontFamily: "Inter_700Bold", color: "rgba(232,184,109,0.55)", marginLeft: 4, marginTop: 8 },

  subline: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.7)", textAlign: "center" },

  detailsBox: {
    width: "100%", backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10,
  },
  detailRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  detailLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.55)" },
  detailValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: CREAM },
  divider:     { height: 1, backgroundColor: BORDER },

  tip: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center", lineHeight: 18 },

  // Success view
  successIcon: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderWidth: 1, borderColor: "rgba(74,222,128,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  successTitle: { fontSize: 26, fontFamily: "Inter_700Bold", color: SUCCESS },
  successSub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.7)", textAlign: "center", lineHeight: 22 },

  pointsBox: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 22, paddingVertical: 16,
    borderRadius: 18, marginTop: 6,
  },
  pointsIcon:  { fontSize: 32 },
  pointsLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(0,0,0,0.6)" },
  pointsValue: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },

  btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: BORDER },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: CREAM },
});
