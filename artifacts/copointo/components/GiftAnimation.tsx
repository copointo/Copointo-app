import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GiftDef } from "../data/gifts";

interface Props {
  gift: GiftDef | null;
  /** Optional name to show under the gift ("من فلان"). */
  fromName?: string;
  /** Optional recipient name — when both fromName + toName are set, the
   *  caption becomes "من X → إلى Y" (used by the global gift-feed rain). */
  toName?: string;
  visible: boolean;
  onDone: () => void;
  /** How many gift instances to rain down (defaults to 1). */
  count?: number;
  /** When set, renders a top-right "تخطي" button that skips both the
   *  current animation and any queued ones. */
  onSkipAll?: () => void;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const MAX_PARTICLES = 40;          // visible cap for performance
const FALL_DUR_MIN  = 1800;
const FALL_DUR_MAX  = 3000;
const STAGGER_MS    = 110;
const HOLD_AFTER_MS = 700;         // extra time the caption stays visible

/**
 * Full-screen gift animation overlay. Now renders the gift as a shower of
 * emojis falling from the top of the screen down past the bottom — the
 * number of falling emojis matches the quantity sent (capped at
 * MAX_PARTICLES for performance, but the caption shows the true ×N).
 */
export default function GiftAnimation({ gift, fromName, toName, visible, onDone, count = 1, onSkipAll }: Props) {
  const captionOpacity = useRef(new Animated.Value(0)).current;

  // Total quantity (uncapped, used for the caption "×N" badge)
  const qty = Math.max(1, count);
  // Visible particle count (capped for perf)
  const visibleCount = Math.min(qty, MAX_PARTICLES);

  // Pre-compute per-particle random params once per (gift, count) cycle so
  // the animation looks consistent and doesn't reshuffle on re-render.
  const particles = useMemo(() => {
    if (!gift) return [];
    return Array.from({ length: visibleCount }).map((_, i) => ({
      key: `${gift.id}_${i}`,
      x: Math.random() * (SCREEN_W - 60) + 30,
      delay: i * STAGGER_MS,
      duration: FALL_DUR_MIN + Math.random() * (FALL_DUR_MAX - FALL_DUR_MIN),
      driftX: (Math.random() - 0.5) * 80,
      rotateDir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
      size: gift.tier === 3
        ? 56 + Math.random() * 26
        : gift.tier === 2
        ? 44 + Math.random() * 18
        : 34 + Math.random() * 14,
    }));
  }, [gift?.id, visibleCount]);

  // Total scene duration: last particle's start + its fall + a small hold
  const totalDur = visibleCount > 0
    ? (visibleCount - 1) * STAGGER_MS + FALL_DUR_MAX + HOLD_AFTER_MS
    : 1500;

  useEffect(() => {
    if (!visible || !gift) return;
    captionOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(captionOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(totalDur - 600),
      Animated.timing(captionOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => onDone(), totalDur);
    return () => clearTimeout(t);
  }, [visible, gift?.id, visibleCount, totalDur]);

  if (!visible || !gift) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone}>
        {/* No backdrop dim — gift overlay is fully transparent so the
            screen underneath stays visible. */}

        {/* Falling gift particles */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {particles.map(p => (
            <FallingGift
              key={p.key}
              emoji={gift.emoji}
              x={p.x}
              size={p.size}
              delay={p.delay}
              duration={p.duration}
              driftX={p.driftX}
              rotateDir={p.rotateDir}
            />
          ))}
        </View>

        {/* Caption (gift name + ×qty + sender → recipient).
            Now fully background-less: just text + emoji with a subtle
            shadow so it stays readable over any underlying screen. */}
        <Animated.View style={[styles.caption, { opacity: captionOpacity }]} pointerEvents="none">
          <View style={styles.captionRow}>
            <Text style={[styles.giftEmoji, styles.textShadow, { color: gift.color }]}>{gift.emoji}</Text>
            <Text style={[styles.giftName, styles.textShadow, { color: gift.color }]} numberOfLines={1}>
              {gift.name}
            </Text>
            {qty > 1 && (
              <Text style={[styles.qtyText, styles.textShadow, { color: gift.color }]}>×{qty}</Text>
            )}
          </View>
          {fromName && toName ? (
            <View style={styles.namesBlock}>
              <View style={styles.nameLine}>
                <Text style={[styles.nameLabel, styles.textShadow]}>من: </Text>
                <Text style={[styles.nameStrong, styles.textShadow, { color: gift.color }]}>
                  {fromName}
                </Text>
              </View>
              <View style={styles.nameLine}>
                <Text style={[styles.nameLabel, styles.textShadow]}>إلى: </Text>
                <Text style={[styles.nameStrong, styles.textShadow, { color: gift.color }]}>
                  {toName}
                </Text>
              </View>
            </View>
          ) : fromName ? (
            <View style={styles.nameLine}>
              <Text style={[styles.nameLabel, styles.textShadow]}>من: </Text>
              <Text style={[styles.nameStrong, styles.textShadow, { color: gift.color }]}>
                {fromName}
              </Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Skip-all button (top-left) — only shown for the global feed rain */}
        {onSkipAll && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation?.(); onSkipAll(); }}
            activeOpacity={0.85}
            style={styles.skipBtn}
          >
            <Feather name="x" size={14} color="#FFF" />
            <Text style={styles.skipText}>تخطي الهدايا</Text>
          </TouchableOpacity>
        )}
      </Pressable>
    </Modal>
  );
}

interface FallingProps {
  emoji: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  rotateDir: 1 | -1;
}

function FallingGift({ emoji, x, size, delay, duration, driftX, rotateDir }: FallingProps) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-size - 40, SCREEN_H + size + 40],
  });
  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, driftX],
  });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: rotateDir > 0 ? ["0deg", "540deg"] : ["0deg", "-540deg"],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.06, 0.94, 1],
    outputRange: [0, 1, 1, 0],
  });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: x - size / 2,
        top: 0,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  caption: {
    position: "absolute",
    left: 0, right: 0,
    top: SCREEN_H / 2 - 60,
    alignItems: "center",
    gap: 10,
  },
  captionRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12,
  },
  giftEmoji: { fontSize: 36, lineHeight: 40 },
  giftName: { fontSize: 24, fontFamily: "Inter_700Bold" },
  qtyText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  namesBlock: {
    alignItems: "center",
    gap: 4,
  },
  nameLine: {
    flexDirection: "row", alignItems: "center",
    maxWidth: "92%",
  },
  nameLabel: {
    fontSize: 16, fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  nameStrong: {
    fontSize: 18, fontFamily: "Inter_700Bold",
    maxWidth: 220,
  },
  textShadow: {
    textShadowColor: "rgba(0,0,0,0.95)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  skipBtn: {
    position: "absolute",
    top: 50,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.5)",
  },
  skipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
  },
});
