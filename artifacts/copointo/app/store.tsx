import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المتجر</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Buy Coins card */}
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={styles.coinWrap}>
            <Image source={COPOINTO_COIN} style={styles.coinImg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>شراء عملات Copointo</Text>
            <Text style={styles.cardSub}>استخدم العملات للحصول على مزايا داخل التطبيق</Text>
          </View>
          <Feather name="chevron-left" size={22} color={PRIMARY} />
        </TouchableOpacity>

        {/* Item Shop card */}
        <TouchableOpacity style={styles.card} activeOpacity={0.85}>
          <View style={styles.iconWrap}>
            <Feather name="shopping-bag" size={28} color={PRIMARY} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Item Shop</Text>
            <Text style={styles.cardSub}>تصفّح العناصر والمزايا المتاحة للشراء</Text>
          </View>
          <Feather name="chevron-left" size={22} color={PRIMARY} />
        </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },

  scroll: { padding: 20, gap: 14, paddingBottom: 60 },

  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
  },
  coinWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  coinImg: { width: 64, height: 64, resizeMode: "contain" },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 4 },
  cardSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", lineHeight: 18 },
});
