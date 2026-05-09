import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GiftDef } from "../data/gifts";

interface Props {
  gift: GiftDef | null;
  /** Optional name to show under the gift ("من فلان"). */
  fromName?: string;
  visible: boolean;
  onDone: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/** Duration in ms for each tier — tier 3 is intentionally > 3 s. */
const DURATIONS: Record<1 | 2 | 3, number> = { 1: 1600, 2: 2600, 3: 4000 };

/**
 * Full-screen gift animation overlay. Plays a tier-appropriate effect:
 *  - tier 1: simple emoji pop + drift up
 *  - tier 2: emoji + 6 sparkle particles orbiting
 *  - tier 3: full-screen radial glow + 24 falling/swirling particles + big emoji
 *
 * Auto-dismisses via `onDone` after the duration, or on tap.
 */
export default function GiftAnimation({ gift, fromName, visible, onDone }: Props) {
  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const drift   = useRef(new Animated.Value(0)).current;
  const spin    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !gift) return;
    scale.setValue(0); opacity.setValue(0); drift.setValue(0); spin.setValue(0);

    const dur = DURATIONS[gift.tier];

    Animated.parallel([
      Animated.sequence([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.delay(dur - 900),
        Animated.timing(scale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(dur - 600),
        Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]),
      Animated.timing(drift, { toValue: 1, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true }),
      ),
    ]).start();

    const t = setTimeout(() => onDone(), dur);
    return () => clearTimeout(t);
  }, [visible, gift?.id]);

  if (!visible || !gift) return null;

  const driftY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -80] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // Emoji body size by tier
  const bodySize = gift.tier === 3 ? 180 : gift.tier === 2 ? 120 : 86;

  // Particle config
  const particleCount = gift.tier === 3 ? 24 : gift.tier === 2 ? 6 : 0;
  const particles = gift.particles ?? [];

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
          {/* Backdrop dim */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.65)" }]} />

          {/* Tier 3 radial gradient backdrop */}
          {gift.tier === 3 && (
            <LinearGradient
              colors={[`${gift.color}55`, "transparent", `${gift.color}33`]}
              start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}

          {/* Animated rotating ring (tier 2 & 3) */}
          {gift.tier >= 2 && (
            <Animated.View
              style={[
                styles.ring,
                {
                  width: bodySize * 2.4,
                  height: bodySize * 2.4,
                  borderRadius: bodySize * 1.2,
                  borderColor: gift.color,
                  top: SCREEN_H / 2 - bodySize * 1.2,
                  left: SCREEN_W / 2 - bodySize * 1.2,
                  transform: [{ rotate: spinDeg }],
                  opacity: gift.tier === 3 ? 0.55 : 0.4,
                },
              ]}
            />
          )}

          {/* Particles */}
          {particleCount > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              {Array.from({ length: particleCount }).map((_, i) => (
                <Particle
                  key={i}
                  index={i}
                  total={particleCount}
                  emoji={particles[i % Math.max(1, particles.length)] ?? "✨"}
                  tier={gift.tier}
                  color={gift.color}
                />
              ))}
            </View>
          )}

          {/* Main emoji */}
          <Animated.View
            style={[
              styles.bodyWrap,
              {
                top: SCREEN_H / 2 - bodySize / 2,
                left: SCREEN_W / 2 - bodySize / 2,
                transform: [{ translateY: driftY }, { scale }],
              },
            ]}
          >
            {/* Glow halo */}
            <View
              style={[
                styles.halo,
                {
                  width: bodySize * 1.8,
                  height: bodySize * 1.8,
                  borderRadius: bodySize * 0.9,
                  backgroundColor: gift.color,
                  opacity: gift.tier === 3 ? 0.45 : 0.30,
                  top: -bodySize * 0.4,
                  left: -bodySize * 0.4,
                },
              ]}
            />
            <Text style={{ fontSize: bodySize, lineHeight: bodySize * 1.15, textAlign: "center" }}>
              {gift.emoji}
            </Text>
          </Animated.View>

          {/* Caption */}
          <View style={[styles.caption, { top: SCREEN_H / 2 + bodySize / 2 + 28 }]}>
            <Text style={[styles.giftName, { color: gift.color }]} numberOfLines={1}>
              {gift.name}
            </Text>
            {fromName ? (
              <Text style={styles.fromName} numberOfLines={1}>
                من {fromName}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

interface ParticleProps {
  index: number;
  total: number;
  emoji: string;
  tier: 1 | 2 | 3;
  color: string;
}

function Particle({ index, total, emoji, tier, color }: ParticleProps) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = (index / total) * (tier === 3 ? 1200 : 500);
    const dur = tier === 3 ? 3000 : 1800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration: dur,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => { loop.stop(); };
  }, []);

  // Tier 3: confetti rain from top
  // Tier 2: orbit around center
  if (tier === 3) {
    const xStart = (index / total) * SCREEN_W + ((index % 3) - 1) * 30;
    const xEnd = xStart + ((index % 2 === 0 ? 1 : -1) * 60);
    const x = t.interpolate({ inputRange: [0, 1], outputRange: [xStart, xEnd] });
    const y = t.interpolate({ inputRange: [0, 1], outputRange: [-40, SCREEN_H + 40] });
    const rot = t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const op = t.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] });
    return (
      <Animated.Text
        style={{
          position: "absolute",
          fontSize: 24,
          color,
          transform: [{ translateX: x }, { translateY: y }, { rotate: rot }],
          opacity: op,
        }}
      >
        {emoji}
      </Animated.Text>
    );
  }

  // Tier 2: orbiting sparkles
  const angle = (index / total) * Math.PI * 2;
  const radius = 110;
  const cx = SCREEN_W / 2 + Math.cos(angle) * radius;
  const cy = SCREEN_H / 2 + Math.sin(angle) * radius;
  const op = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] });
  const sc = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 1.2, 0.6] });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: cx - 14,
        top: cy - 14,
        fontSize: 22,
        opacity: op,
        transform: [{ scale: sc }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  bodyWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute" },
  ring: { position: "absolute", borderWidth: 3, borderStyle: "dashed" },
  caption: {
    position: "absolute", left: 0, right: 0, alignItems: "center", gap: 4,
  },
  giftName: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  fromName: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
});
