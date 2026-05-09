import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { FRAMES } from "../data/frames";
import { BADGES } from "../data/badges";
import type { LevelReward } from "../data/levelRewards";

const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.35)";

interface Props {
  reward: LevelReward | null;
  remaining: number;
  onDismiss: () => void;
}

export default function LevelRewardModal({ reward, remaining, onDismiss }: Props) {
  const scale  = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glow   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!reward) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    glow.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); };
  }, [reward, scale, opacity, glow]);

  if (!reward) return null;
  const frame = FRAMES.find(f => f.id === reward.frameId);
  const badge = BADGES.find(b => b.id === reward.badgeId);
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
          <View style={styles.confettiTop}>
            <Text style={styles.confetti}>🎉</Text>
            <Text style={styles.confetti}>🏆</Text>
            <Text style={styles.confetti}>🎉</Text>
          </View>
          <Text style={styles.title}>تهانئ!</Text>
          <Text style={styles.subtitle}>
            تم ربح هذه الجائزة لوصولك المستوى {reward.unlockLevel}
          </Text>
          <Text style={styles.rankName}>{reward.rankName}</Text>

          <View style={styles.prizesRow}>
            {frame && (
              <View style={styles.prizeBox}>
                <Image source={frame.source} style={styles.prizeImg} />
                <Text style={styles.prizeLabel}>{frame.name}</Text>
                <View style={styles.prizeChip}><Text style={styles.prizeChipText}>إطار</Text></View>
              </View>
            )}
            {badge && (
              <View style={styles.prizeBox}>
                <Image source={badge.source} style={styles.prizeImg} />
                <Text style={styles.prizeLabel}>{badge.name}</Text>
                <View style={styles.prizeChip}><Text style={styles.prizeChipText}>وسام</Text></View>
              </View>
            )}
          </View>

          <Pressable style={styles.cta} onPress={onDismiss}>
            <Feather name="check" size={16} color="#000" />
            <Text style={styles.ctaText}>
              {remaining > 1 ? `رائع — التالي (${remaining - 1})` : "رائع"}
            </Text>
          </Pressable>
          <Text style={styles.hint}>
            تجد جوائزك في "أغراضي" داخل المتجر
          </Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 380,
    backgroundColor: "#0A0606",
    borderRadius: 24, padding: 22,
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: "center",
    shadowColor: PRIMARY, shadowOpacity: 0.6, shadowRadius: 30, elevation: 10,
    overflow: "hidden",
  },
  glowRing: {
    position: "absolute",
    width: 460, height: 460, borderRadius: 230,
    borderWidth: 2, borderColor: PRIMARY,
    top: -180,
  },
  confettiTop: { flexDirection: "row", gap: 6, marginBottom: 6 },
  confetti: { fontSize: 28 },
  title: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: PRIMARY,
    marginBottom: 4, textAlign: "center",
  },
  subtitle: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)", textAlign: "center",
    marginBottom: 6, lineHeight: 20,
  },
  rankName: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF",
    marginBottom: 14, textAlign: "center",
  },
  prizesRow: {
    flexDirection: "row", gap: 14, marginBottom: 16, flexWrap: "wrap",
    justifyContent: "center",
  },
  prizeBox: {
    width: 130,
    backgroundColor: "rgba(232,184,109,0.08)",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, padding: 10,
    alignItems: "center", gap: 6,
  },
  prizeImg: { width: 80, height: 80, resizeMode: "contain" },
  prizeLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center",
  },
  prizeChip: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  prizeChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: PRIMARY,
    paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14,
    shadowColor: PRIMARY, shadowOpacity: 0.7, shadowRadius: 12, elevation: 4,
  },
  ctaText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  hint: {
    marginTop: 10,
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", textAlign: "center",
  },
});
