import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCoins } from "@/hooks/useCoins";

const BG = "#07060A";
const PRIMARY = "#E8B86D";

const LOGO = require("../assets/images/copointo-logo.png");
const COIN_IMG = require("../assets/images/copointo-coin.png");
const FLAPPY_COVER = require("../assets/images/flappy-cover-1.jpg");

type GameDef = {
  id: string;
  name: string;
  cover: any | null;
  /** Gradient cover used when there is no cover image. */
  gradient?: readonly [string, string, ...string[]];
  route: string;
  available: boolean;
};

const GAMES: GameDef[] = [
  {
    id: "flappy",
    name: "Flappy Copointo",
    cover: FLAPPY_COVER,
    route: "/flappy-copointo",
    available: true,
  },
  {
    id: "uno",
    name: "أونو أونلاين",
    cover: null,
    gradient: ["#E0584C", "#C9974F", "#4C7FE0"],
    route: "/uno",
    available: true,
  },
];

const PAD = 20;
const GAP = 14;
const COLS = 2;

function GameTile({ game, size }: { game: GameDef; size: number }) {
  const router = useRouter();
  // Animated diagonal shine that sweeps across the cover on a loop.
  const shine = useSharedValue(-1);
  useEffect(() => {
    shine.value = withDelay(
      Math.random() * 600,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, false),
    );
  }, [shine]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shine.value * (size + 90) }, { rotate: "18deg" }],
  }));

  const open = () => {
    if (!game.available) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* ignore */
    }
    router.push(game.route as any);
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [{ width: size, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.tile, { width: size, height: size }]}>
        {game.cover ? (
          <Image source={game.cover} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient
            colors={game.gradient ?? ["#1A1320", "#100B07"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          >
            <Text style={styles.gradientLabel} numberOfLines={2}>
              {game.name}
            </Text>
          </LinearGradient>
        )}

        {/* Bottom darkening so a play badge reads clearly */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.55)"]}
          style={styles.tileShade}
          pointerEvents="none"
        />

        {/* Moving shine streak */}
        <View style={styles.shineClip} pointerEvents="none">
          <Animated.View style={[styles.shineBar, { height: size * 2 }, shineStyle]}>
            <LinearGradient
              colors={["transparent", "rgba(255,255,255,0.5)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Play badge */}
        <View style={styles.playBadge} pointerEvents="none">
          <FontAwesome5 name="play" size={14} color="#000" />
        </View>
      </View>

      <Text style={[styles.tileName, { width: size }]} numberOfLines={1}>
        {game.name}
      </Text>
    </Pressable>
  );
}

export default function PlayWinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { balance } = useCoins();

  const tileSize = Math.floor((width - PAD * 2 - GAP * (COLS - 1)) / COLS);

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
          paddingHorizontal: PAD,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Image source={LOGO} style={styles.heroLogo} />
        <Text style={styles.title}>العب واربح</Text>
        <Text style={styles.sub}>اختر لعبة وابدأ ربح الكوينز</Text>

        <View style={{ height: 22 }} />

        <View style={styles.grid}>
          {GAMES.map((g) => (
            <GameTile key={g.id} game={g} size={tileSize} />
          ))}
        </View>

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

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },

  // ── Square tile ──
  tile: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.45)",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  gradientLabel: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    paddingHorizontal: 14,
    paddingBottom: 16,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tileShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  shineClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  shineBar: {
    position: "absolute",
    top: "-50%",
    left: 0,
    width: 46,
  },
  playBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: PRIMARY,
    paddingLeft: 3,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  tileName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textAlign: "center",
    marginTop: 10,
  },

  more: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 22,
  },
});
