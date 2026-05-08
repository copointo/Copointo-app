import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BuyCoinsPanel } from "./buy-coins";
import { useCoins } from "../hooks/useCoins";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

type Section = "coins" | "items" | null;

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selected, setSelected] = useState<Section>("coins");
  const { balance } = useCoins();

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/game")}
        >
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المتجر</Text>
        <View style={styles.balancePanel}>
          <Image source={COPOINTO_COIN} style={styles.balanceCoin} />
          <Text style={styles.balanceText}>{balance.toLocaleString("en-US")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          {/* Buy Coins card */}
          <TouchableOpacity
            style={[styles.tile, selected === "coins" && styles.tileSelected]}
            activeOpacity={0.85}
            onPress={() => setSelected(s => s === "coins" ? null : "coins")}
          >
            <View style={styles.tileIconWrap}>
              <Image source={COPOINTO_COIN} style={styles.tileCoin} />
            </View>
            <Text style={styles.tileTitle}>شراء عملات Copointo</Text>
            <Text style={styles.tileSub}>مزايا داخل التطبيق</Text>
          </TouchableOpacity>

          {/* Item Shop card */}
          <TouchableOpacity
            style={[styles.tile, selected === "items" && styles.tileSelected]}
            activeOpacity={0.85}
            onPress={() => setSelected(s => s === "items" ? null : "items")}
          >
            <View style={[styles.tileIconWrap, styles.tileIconBg]}>
              <Feather name="shopping-bag" size={36} color={PRIMARY} />
            </View>
            <Text style={styles.tileTitle}>Item Shop</Text>
            <Text style={styles.tileSub}>تصفّح العناصر والمزايا</Text>
          </TouchableOpacity>
        </View>

        {selected === "coins" && (
          <View style={styles.panelWrap}>
            <BuyCoinsPanel />
          </View>
        )}
        {selected === "items" && (
          <View style={styles.panelWrap}>
            <Text style={styles.emptyText}>قريبًا — Item Shop</Text>
          </View>
        )}
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

  scroll: { padding: 20, gap: 14, paddingBottom: 60 },

  row: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
    minHeight: 170,
  },
  tileSelected: {
    borderColor: PRIMARY,
    borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowOpacity: 0.6,
  },
  tileIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  tileIconBg: {
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
  },
  tileCoin: { width: 72, height: 72, resizeMode: "contain" },
  tileTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center", marginBottom: 4 },
  tileSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 16 },

  panelWrap: { marginTop: 4 },
  emptyText: {
    textAlign: "center", color: "rgba(255,255,255,0.6)",
    fontFamily: "Inter_500Medium", fontSize: 13, paddingVertical: 30,
  },
});
