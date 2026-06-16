import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { CoinMilestone } from "../data/coinMilestones";

const PRIMARY = "#E8B86D";
const COIN    = "#FFD66B";

interface Props {
  milestone: CoinMilestone | null;
  remaining: number;
  onDismiss: () => void;
}

export default function CoinMilestoneModal({ milestone, remaining, onDismiss }: Props) {
  const scale   = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const spin    = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!milestone) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    spin.setValue(0);
    glow.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.timing(spin,    { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); };
  }, [milestone, scale, opacity, spin, glow]);

  // Keep the Modal mounted at all times and drive it with `visible`. On iOS/iPad
  // unmounting a presented Modal (the old `if (!milestone) return null`) can
  // leave the native dialog stuck on screen, so the dismiss button appeared to
  // do nothing. Toggling `visible` lets the native modal dismiss cleanly.
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Modal transparent animationType="fade" visible={!!milestone} onRequestClose={onDismiss}>
      {milestone && (
        <Pressable style={styles.backdrop} onPress={onDismiss}>
          <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
            <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
            <View style={styles.confettiTop}>
              <Text style={styles.confetti}>🎊</Text>
              <Text style={styles.confetti}>💰</Text>
              <Text style={styles.confetti}>🎊</Text>
            </View>

            <Text style={styles.title}>مكافأة المستوى {milestone.level}!</Text>
            <Text style={styles.subtitle}>وصلت لمعلَمٍ جديد — استلم جائزتك</Text>

            <Animated.View style={[styles.coinBubble, { transform: [{ rotate }] }]}>
              <Image
                source={require("../assets/images/copointo-coin.png")}
                style={styles.coinImg}
              />
            </Animated.View>

            <View style={styles.amountRow}>
              <Text style={styles.amount}>+{milestone.coins}</Text>
              <Image
                source={require("../assets/images/copointo-coin.png")}
                style={styles.amountCoinImg}
              />
              <Text style={styles.amountLabel}>عملة</Text>
            </View>

            <Text style={styles.hint}>
              تمت إضافتها إلى محفظتك تلقائياً 🎉
            </Text>

            <Pressable style={styles.cta} onPress={onDismiss}>
              <Feather name="check" size={16} color="#000" />
              <Text style={styles.ctaText}>
                {remaining > 1 ? `رائع — التالي (${remaining - 1})` : "رائع"}
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#0A0606",
    borderRadius: 24, padding: 22,
    borderWidth: 1.5, borderColor: COIN,
    alignItems: "center",
    shadowColor: COIN, shadowOpacity: 0.6, shadowRadius: 30, elevation: 10,
    overflow: "hidden",
  },
  glowRing: {
    position: "absolute",
    width: 460, height: 460, borderRadius: 230,
    borderWidth: 2, borderColor: COIN,
    top: -180,
  },
  confettiTop: { flexDirection: "row", gap: 6, marginBottom: 6 },
  confetti: { fontSize: 28 },
  title: {
    fontSize: 22, fontFamily: "Inter_700Bold", color: COIN,
    marginBottom: 4, textAlign: "center",
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)", textAlign: "center",
    marginBottom: 16, lineHeight: 20,
  },
  coinBubble: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: "rgba(255,214,107,0.10)",
    borderWidth: 2, borderColor: COIN,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    shadowColor: COIN, shadowOpacity: 0.7, shadowRadius: 18, elevation: 6,
  },
  coinImg: { width: 96, height: 96, resizeMode: "contain" },
  amountRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8,
  },
  amount: { fontSize: 32, fontFamily: "Inter_700Bold", color: COIN },
  amountCoinImg: { width: 28, height: 28, resizeMode: "contain" },
  amountLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  hint: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    marginBottom: 14,
  },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COIN,
    paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14,
    shadowColor: COIN, shadowOpacity: 0.7, shadowRadius: 12, elevation: 4,
  },
  ctaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
});
