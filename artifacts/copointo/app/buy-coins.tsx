import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { createPaymentSession, getPaymentStatus } from "../constants/api";
import { useApp } from "../context/AppContext";
import { useCoins } from "../hooks/useCoins";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

interface Pack {
  id: string;
  coins: number;
  price: number;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  badge?: string;
}

const PACKS: Pack[] = [
  { id: "p1", coins: 200,   price: 0.99,  tier: 1 },
  { id: "p2", coins: 1200,  price: 4.99,  tier: 2 },
  { id: "p3", coins: 2800,  price: 9.99,  tier: 3, badge: "الأكثر شعبية" },
  { id: "p4", coins: 6200,  price: 19.99, tier: 4 },
  { id: "p5", coins: 13500, price: 49.99, tier: 5, badge: "أفضل قيمة" },
  { id: "p6", coins: 35000, price: 99.99, tier: 6 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

// A growing pile/stack of coins per tier
function CoinVisual({ tier }: { tier: Pack["tier"] }) {
  const cfg = {
    1: { size: 56, glow: "rgba(232,184,109,0.35)", coins: [{ x: 0, y: 0, s: 1 }] },
    2: { size: 56, glow: "rgba(232,184,109,0.45)", coins: [
      { x: -10, y: 6,  s: 0.85 },
      { x:  8,  y: -2, s: 1 },
    ] },
    3: { size: 56, glow: "rgba(255,200,120,0.55)", coins: [
      { x: -16, y: 8,  s: 0.8 },
      { x:  14, y: 8,  s: 0.8 },
      { x:  -2, y: -6, s: 1 },
    ] },
    4: { size: 56, glow: "rgba(255,200,120,0.65)", coins: [
      { x: -20, y: 12, s: 0.78 },
      { x:   0, y: 14, s: 0.82 },
      { x:  20, y: 12, s: 0.78 },
      { x:  -2, y: -6, s: 1.02 },
    ] },
    5: { size: 58, glow: "rgba(255,215,140,0.8)",  coins: [
      { x: -22, y: 14, s: 0.72 },
      { x:  -7, y: 16, s: 0.78 },
      { x:   8, y: 16, s: 0.78 },
      { x:  22, y: 14, s: 0.72 },
      { x:  -8, y:  0, s: 0.92 },
      { x:   8, y: -8, s: 1.05 },
    ] },
    6: { size: 60, glow: "rgba(255,225,160,1)",   coins: [
      { x: -26, y: 18, s: 0.7 },
      { x: -10, y: 20, s: 0.75 },
      { x:   8, y: 20, s: 0.75 },
      { x:  26, y: 18, s: 0.7 },
      { x: -16, y:  4, s: 0.88 },
      { x:   2, y:  6, s: 0.92 },
      { x:  18, y:  2, s: 0.88 },
      { x:  -2, y: -14, s: 1.12 },
    ] },
  }[tier];

  return (
    <View style={visualStyles.wrap}>
      <View style={[visualStyles.glow, { backgroundColor: cfg.glow }]} />
      {cfg.coins.map((c, i) => (
        <Image
          key={i}
          source={COPOINTO_COIN}
          style={{
            position: "absolute",
            width: cfg.size * c.s,
            height: cfg.size * c.s,
            transform: [{ translateX: c.x }, { translateY: c.y }],
            resizeMode: "contain",
          }}
        />
      ))}
    </View>
  );
}

const visualStyles = StyleSheet.create({
  wrap: {
    width: 110, height: 90,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  glow: {
    position: "absolute",
    width: 90, height: 90, borderRadius: 45,
    opacity: 0.55,
  },
});

function AnimatedTile({ p, index, busy, onPress }: { p: Pack; index: number; busy?: boolean; onPress: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 110;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 420, delay, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 520, delay,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1, delay, friction: 6, tension: 80, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(delay + 200),
        Animated.timing(glow, {
          toValue: 1, duration: 350, useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0.4, duration: 600, useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [index, opacity, translateY, scale, glow]);

  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.85] });
  const shadowRadius = glow.interpolate({ inputRange: [0, 1], outputRange: [10, 22] });

  return (
    <Animated.View style={{
      width: "48%",
      opacity,
      transform: [{ translateY }, { scale }],
    }}>
      <Animated.View style={[styles.tile, { shadowOpacity, shadowRadius }]}>
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={busy} style={styles.tileTouch}>
          {p.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{p.badge}</Text>
            </View>
          ) : null}
          <CoinVisual tier={p.tier} />
          <View style={styles.coinsRow}>
            <Text style={styles.coinsText}>{fmt(p.coins)}</Text>
            <Text style={styles.coinsLabel}>عملة</Text>
          </View>
          <View style={styles.priceBtn}>
            {busy ? (
              <ActivityIndicator color={PRIMARY} size="small" />
            ) : (
              <Text style={styles.priceText}>{p.price.toFixed(3)} ر.ع</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

interface Checkout {
  url: string;
  paymentId: string;
  token: string;
  coins: number;
}

export function BuyCoinsPanel() {
  const { addCoins } = useCoins();
  const { user } = useApp();
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslate = useRef(new Animated.Value(-10)).current;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [verifying, setVerifying] = useState(false);
  const pollCancel = useRef(false);
  // Idempotency guards: never credit the same payment twice, never run two
  // polling loops for the same payment, and only handle each checkout-close once.
  const activePoll = useRef<string | null>(null);
  const credited = useRef<Set<string>>(new Set());
  const checkoutClosing = useRef(false);

  // Credit coins for a payment at most once, even across multiple poll ticks or
  // a return-handler + manual-close race. Returns true only on the first credit.
  const creditOnce = async (paymentId: string, coins: number): Promise<boolean> => {
    if (credited.current.has(paymentId)) return false;
    credited.current.add(paymentId);
    await addCoins(coins);
    return true;
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(introTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [introOpacity, introTranslate]);

  // Stop any in-flight polling if the screen unmounts.
  useEffect(() => () => { pollCancel.current = true; }, []);

  // Poll the server (authoritative — it re-confirms with OMPay) until the
  // payment reaches a terminal state, then credit coins on success.
  // `abortOnFailure`: on native we only poll AFTER the shopper returns from the
  // hosted page, so a terminal "failed"/"canceled" is genuine → stop. On web we
  // poll while the checkout tab is still open, where a fresh unpaid order can
  // report "failed" → keep polling (false) until "paid" or the deadline.
  const startPolling = async (
    paymentId: string,
    token: string,
    coins: number,
    abortOnFailure = true,
  ) => {
    if (activePoll.current === paymentId) return; // a loop is already running
    activePoll.current = paymentId;
    pollCancel.current = false;
    setVerifying(true);
    const deadline = Date.now() + 4 * 60 * 1000;
    const stop = () => { activePoll.current = null; };
    while (!pollCancel.current && Date.now() < deadline) {
      let status: string | undefined;
      try {
        const st = await getPaymentStatus(paymentId, token);
        status = st.status;
      } catch {
        // transient network error — keep polling
      }
      if (pollCancel.current) return stop();
      if (status === "paid") {
        const didCredit = await creditOnce(paymentId, coins);
        setVerifying(false);
        setBusyId(null);
        if (didCredit) {
          Alert.alert("تم الدفع ✅", `تم إضافة ${fmt(coins)} عملة إلى رصيدك.`);
        }
        return stop();
      }
      if (abortOnFailure && (status === "failed" || status === "canceled")) {
        setVerifying(false);
        setBusyId(null);
        Alert.alert(
          "لم تتم العملية",
          status === "canceled" ? "تم إلغاء عملية الدفع." : "فشلت عملية الدفع، لم يتم خصم أي مبلغ.",
        );
        return stop();
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    stop();
    if (!pollCancel.current) {
      setVerifying(false);
      setBusyId(null);
      Alert.alert(
        "انتهت المهلة",
        "لم نتمكّن من تأكيد الدفع. إذا تم خصم المبلغ فسيُضاف رصيدك تلقائياً، أو حاول مرة أخرى.",
      );
    }
  };

  const handleBuy = async (p: Pack) => {
    if (busyId) return;
    setBusyId(p.id);
    try {
      const { payment, token } = await createPaymentSession({
        purpose: "coins",
        amount: p.price,
        description: `شراء ${fmt(p.coins)} عملة Copointo`,
        userId: user?.id ?? null,
        customerName: user?.name ?? null,
        customerPhone: user?.phone ?? null,
        customerEmail: user?.email ?? null,
        metadata: { coins: p.coins, packId: p.id },
      });
      if (!payment.checkoutUrl) throw new Error("تعذّر فتح صفحة الدفع");

      if (Platform.OS === "web") {
        // On web the hosted checkout opens in a new tab; we can't observe its
        // navigation, so poll through transient "failed" states (abortOnFailure=false).
        if (typeof window !== "undefined") window.open(payment.checkoutUrl, "_blank");
        startPolling(payment.id, token, p.coins, false);
      } else {
        checkoutClosing.current = false;
        setCheckout({ url: payment.checkoutUrl, paymentId: payment.id, token, coins: p.coins });
      }
    } catch (e: any) {
      setBusyId(null);
      Alert.alert("تعذّر الدفع", String(e?.message ?? e));
    }
  };

  // Called when the WebView reaches the return page (reachedReturn=true) or the
  // shopper closes it manually (reachedReturn=false).
  const closeCheckout = async (reachedReturn: boolean) => {
    const c = checkout;
    if (!c) return;
    // onNavigationStateChange can fire repeatedly for the return URL; handle the
    // close exactly once per checkout session.
    if (checkoutClosing.current) return;
    checkoutClosing.current = true;
    setCheckout(null);
    if (reachedReturn) {
      startPolling(c.paymentId, c.token, c.coins, true);
      return;
    }
    // Manual close: do a single status check (covers "paid then closed") but
    // don't spin the full poll/timeout if they simply backed out.
    setVerifying(true);
    try {
      const st = await getPaymentStatus(c.paymentId, c.token);
      if (st.status === "paid" && (await creditOnce(c.paymentId, c.coins))) {
        Alert.alert("تم الدفع ✅", `تم إضافة ${fmt(c.coins)} عملة إلى رصيدك.`);
      }
    } catch {
      // ignore — nothing credited
    }
    setVerifying(false);
    setBusyId(null);
  };

  return (
    <View>
      <Animated.Text style={[styles.intro, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        اختر الباقة المناسبة لك واحصل على عملات Copointo فوراً
      </Animated.Text>
      <View style={styles.grid}>
        {PACKS.map((p, i) => (
          <AnimatedTile key={p.id} p={p} index={i} busy={busyId === p.id} onPress={() => handleBuy(p)} />
        ))}
      </View>

      {/* In-app hosted-checkout (native) */}
      <Modal visible={!!checkout} animationType="slide" onRequestClose={() => closeCheckout(false)}>
        <View style={styles.webWrap}>
          <View style={styles.webHeader}>
            <TouchableOpacity style={styles.webClose} onPress={() => closeCheckout(false)}>
              <Feather name="x" size={22} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.webTitle}>الدفع الآمن</Text>
            <View style={{ width: 36 }} />
          </View>
          {checkout ? (
            <WebView
              source={{ uri: checkout.url }}
              style={{ flex: 1, backgroundColor: "#000" }}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={PRIMARY} size="large" />
                </View>
              )}
              onNavigationStateChange={(nav) => {
                if (nav.url && nav.url.includes("/payments/return")) {
                  closeCheckout(true);
                }
              }}
            />
          ) : null}
        </View>
      </Modal>

      {/* Verifying overlay (both platforms) */}
      <Modal visible={verifying} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <ActivityIndicator color={PRIMARY} size="large" />
            <Text style={styles.verifyText}>جارٍ تأكيد الدفع…</Text>
            <Text style={styles.verifySub}>لا تغلق التطبيق</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function BuyCoinsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { balance } = useCoins();

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>شراء عملات Copointo</Text>
        <View style={styles.balancePanel}>
          <Image source={COPOINTO_COIN} style={styles.balanceCoin} />
          <Text style={styles.balanceText}>{fmt(balance)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BuyCoinsPanel />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    transform: [{ scaleX: -1 }],
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },

  balancePanel: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: PRIMARY,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    minWidth: 72, justifyContent: "center",
  },
  balanceCoin: { width: 18, height: 18, resizeMode: "contain" },
  balanceText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },

  scroll: { padding: 20, paddingBottom: 60 },
  intro: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)", textAlign: "center",
    marginBottom: 18, lineHeight: 20,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  tile: {
    backgroundColor: "#0A0606",
    borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
  },
  tileTouch: { padding: 14, paddingTop: 18, alignItems: "center" },
  badge: {
    position: "absolute", top: -8, alignSelf: "center",
    backgroundColor: PRIMARY,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, zIndex: 2,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },

  coinImg: { width: 70, height: 70, resizeMode: "contain", marginBottom: 8 },
  coinsRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 12 },
  coinsText: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  coinsLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },

  priceBtn: {
    width: "100%",
    paddingVertical: 9, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: PRIMARY,
    alignItems: "center",
  },
  priceText: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  webWrap: { flex: 1, backgroundColor: "#000" },
  webHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingTop: Platform.OS === "web" ? 12 : 52, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: "#0A0606",
  },
  webClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  webTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  webLoading: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },

  verifyOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  verifyCard: {
    backgroundColor: "#0A0606", borderRadius: 18, borderWidth: 1, borderColor: PRIMARY,
    paddingVertical: 28, paddingHorizontal: 36, alignItems: "center", gap: 12,
  },
  verifyText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  verifySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
});
