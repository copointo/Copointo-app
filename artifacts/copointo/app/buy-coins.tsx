import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createPaymentSession, getPaymentStatus, validateCopointoCode, redeemCopointoCode } from "../constants/api";
import { useApp } from "../context/AppContext";
import { useCoins } from "../hooks/useCoins";
import { coinsForPackage, useSubscription, type PurchasesPackage } from "../lib/revenuecat";

// iOS/Android must sell coins through Apple/Google IAP (App Store guideline
// 3.1.1). Web keeps the existing OMPay card checkout.
const IS_WEB = Platform.OS === "web";

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
  { id: "p1", coins: 500,   price: 0.99,  tier: 1 },
  { id: "p2", coins: 1500,  price: 4.99,  tier: 2 },
  { id: "p3", coins: 4500,  price: 9.99,  tier: 3, badge: "الأكثر شعبية" },
  { id: "p4", coins: 12500, price: 19.99, tier: 4 },
  { id: "p5", coins: 30000, price: 49.99, tier: 5, badge: "أفضل قيمة" },
  { id: "p6", coins: 80000, price: 99.99, tier: 6 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

// Prices are shown in USD in the app, but OMPay charges in Omani Rial. Convert
// the USD price to OMR (rounded to 3 decimals / baisa) before sending it to the
// gateway so checkout shows e.g. 0.380 ﷼ for $0.99. Adjust the rate here if the
// peg changes (1 USD ≈ 0.384 OMR).
const USD_TO_OMR = 0.384;
const usdToOmr = (usd: number) => Math.round(usd * USD_TO_OMR * 1000) / 1000;
const fmtOmr = (omr: number) => omr.toFixed(3);

// Copointo Code: a valid per-cafe code grants the buyer +20% bonus coins at the
// SAME price. Coins are credited on-device, so the bonus is applied here at
// credit time; the server independently recomputes it for the cafe's 10%
// commission ledger. Keep this in lockstep with COPOINTO_CODE_BONUS_RATE on the
// server.
const CODE_BONUS_RATE = 0.20;
const codeBonusCoins = (base: number) => Math.round(base * CODE_BONUS_RATE);

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

function AnimatedTile({ p, index, busy, onPress, priceLabel, disabled }: { p: Pack; index: number; busy?: boolean; onPress: () => void; priceLabel?: string; disabled?: boolean }) {
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
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} disabled={busy || disabled} style={[styles.tileTouch, disabled && styles.tileDisabled]}>
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
            ) : IS_WEB ? (
              // Web (OMPay): USD with an OMR estimate.
              <View style={styles.priceCol}>
                <Text style={styles.priceText}>${p.price.toFixed(2)}</Text>
                <Text style={styles.priceOmr}>≈ {fmtOmr(usdToOmr(p.price))} ﷼</Text>
              </View>
            ) : priceLabel !== undefined ? (
              // Native IAP: price comes straight from the store (never hardcoded).
              <View style={styles.priceCol}>
                <Text style={styles.priceText}>{priceLabel}</Text>
              </View>
            ) : (
              // Native: store price not loaded yet → loading (tile disabled).
              <ActivityIndicator color={PRIMARY} size="small" />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// Web only: persist the in-flight coin payment so the credit survives the
// full-page navigation to OMPay's hosted checkout and back. Coins are stored on
// the device, so the app itself must credit them once OMPay confirms the payment
// — this marker lets the screen pick the payment back up after the browser
// returns from the gateway.
const PENDING_KEY = "copointo:pendingCoinPayment";

// Optional Copointo-Code context carried through the full-page OMPay navigation
// so the +20% bonus + settlement log can be applied when we return and credit.
interface PendingRedeemCtx { code: string; priceUsd: number | null; priceOmr: number; }

function savePendingPayment(
  paymentId: string,
  token: string,
  coins: number,
  redeem?: PendingRedeemCtx | null,
) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ paymentId, token, coins, redeem: redeem ?? null, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable (private mode) — return polling just won't resume */
  }
}

function loadPendingPayment():
  | { paymentId: string; token: string; coins: number; redeem: PendingRedeemCtx | null }
  | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o?.paymentId || !o?.token || typeof o?.coins !== "number") return null;
    // Ignore stale markers (> 1 hour) so an abandoned payment never resumes.
    if (o.ts && Date.now() - o.ts > 60 * 60 * 1000) return null;
    const redeem: PendingRedeemCtx | null =
      o.redeem && typeof o.redeem.code === "string"
        ? { code: o.redeem.code, priceUsd: o.redeem.priceUsd ?? null, priceOmr: Number(o.redeem.priceOmr) || 0 }
        : null;
    return { paymentId: o.paymentId, token: o.token, coins: o.coins, redeem };
  } catch {
    return null;
  }
}

function clearPendingPayment() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

// True when the web app is running inside an iframe (the Replit/canvas in-editor
// preview). The real published site at copointo.com runs top-level, so this is
// false there. We branch on it because a sandboxed preview frame can neither
// navigate itself to a gateway (X-Frame-Options) nor navigate the top window
// (sandbox blocks it silently).
function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.top !== window.self;
  } catch {
    // Cross-origin parent → we're definitely embedded.
    return true;
  }
}

export function BuyCoinsPanel() {
  const { addCoins } = useCoins();
  const { user } = useApp();
  // RevenueCat (native IAP). On web these are unused — web stays on OMPay.
  const { currentOffering, purchase, restore, isRestoring } = useSubscription();
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslate = useRef(new Animated.Value(-10)).current;

  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  // Web: instant "redirecting to checkout" overlay shown the moment a pack is
  // tapped, so the wait for the OMPay session feels responsive.
  const [webRedirecting, setWebRedirecting] = useState(false);
  // Native IAP: confirm dialog (custom modal — Alert.alert is unreliable for
  // purchase confirmation per the RevenueCat guidance).
  const [pendingPack, setPendingPack] = useState<{ pack: Pack; rcPackage: PurchasesPackage; priceLabel: string } | null>(null);
  const pollCancel = useRef(false);
  // Idempotency guards: never credit the same payment twice, never run two
  // polling loops for the same payment.
  const activePoll = useRef<string | null>(null);
  const credited = useRef<Set<string>>(new Set());

  // Copointo Code (per-cafe referral). Applied once for the session; grants the
  // buyer +20% bonus coins at the same price. Stored in a ref too so the web
  // OMPay return-handler (which re-reads from the marker) and any closures see
  // the latest value without stale state.
  const [appliedCode, setAppliedCode] = useState<{ code: string; cafeName: string } | null>(null);
  const [codeModal, setCodeModal] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeError, setCodeError] = useState("");

  // Copointo Code gate: the panel is shown the first time the buyer taps a pack
  // to purchase. After they apply a code or skip, the tapped purchase resumes,
  // and later taps go straight through. A ref mirrors the applied code so the
  // web checkout closure (built right after applying) reads it without stale state.
  const appliedCodeRef = useRef<{ code: string; cafeName: string } | null>(null);
  const codeGateDone = useRef(false);
  const pendingBuyRef = useRef<Pack | null>(null);

  const applyCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length !== 3) { setCodeError("الكود مكوّن من 3 خانات"); return; }
    setCodeChecking(true);
    setCodeError("");
    const r = await validateCopointoCode(code, user?.id ?? null);
    setCodeChecking(false);
    if (!r.valid || !r.cafeId) {
      setCodeError("كود غير صالح، تأكد من الكود وحاول مجدداً");
      return;
    }
    const applied = { code, cafeName: r.cafeName ?? "" };
    appliedCodeRef.current = applied;
    setAppliedCode(applied);
    setCodeModal(false);
    setCodeInput("");
    setCodeError("");
    continuePendingBuy();
  };

  const clearCode = () => {
    appliedCodeRef.current = null;
    setAppliedCode(null);
    setCodeInput("");
    setCodeError("");
  };

  // Skip the code panel (no bonus) and resume any purchase that opened it.
  const skipCode = () => {
    setCodeModal(false);
    setCodeError("");
    setCodeInput("");
    continuePendingBuy();
  };

  // Once the gate is resolved (code applied or skipped), resume the exact pack
  // the buyer tapped to open the panel. Opened from the banner (no pending pack)
  // it simply marks the gate done.
  const continuePendingBuy = () => {
    codeGateDone.current = true;
    const p = pendingBuyRef.current;
    pendingBuyRef.current = null;
    if (p) proceedBuy(p);
  };

  // Map a coin pack to its live RevenueCat package (by the "coins_<n>"
  // identifier seeded in RevenueCat). Returns null in Expo Go preview / when
  // offerings haven't loaded.
  const packageForPack = (p: Pack): PurchasesPackage | null => {
    const pkgs = currentOffering?.availablePackages ?? [];
    return pkgs.find((pkg) => coinsForPackage(pkg) === p.coins) ?? null;
  };

  // Credit coins for a payment at most once, even across multiple poll ticks or
  // a return-handler + manual-close race. Returns true only on the first credit.
  const creditOnce = async (paymentId: string, coins: number): Promise<boolean> => {
    if (credited.current.has(paymentId)) return false;
    credited.current.add(paymentId);
    await addCoins(coins);
    return true;
  };

  // Credit a completed purchase, applying the Copointo-Code +20% bonus when a
  // code is in play, then best-effort logging EVERY purchase (code or not) to
  // the server's single purchase ledger (powers the super-admin store report
  // and the cafe settlement). `ctx` is always provided; `ctx.code` is "" for a
  // plain store purchase. `dedupeKey` null → always credit (store gave no txn
  // id); otherwise credit at most once. Returns the breakdown for the alert.
  const creditWithBonus = async (
    dedupeKey: string | null,
    baseCoins: number,
    ctx: { code: string | null; priceUsd: number | null; priceOmr: number; platform: "web" | "ios" | "android" },
  ): Promise<{ credited: boolean; total: number; bonus: number }> => {
    const hasCode = !!ctx.code;
    const bonus = hasCode ? codeBonusCoins(baseCoins) : 0;
    const total = baseCoins + bonus;
    const credited = dedupeKey
      ? await creditOnce(dedupeKey, total)
      : (await addCoins(total), true);
    // Log only on the FIRST credit (and only when we have a payment ref the
    // server can dedupe on) so a re-credit attempt can't double-count.
    if (credited && dedupeKey) {
      redeemCopointoCode({
        code: ctx.code ?? "",
        userId: user?.id ?? null,
        buyerName: user?.name ?? null,
        buyerPhone: user?.phone ?? null,
        coinsBase: baseCoins,
        priceUsd: ctx.priceUsd,
        priceOmr: ctx.priceOmr,
        platform: ctx.platform,
        // Server dedupes on this so a replay can't double-count the purchase.
        paymentRef: dedupeKey,
      }).catch(() => { /* purchase log is best-effort; coins already credited */ });
    }
    return { credited, total, bonus };
  };

  const successMsg = (total: number, bonus: number) =>
    bonus > 0
      ? `تم إضافة ${fmt(total)} عملة إلى رصيدك (منها ${fmt(bonus)} مكافأة كود +20%).`
      : `تم إضافة ${fmt(total)} عملة إلى رصيدك.`;

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
    maxMs = 4 * 60 * 1000,
    redeemCtx: { code: string | null; priceUsd: number | null; priceOmr: number; platform: "web" | "ios" | "android" } = { code: null, priceUsd: null, priceOmr: 0, platform: "web" },
  ) => {
    if (activePoll.current === paymentId) return; // a loop is already running
    activePoll.current = paymentId;
    pollCancel.current = false;
    setVerifying(true);
    const deadline = Date.now() + maxMs;
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
        const { credited: didCredit, total, bonus } = await creditWithBonus(paymentId, coins, redeemCtx);
        clearPendingPayment();
        setVerifying(false);
        setBusyId(null);
        if (didCredit) {
          Alert.alert("تم الدفع ✅", successMsg(total, bonus));
        }
        return stop();
      }
      if (abortOnFailure && (status === "failed" || status === "canceled")) {
        clearPendingPayment();
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
      // Deliberately KEEP the pending marker here: a slow/late OMPay
      // confirmation must still be auto-credited the next time this screen
      // mounts (the marker self-expires after 1h via loadPendingPayment).
      setVerifying(false);
      setBusyId(null);
      Alert.alert(
        "انتهت المهلة",
        "لم نتمكّن من تأكيد الدفع. إذا تم خصم المبلغ فسيُضاف رصيدك تلقائياً، أو حاول مرة أخرى.",
      );
    }
  };

  // Web: returning from OMPay's hosted page reloads this screen. If a coin
  // payment was in flight, re-confirm it with the server and credit the coins.
  useEffect(() => {
    if (!IS_WEB) return;
    const pending = loadPendingPayment();
    if (pending) {
      // Always pass a web context so EVERY web purchase is logged (the server
      // derives the real price from the PAID payment); the code is carried only
      // when one was applied before checkout.
      const redeemCtx = {
        code: pending.redeem?.code ?? null,
        priceUsd: pending.redeem?.priceUsd ?? null,
        priceOmr: pending.redeem?.priceOmr ?? 0,
        platform: "web" as const,
      };
      startPolling(pending.paymentId, pending.token, pending.coins, true, 90 * 1000, redeemCtx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Entry point for a pack tap. iOS/Android go through Apple/Google IAP; web
  // keeps the OMPay hosted checkout.
  const proceedBuy = (p: Pack) => {
    if (IS_WEB) return handleBuyWeb(p);
    return handleBuyNativeTap(p);
  };

  const handleBuy = (p: Pack) => {
    if (busyId) return;
    // First purchase tap (WEB ONLY) → show the Copointo Code panel (apply +20%
    // or skip), then resume this exact pack. Once resolved, later taps buy
    // directly. On native (App Store / Play) the code is disabled entirely:
    // unlocking extra coins via a promo code outside In-App Purchase violates
    // App Store Guideline 3.1.1, so native goes straight to IAP with no bonus.
    if (IS_WEB && !codeGateDone.current && !appliedCode) {
      pendingBuyRef.current = p;
      setCodeError("");
      setCodeModal(true);
      return;
    }
    proceedBuy(p);
  };

  // ─── Native IAP (iOS/Android) ──────────────────────────────────────
  // Tap → open a custom confirm modal (RevenueCat recommends a custom dialog
  // over Alert.alert for the purchase confirmation step).
  const handleBuyNativeTap = (p: Pack) => {
    const rcPackage = packageForPack(p);
    if (!rcPackage) {
      Alert.alert(
        "غير متوفر حالياً",
        "متجر المشتريات غير متاح في هذه النسخة. جرّب مرة أخرى لاحقاً.",
      );
      return;
    }
    setPendingPack({ pack: p, rcPackage, priceLabel: rcPackage.product.priceString });
  };

  // Confirm → run the App Store / Play purchase, then credit coins once.
  const confirmNativePurchase = async () => {
    const pending = pendingPack;
    if (!pending) return;
    setPendingPack(null);
    setBusyId(pending.pack.id);
    try {
      const result = await purchase(pending.rcPackage);
      if (result.cancelled) {
        setBusyId(null);
        return;
      }
      // A completed purchase must always grant coins. When the store returns a
      // stable transaction id we dedupe on it (guards any double-resolution of
      // the same transaction). Concurrent double-taps are already blocked by
      // `busyId` + the confirm modal, so a missing id still credits exactly once.
      // Always pass a context so EVERY native purchase is logged (code is
      // always null on native — see below).
      const redeemCtx = {
        // Native NEVER carries a promo code: the Copointo Code (+20% bonus) is
        // web-only, because unlocking coins via a code outside IAP breaks App
        // Store 3.1.1. Forced null so no bonus can ever be credited on native.
        code: null,
        priceUsd: pending.pack.price,
        priceOmr: usdToOmr(pending.pack.price),
        platform: (Platform.OS === "ios" ? "ios" : "android") as "ios" | "android",
      };
      const { credited, total, bonus } = await creditWithBonus(
        result.transactionId ?? null,
        pending.pack.coins,
        redeemCtx,
      );
      if (credited) {
        Alert.alert("تم الدفع ✅", successMsg(total, bonus));
      }
    } catch (e: any) {
      Alert.alert("تعذّر الدفع", String(e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  // Restore Purchases — required by the App Store. Consumables aren't restored,
  // but we surface the affordance and a clear result message.
  const handleRestore = async () => {
    try {
      await restore();
      Alert.alert("تمت الاستعادة", "تمت مزامنة مشترياتك مع حسابك.");
    } catch (e: any) {
      Alert.alert("تعذّرت الاستعادة", String(e?.message ?? e));
    }
  };

  // ─── Web OMPay checkout ────────────────────────────────────────────
  // Create the OMPay session, then navigate THIS tab straight to the hosted
  // checkout (no new tab, no interstitial, no popup-fallback). Coins live on the
  // device, so we stash a pending marker first; when OMPay redirects back to
  // this screen the mount effect picks it up and credits the coins.
  const handleBuyWeb = async (p: Pack) => {
    setBusyId(p.id);
    // Show the "redirecting to checkout" overlay immediately so the wait for the
    // OMPay session feels instant, even before the network call resolves.
    setWebRedirecting(true);
    try {
      // Bring the shopper back to this exact screen after the hosted checkout.
      const returnUrl = typeof window !== "undefined" ? window.location.href : undefined;
      const { payment, token } = await createPaymentSession({
        purpose: "coins",
        amount: usdToOmr(p.price),
        description: `شراء ${fmt(p.coins)} عملة Copointo`,
        userId: user?.id ?? null,
        customerName: user?.name ?? null,
        customerPhone: user?.phone ?? null,
        customerEmail: user?.email ?? null,
        metadata: { coins: p.coins, packId: p.id },
        returnUrl,
      });
      if (!payment.checkoutUrl) throw new Error("تعذّر فتح صفحة الدفع");

      // Persist so the credit survives the full-page navigation to OMPay; the
      // page we return to picks the marker back up and credits the coins. Carry
      // the Copointo Code (if applied) so the +20% bonus + settlement log are
      // applied on return.
      savePendingPayment(
        payment.id,
        token,
        p.coins,
        appliedCodeRef.current ? { code: appliedCodeRef.current.code, priceUsd: p.price, priceOmr: usdToOmr(p.price) } : null,
      );

      if (isEmbedded()) {
        // In-editor preview only: the framed app can't navigate to the gateway,
        // so open it in a new tab (the only thing the sandbox allows). The new
        // tab returns to this app after paying, where the marker credits the
        // coins. NOTE: never reached on the real published site.
        const opened =
          typeof window !== "undefined" ? window.open(payment.checkoutUrl, "_blank") : null;
        setBusyId(null);
        if (opened) {
          // New tab handles checkout; this page stays put, so drop the overlay.
          setWebRedirecting(false);
        } else if (typeof window !== "undefined") {
          // Popups blocked → last resort: navigate this frame anyway. If the
          // sandbox also blocks top-navigation, the assignment silently no-ops
          // (no throw), so a watchdog clears the overlay to avoid a dead-end UI.
          window.location.href = payment.checkoutUrl;
          setTimeout(() => setWebRedirecting(false), 1500);
        }
      } else if (typeof window !== "undefined") {
        // Real site (top-level): go straight to the gateway in the same tab.
        window.location.href = payment.checkoutUrl;
      }
    } catch (e: any) {
      setBusyId(null);
      setWebRedirecting(false);
      Alert.alert("تعذّر الدفع", String(e?.message ?? e));
    }
  };

  return (
    <View>
      <Animated.Text style={[styles.intro, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        اختر الباقة المناسبة لك واحصل على عملات Copointo فوراً
      </Animated.Text>

      {/* Copointo Code banner — WEB ONLY (OMPay). Hidden on native: granting
          bonus coins via a promo code outside IAP breaks App Store 3.1.1. */}
      {IS_WEB && (appliedCode ? (
        <View style={styles.codeApplied}>
          <View style={styles.codeAppliedInfo}>
            <Text style={styles.codeAppliedBadge}>كود {appliedCode.code} · +20% عملات</Text>
            {!!appliedCode.cafeName && (
              <Text style={styles.codeAppliedCafe}>من {appliedCode.cafeName}</Text>
            )}
          </View>
          <TouchableOpacity onPress={clearCode} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x-circle" size={20} color={PRIMARY} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.codePrompt}
          onPress={() => { pendingBuyRef.current = null; setCodeError(""); setCodeModal(true); }}
          activeOpacity={0.85}
        >
          <Feather name="tag" size={16} color={PRIMARY} />
          <Text style={styles.codePromptText}>هل لديك كود Copointo؟ احصل على +20% عملات</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.grid}>
        {PACKS.map((p, i) => {
          // On native, the price comes only from the live store package — never
          // hardcoded. Until the offering loads, the tile shows a loading state
          // and is disabled so no purchase can start without a real store price.
          const rcPackage = IS_WEB ? null : packageForPack(p);
          const priceLabel = rcPackage?.product.priceString;
          const disabled = !IS_WEB && !rcPackage;
          return (
            <AnimatedTile
              key={p.id}
              p={p}
              index={i}
              busy={busyId === p.id}
              onPress={() => handleBuy(p)}
              priceLabel={priceLabel}
              disabled={disabled}
            />
          );
        })}
      </View>

      {/* Native only: Restore Purchases (App Store requirement) */}
      {!IS_WEB && (
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={isRestoring}
          activeOpacity={0.8}
        >
          {isRestoring ? (
            <ActivityIndicator color={PRIMARY} size="small" />
          ) : (
            <Text style={styles.restoreText}>استعادة المشتريات</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Native IAP: custom purchase-confirm dialog */}
      <Modal
        visible={!!pendingPack}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingPack(null)}
      >
        <View style={styles.verifyOverlay}>
          <View style={styles.webPayCard}>
            <Text style={styles.webPayTitle}>تأكيد الشراء</Text>
            {pendingPack && (
              <Text style={styles.webPaySub}>
                {`شراء ${fmt(pendingPack.pack.coins)} عملة مقابل ${pendingPack.priceLabel}؟`}
              </Text>
            )}
            <TouchableOpacity style={styles.webPayBtn} onPress={confirmNativePurchase} activeOpacity={0.85}>
              <Text style={styles.webPayBtnText}>تأكيد الدفع</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPendingPack(null)}>
              <Text style={styles.webPayCancel}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Copointo Code entry */}
      <Modal
        visible={codeModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setCodeModal(false); pendingBuyRef.current = null; }}
      >
        <View style={styles.verifyOverlay}>
          <View style={styles.webPayCard}>
            <Text style={styles.webPayTitle}>كود Copointo</Text>
            <Text style={styles.webPaySub}>
              أدخل كود الكوفي المكوّن من 3 خانات لتحصل على +20% عملات إضافية بنفس السعر.
            </Text>
            <TextInput
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 3))}
              placeholder="ABC"
              placeholderTextColor="rgba(232,184,109,0.4)"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={3}
              style={styles.codeInput}
            />
            {!!codeError && <Text style={styles.codeErrorText}>{codeError}</Text>}
            <TouchableOpacity
              style={[styles.webPayBtn, codeChecking && { opacity: 0.6 }]}
              onPress={applyCode}
              disabled={codeChecking}
              activeOpacity={0.85}
            >
              {codeChecking
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.webPayBtnText}>تطبيق الكود</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={skipCode}>
              <Text style={styles.webPayCancel}>تخطّي</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Web: redirecting-to-checkout overlay (shown the instant a pack is tapped) */}
      <Modal visible={webRedirecting} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <ActivityIndicator color={PRIMARY} size="large" />
            <Text style={styles.verifyText}>جارٍ توجيهك إلى صفحة الدفع…</Text>
            <Text style={styles.verifySub}>لحظات من فضلك</Text>
          </View>
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
  tileDisabled: { opacity: 0.5 },
  badge: {
    position: "absolute", top: -8, alignSelf: "center",
    backgroundColor: PRIMARY,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, zIndex: 2,
  },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },

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
  priceCol: { alignItems: "center", gap: 1 },
  priceText: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },
  priceOmr: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.7)" },

  restoreBtn: {
    alignSelf: "center", marginTop: 18, paddingVertical: 10, paddingHorizontal: 22,
    borderRadius: 12, borderWidth: 1, borderColor: "rgba(232,184,109,0.4)",
    alignItems: "center", justifyContent: "center", minHeight: 42, minWidth: 180,
  },
  restoreText: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  verifyOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center" },
  verifyCard: {
    backgroundColor: "#0A0606", borderRadius: 18, borderWidth: 1, borderColor: PRIMARY,
    paddingVertical: 28, paddingHorizontal: 36, alignItems: "center", gap: 12,
  },
  verifyText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  verifySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },

  webPayCard: {
    backgroundColor: "#0A0606", borderRadius: 18, borderWidth: 1, borderColor: PRIMARY,
    paddingVertical: 26, paddingHorizontal: 28, alignItems: "center", gap: 14,
    width: "82%", maxWidth: 360,
  },
  webPayTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: PRIMARY, textAlign: "center" },
  webPaySub: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)",
    textAlign: "center", lineHeight: 20,
  },
  webPayBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 13,
    alignItems: "center", justifyContent: "center", alignSelf: "stretch", marginTop: 4,
  },
  webPayBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },
  webPayCancel: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", paddingTop: 2 },

  // Copointo Code banner + entry
  codePrompt: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(232,184,109,0.08)", borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14,
  },
  codePromptText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY, textAlign: "center" },
  codeApplied: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "rgba(232,184,109,0.12)", borderWidth: 1, borderColor: PRIMARY,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 14, gap: 10,
  },
  codeAppliedInfo: { flex: 1, alignItems: "flex-end" },
  codeAppliedBadge: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, textAlign: "right" },
  codeAppliedCafe: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", textAlign: "right", marginTop: 2 },
  codeInput: {
    alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, color: "#FFF",
    fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: 8,
  },
  codeErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#FF8A8A", textAlign: "center" },
});
