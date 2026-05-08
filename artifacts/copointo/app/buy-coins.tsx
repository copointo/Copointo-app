import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Alert, Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

function AnimatedTile({ p, index, onPress }: { p: Pack; index: number; onPress: () => void }) {
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
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.tileTouch}>
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
            <Text style={styles.priceText}>${p.price.toFixed(2)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

export function BuyCoinsPanel() {
  const { addCoins } = useCoins();
  const introOpacity = useRef(new Animated.Value(0)).current;
  const introTranslate = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(introTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [introOpacity, introTranslate]);

  const handleBuy = (p: Pack) => {
    Alert.alert(
      "تأكيد الشراء",
      `هل تريد شراء ${fmt(p.coins)} عملة مقابل $${p.price.toFixed(2)}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "شراء", onPress: async () => { await addCoins(p.coins); } },
      ],
    );
  };

  return (
    <View>
      <Animated.Text style={[styles.intro, { opacity: introOpacity, transform: [{ translateY: introTranslate }] }]}>
        اختر الباقة المناسبة لك واحصل على عملات Copointo فوراً
      </Animated.Text>
      <View style={styles.grid}>
        {PACKS.map((p, i) => (
          <AnimatedTile key={p.id} p={p} index={i} onPress={() => handleBuy(p)} />
        ))}
      </View>
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
});
