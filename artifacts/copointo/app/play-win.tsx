import { Feather, FontAwesome5 } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCoins } from "@/hooks/useCoins";

const BG = "#07060A";
const PRIMARY = "#E8B86D";

const LOGO = require("../assets/images/copointo-logo.png");
const COIN_IMG = require("../assets/images/copointo-coin.png");

type GameDef = {
  id: string;
  name: string;
  desc: string;
  route: string;
  color: string;
  icon: string;
  available: boolean;
};

const GAMES: GameDef[] = [
  {
    id: "flappy",
    name: "Flappy Copointo",
    desc: "مرّر الطائر بين الأعمدة واربح كوينز",
    route: "/flappy-copointo",
    color: "#FF7A1A",
    icon: "feather-alt",
    available: true,
  },
];

export default function PlayWinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { balance } = useCoins();

  const openGame = (g: GameDef) => {
    if (!g.available) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* ignore */
    }
    router.push(g.route as any);
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowTop} />

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </Pressable>
        <View style={styles.coinPill}>
          <Image source={COIN_IMG} style={styles.coinImg} />
          <Text style={styles.coinTxt}>{balance}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 70,
          paddingBottom: insets.bottom + 30,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Image source={LOGO} style={styles.heroLogo} />
        <Text style={styles.title}>العب واربح</Text>
        <Text style={styles.sub}>اختر لعبة وابدأ ربح الكوينز</Text>

        <View style={{ height: 22 }} />

        {GAMES.map((g) => (
          <Pressable
            key={g.id}
            style={({ pressed }) => [
              styles.card,
              { borderColor: `${g.color}55`, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => openGame(g)}
          >
            <View style={[styles.iconWrap, { backgroundColor: g.color }]}>
              <FontAwesome5 name={g.icon as any} size={26} color="#FFF" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{g.name}</Text>
              <Text style={styles.cardDesc}>{g.desc}</Text>
            </View>
            <Feather name="chevron-left" size={22} color={PRIMARY} />
          </Pressable>
        ))}

        <Text style={styles.more}>المزيد من الألعاب قريبًا…</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: "hidden" },
  glowTop: {
    position: "absolute",
    top: -180,
    left: "50%",
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(232,184,109,0.07)",
  },

  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.3)",
  },
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(232,184,109,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.3)",
  },
  coinImg: { width: 18, height: 18, resizeMode: "contain" },
  coinTxt: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  heroLogo: { width: 72, height: 72, resizeMode: "contain", alignSelf: "center" },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
    marginTop: 12,
    textShadowColor: "rgba(232,184,109,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  sub: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 6,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    marginBottom: 14,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "right" },
  cardDesc: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
    textAlign: "right",
  },

  more: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 8,
  },
});
