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
import { apiFetch } from "@/constants/api";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const CREAM   = "#F5E6CC";
const SUCCESS = "#4ADE80";

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

  // Countdown ticker — totalMin*60s split into 1000 ticks of 0.1
  useEffect(() => {
    if (completed) return;
    const tickMs = (totalMin * 60 * 1000) / 1000; // ms per 0.1 step
    const id = setInterval(() => {
      setProgress((p) => {
        if (p <= 0) { clearInterval(id); return 0; }
        return +(p - 0.1).toFixed(1);
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [totalMin, completed]);

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
        if (data.order.pointsAwarded) {
          // Manager printed invoice → award per-café progress + show final screen.
          setCompleted(true);
          setPointsAwarded(drinkQty);
          if (user) {
            addCafeOrder(cafeId, cafeName, drinkQty);
          }
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
          <Text style={styles.successTitle}>انتهاء تحضير طلبك</Text>
          <Text style={styles.successSub}>
            سوف تستلمه الآن{"\n"}
            {order?.type === "dine"
              ? `على الطاولة رقم ${order.tableNumber}`
              : `إلى سيارتك (${order?.plateNumber} ${order?.plateSymbol})`}
          </Text>

          <LinearGradient
            colors={[PRIMARY, "#C9985A"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.pointsBox}
          >
            <Text style={styles.pointsIcon}>🎮</Text>
            <View>
              <Text style={styles.pointsLabel}>تقدم في اللعبة</Text>
              <Text style={styles.pointsValue}>+{pointsAwarded} مشروب  •  +{pointsAwarded * 10} نقطة</Text>
            </View>
          </LinearGradient>

          <TouchableOpacity
            style={[styles.btn, { marginTop: 8 }]}
            onPress={() => { setActiveOrder(null); router.replace("/(tabs)"); }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>العودة للرئيسية</Text>
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
          <Text style={styles.backBtnText}>القائمة</Text>
        </TouchableOpacity>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, confirmed && { backgroundColor: SUCCESS }]} />
          <Text style={styles.statusText}>{confirmed ? "قيد التحضير" : "قيد الانتظار"}</Text>
        </View>
      </View>

      <View style={styles.center}>
        <Text style={styles.ringLabel}>جهازية الطلب</Text>

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
          {progress > 0
            ? `سيتم تحضير طلبك خلال ${Math.ceil((progress / 100) * totalMin)} دقيقة تقريباً`
            : "في انتظار تأكيد الكوفي..."}
        </Text>

        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <Feather name="hash" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>رقم الطلب</Text>
            <Text style={styles.detailValue}>#{orderId?.slice(-6)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="coffee" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>عدد المشروبات</Text>
            <Text style={styles.detailValue}>{drinkQty}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Feather name="clock" size={14} color={PRIMARY} />
            <Text style={styles.detailLabel}>مدة التحضير</Text>
            <Text style={styles.detailValue}>{totalMin} دقيقة</Text>
          </View>
        </View>

        <Text style={styles.tip}>
          ⏳  سيظهر طلبك للكوفي مباشرة. ستتقدم في اللعبة بمجرد بدء التحضير.
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
