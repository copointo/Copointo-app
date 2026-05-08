import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

interface Pack {
  id: string;
  coins: number;
  price: number;
  badge?: string;
}

const PACKS: Pack[] = [
  { id: "p1", coins: 200,   price: 0.99 },
  { id: "p2", coins: 1200,  price: 4.99 },
  { id: "p3", coins: 2800,  price: 9.99,  badge: "الأكثر شعبية" },
  { id: "p4", coins: 6200,  price: 19.99 },
  { id: "p5", coins: 13500, price: 49.99, badge: "أفضل قيمة" },
  { id: "p6", coins: 35000, price: 99.99 },
];

const fmt = (n: number) => n.toLocaleString("en-US");

export default function BuyCoinsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>شراء عملات Copointo</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>اختر الباقة المناسبة لك واحصل على عملات Copointo فوراً</Text>

        <View style={styles.grid}>
          {PACKS.map(p => (
            <TouchableOpacity key={p.id} style={styles.tile} activeOpacity={0.85}>
              {p.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{p.badge}</Text>
                </View>
              ) : null}
              <Image source={COPOINTO_COIN} style={styles.coinImg} />
              <View style={styles.coinsRow}>
                <Text style={styles.coinsText}>{fmt(p.coins)}</Text>
                <Text style={styles.coinsLabel}>عملة</Text>
              </View>
              <View style={styles.priceBtn}>
                <Text style={styles.priceText}>${p.price.toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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

  scroll: { padding: 20, paddingBottom: 60 },
  intro: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)", textAlign: "center",
    marginBottom: 18, lineHeight: 20,
  },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  tile: {
    width: "48%",
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
    paddingTop: 18,
  },
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
