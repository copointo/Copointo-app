import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
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
  // Visible particle count (capped for perf). Cinematic image gifts with
  // singleParticle=true always render exactly ONE big falling particle so
  // the GIF reads clearly instead of a swarm of duplicates.
  const visibleCount = gift?.singleParticle ? 1 : Math.min(qty, MAX_PARTICLES);

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
      size: gift.singleParticle
        ? Math.min(SCREEN_W, SCREEN_H) * 0.7
        : gift.tier === 3
        ? 56 + Math.random() * 26
        : gift.tier === 2
        ? 44 + Math.random() * 18
        : 34 + Math.random() * 14,
    }));
  }, [gift?.id, visibleCount]);

  // Total scene duration depends on the animation kind. Premium cinematic
  // gifts (burst/spiral/zoom) run noticeably longer so the effect lands.
  const animKind = gift?.animationKind ?? "fall";
  const totalDur =
    animKind === "burst"  ? 6000 :
    animKind === "spiral" ? 6500 :
    animKind === "zoom"   ? 6000 :
    visibleCount > 0
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

        {/* Particle layer — branches by gift.animationKind. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {animKind === "burst"  && <BurstScene  gift={gift} duration={totalDur} />}
          {animKind === "spiral" && <SpiralScene gift={gift} duration={totalDur} />}
          {animKind === "zoom"   && <ZoomScene   gift={gift} duration={totalDur} />}
          {animKind === "fall" && particles.map(p => (
            <FallingGift
              key={p.key}
              emoji={gift.emoji}
              image={gift.image}
              x={gift.singleParticle ? SCREEN_W / 2 : p.x}
              size={p.size}
              delay={p.delay}
              duration={p.duration}
              driftX={gift.singleParticle ? 0 : p.driftX}
              rotateDir={p.rotateDir}
              spin={!gift.singleParticle}
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
  image?: number;
  x: number;
  size: number;
  delay: number;
  duration: number;
  driftX: number;
  rotateDir: 1 | -1;
  /** When false, the particle falls straight down without rotating
   *  (used for image-based cinematic gifts so the GIF stays upright). */
  spin?: boolean;
}

function FallingGift({ emoji, image, x, size, delay, duration, driftX, rotateDir, spin = true }: FallingProps) {
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
  const transform = spin
    ? [{ translateY }, { translateX }, { rotate }]
    : [{ translateY }, { translateX }];
  if (image) {
    return (
      <Animated.Image
        source={image}
        resizeMode="contain"
        style={{
          position: "absolute",
          left: x - size / 2,
          top: 0,
          width: size,
          height: size,
          opacity,
          transform,
        }}
      />
    );
  }
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: x - size / 2,
        top: 0,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity,
        transform,
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

/* ─────────────────────────── Premium scenes ──────────────────────────── */

const CENTER_X = SCREEN_W / 2;
const CENTER_Y = SCREEN_H / 2;

/**
 * BurstScene — fireworks-style. Multiple waves where particles explode
 * radially from a center point, fly outward with gravity-ish easing,
 * then fade. Each wave uses a different center for a layered effect.
 */
function BurstScene({ gift, duration }: { gift: GiftDef; duration: number }) {
  const palette = gift.particles && gift.particles.length > 0
    ? gift.particles
    : [gift.emoji];
  const WAVES = 3;
  const PER_WAVE = 18;
  const waveGap = (duration - 1500) / WAVES;
  const waves = useMemo(() => {
    return Array.from({ length: WAVES }).map((_, w) => {
      const cx = CENTER_X + (Math.random() - 0.5) * SCREEN_W * 0.4;
      const cy = CENTER_Y + (Math.random() - 0.5) * SCREEN_H * 0.25;
      const startMs = w * waveGap;
      return Array.from({ length: PER_WAVE }).map((_, i) => {
        const angle = (i / PER_WAVE) * Math.PI * 2 + Math.random() * 0.2;
        const dist = 180 + Math.random() * 180;
        return {
          key: `${gift.id}_w${w}_p${i}`,
          cx, cy,
          startMs,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          emoji: palette[(w + i) % palette.length],
          size: 28 + Math.random() * 24,
          rotateDir: (Math.random() > 0.5 ? 1 : -1) as 1 | -1,
        };
      });
    }).flat();
  }, [gift.id, duration]);
  return (
    <>
      {waves.map(({ key, ...rest }) => (
        <BurstParticle key={key} {...rest} />
      ))}
      <CenterHalo color={gift.color} duration={duration} pulses={WAVES} />
    </>
  );
}

function BurstParticle({
  cx, cy, startMs, dx, dy, emoji, size, rotateDir,
}: {
  cx: number; cy: number; startMs: number; dx: number; dy: number;
  emoji: string; size: number; rotateDir: 1 | -1;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 1400,
      delay: startMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  const tx = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const ty = t.interpolate({ inputRange: [0, 1], outputRange: [0, dy + 80] });
  const scale = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1.1, 0.85] });
  const opacity = t.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: rotateDir > 0 ? ["0deg", "360deg"] : ["0deg", "-360deg"],
  });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: cx - size / 2,
        top: cy - size / 2,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity,
        transform: [{ translateX: tx }, { translateY: ty }, { scale }, { rotate }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

/**
 * SpiralScene — particles orbit the center, spiraling outward while growing
 * and rotating. Final reveal: a big center emoji pulses in.
 */
function SpiralScene({ gift, duration }: { gift: GiftDef; duration: number }) {
  const palette = gift.particles && gift.particles.length > 0
    ? gift.particles
    : [gift.emoji];
  const COUNT = 22;
  const items = useMemo(() => {
    return Array.from({ length: COUNT }).map((_, i) => ({
      key: `${gift.id}_s${i}`,
      delay: i * 90,
      emoji: palette[i % palette.length],
      size: 26 + Math.random() * 16,
      startAngle: (i / COUNT) * Math.PI * 2,
      direction: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    }));
  }, [gift.id]);
  return (
    <>
      {items.map(({ key, ...rest }) => (
        <SpiralParticle key={key} {...rest} totalDur={duration} />
      ))}
      <CenterHero gift={gift} duration={duration} delay={duration - 1800} />
    </>
  );
}

function SpiralParticle({
  delay, emoji, size, startAngle, direction, totalDur,
}: {
  delay: number; emoji: string; size: number;
  startAngle: number; direction: 1 | -1; totalDur: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: totalDur - delay - 600,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  const angle = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, direction * Math.PI * 4],
  });
  const radius = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [40, 180, 30],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.08, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 1.2, 0.6],
  });
  const tx = Animated.add(
    new Animated.Value(0),
    Animated.multiply(radius, angle.interpolate({
      inputRange: [-Math.PI * 4, Math.PI * 4],
      outputRange: [Math.cos(startAngle - Math.PI * 4), Math.cos(startAngle + Math.PI * 4)],
    })),
  );
  // RN's Animated can't compose cos/sin directly, so approximate via a
  // listener-driven approach: use a single timing interpolation to drive
  // both x and y via interpolate ranges sampled around the orbit.
  const SAMPLES = 33;
  const range = Array.from({ length: SAMPLES }, (_, k) => k / (SAMPLES - 1));
  const xs = range.map(p => {
    const a = startAngle + direction * Math.PI * 4 * p;
    const r = p < 0.5 ? 40 + (180 - 40) * (p / 0.5) : 180 + (30 - 180) * ((p - 0.5) / 0.5);
    return Math.cos(a) * r;
  });
  const ys = range.map(p => {
    const a = startAngle + direction * Math.PI * 4 * p;
    const r = p < 0.5 ? 40 + (180 - 40) * (p / 0.5) : 180 + (30 - 180) * ((p - 0.5) / 0.5);
    return Math.sin(a) * r;
  });
  const txs = t.interpolate({ inputRange: range, outputRange: xs });
  const tys = t.interpolate({ inputRange: range, outputRange: ys });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: direction > 0 ? ["0deg", "720deg"] : ["0deg", "-720deg"],
  });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: CENTER_X - size / 2,
        top: CENTER_Y - size / 2,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity,
        transform: [
          { translateX: txs },
          { translateY: tys },
          { scale },
          { rotate },
        ],
      }}
    >
      {emoji}
    </Animated.Text>
  );
  // tx unused — referenced to satisfy TS unused-var heuristics if any.
  void tx;
}

/**
 * ZoomScene — single huge gift emoji zooms in with a spinning entrance,
 * pulses in place, then fades. Surrounded by orbiting sparkle particles
 * and concentric expanding halos for grandeur.
 */
function ZoomScene({ gift, duration }: { gift: GiftDef; duration: number }) {
  const palette = gift.particles && gift.particles.length > 0
    ? gift.particles
    : [gift.emoji];
  const ORBITS = 12;
  const items = useMemo(() => {
    return Array.from({ length: ORBITS }).map((_, i) => ({
      key: `${gift.id}_o${i}`,
      delay: 600 + i * 120,
      emoji: palette[(i + 1) % palette.length],
      size: 22 + Math.random() * 18,
      startAngle: (i / ORBITS) * Math.PI * 2,
      direction: (i % 2 === 0 ? 1 : -1) as 1 | -1,
    }));
  }, [gift.id]);
  return (
    <>
      <CenterHalo color={gift.color} duration={duration} pulses={4} />
      <ZoomHero gift={gift} duration={duration} />
      {items.map(({ key, ...rest }) => (
        <OrbitSparkle key={key} {...rest} totalDur={duration} />
      ))}
    </>
  );
}

function ZoomHero({ gift, duration }: { gift: GiftDef; duration: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.delay(duration - 900 - 700),
      Animated.timing(t, { toValue: 0, duration: 700, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  const size = Math.min(SCREEN_W, SCREEN_H) * 0.45;
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ["-180deg", "0deg"] });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: CENTER_X - size / 2,
        top: CENTER_Y - size / 2,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity: t,
        transform: [{ scale }, { rotate }],
        textShadowColor: gift.color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 24,
      }}
    >
      {gift.emoji}
    </Animated.Text>
  );
}

function OrbitSparkle({
  delay, emoji, size, startAngle, direction, totalDur,
}: {
  delay: number; emoji: string; size: number;
  startAngle: number; direction: 1 | -1; totalDur: number;
}) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: totalDur - delay - 500,
      delay,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, []);
  const SAMPLES = 25;
  const range = Array.from({ length: SAMPLES }, (_, k) => k / (SAMPLES - 1));
  const radius = 150;
  const xs = range.map(p => {
    const a = startAngle + direction * Math.PI * 3 * p;
    return Math.cos(a) * radius;
  });
  const ys = range.map(p => {
    const a = startAngle + direction * Math.PI * 3 * p;
    return Math.sin(a) * radius;
  });
  const tx = t.interpolate({ inputRange: range, outputRange: xs });
  const ty = t.interpolate({ inputRange: range, outputRange: ys });
  const opacity = t.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: CENTER_X - size / 2,
        top: CENTER_Y - size / 2,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity,
        transform: [{ translateX: tx }, { translateY: ty }],
      }}
    >
      {emoji}
    </Animated.Text>
  );
}

/** Concentric expanding rings used as a backdrop for burst/zoom scenes. */
function CenterHalo({ color, duration, pulses }: { color: string; duration: number; pulses: number }) {
  return (
    <>
      {Array.from({ length: pulses }).map((_, i) => (
        <Halo key={i} color={color} delay={(duration / pulses) * i} />
      ))}
    </>
  );
}

function Halo({ color, delay }: { color: string; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, {
      toValue: 1,
      duration: 1500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  const MAX = Math.min(SCREEN_W, SCREEN_H) * 0.85;
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] });
  const opacity = t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] });
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: CENTER_X - MAX / 2,
        top: CENTER_Y - MAX / 2,
        width: MAX,
        height: MAX,
        borderRadius: MAX / 2,
        borderWidth: 3,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

/** Final hero reveal at the center used by the spiral scene. */
function CenterHero({ gift, duration, delay }: { gift: GiftDef; duration: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.6)), delay, useNativeDriver: true }),
      Animated.delay(duration - delay - 600 - 500),
      Animated.timing(t, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);
  const size = Math.min(SCREEN_W, SCREEN_H) * 0.32;
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: CENTER_X - size / 2,
        top: CENTER_Y - size / 2,
        fontSize: size,
        lineHeight: size * 1.15,
        opacity: t,
        transform: [{ scale }],
        textShadowColor: gift.color,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 18,
      }}
    >
      {gift.emoji}
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
