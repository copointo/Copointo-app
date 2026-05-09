import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { BackgroundDef, getBackground } from "../data/backgrounds";
import { useBackgrounds } from "../hooks/useBackgrounds";

interface Props {
  /** Override the equipped background (e.g. for previews in the shop). */
  backgroundId?: string | null;
  /** Override the BackgroundDef directly (skips lookup). */
  bg?: BackgroundDef | null;
  borderRadius?: number;
  style?: ViewStyle;
  paddingHorizontal?: number;
  paddingVertical?: number;
  children: React.ReactNode;
}

const SPARKLE_COUNT = 10;
type Sparkle = { x: number; y: number; size: number; delay: number; duration: number };

function makeSparkles(count: number): Sparkle[] {
  const out: Sparkle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 1500,
      duration: 1200 + Math.random() * 1800,
    });
  }
  return out;
}

function Sparkles({ color }: { color: string }) {
  const sparkles = useMemo(() => makeSparkles(SPARKLE_COUNT), []);
  const anims = useRef(sparkles.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((v, i) => {
      const s = sparkles[i]!;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.timing(v, { toValue: 1, duration: s.duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: s.duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    });
    loops.forEach(l => l.start());
    return () => { loops.forEach(l => l.stop()); };
  }, [anims, sparkles]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparkles.map((s, i) => {
        const v = anims[i]!;
        const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] });
        const scale   = v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.4] });
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: s.size / 2,
              backgroundColor: color,
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 4,
              opacity,
              transform: [{ scale }],
            }}
          />
        );
      })}
    </View>
  );
}

export default function UsernameBackground({
  backgroundId,
  bg: bgOverride,
  borderRadius = 12,
  style,
  paddingHorizontal = 12,
  paddingVertical = 6,
  children,
}: Props) {
  const { equipped } = useBackgrounds();
  const bg = bgOverride ?? getBackground(backgroundId !== undefined ? backgroundId : equipped);

  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0)).current;
  const rotate  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!bg) return;
    const loops: Animated.CompositeAnimation[] = [];
    const eff = bg.effect;

    if (eff === "shimmer" || eff === "sparkle" || eff === "aurora") {
      shimmer.setValue(0);
      loops.push(Animated.loop(
        Animated.timing(shimmer, {
          toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ));
    }
    if (eff === "pulse" || eff === "sparkle" || eff === "aurora") {
      pulse.setValue(0);
      loops.push(Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ));
    }
    if (eff === "rotate" || eff === "aurora") {
      rotate.setValue(0);
      loops.push(Animated.loop(
        Animated.timing(rotate, {
          toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true,
        }),
      ));
    }
    loops.forEach(l => l.start());
    return () => { loops.forEach(l => l.stop()); };
  }, [bg, shimmer, pulse, rotate]);

  if (!bg) {
    return <View style={[{ paddingHorizontal, paddingVertical }, style]}>{children}</View>;
  }

  const colors = bg.colors as unknown as readonly [string, string, ...string[]];
  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-180, 220] });
  const eff = bg.effect;
  const showRotate  = eff === "rotate" || eff === "aurora";
  const showPulse   = eff === "pulse"  || eff === "sparkle" || eff === "aurora";
  const showShimmer = eff === "shimmer" || eff === "sparkle" || eff === "aurora";
  const showSparkle = eff === "sparkle" || eff === "aurora";

  return (
    <View style={[
      styles.wrap,
      { borderRadius, paddingHorizontal, paddingVertical, borderColor: bg.highlight ?? "rgba(255,255,255,0.2)" },
      style,
    ]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      {showRotate && (
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", transform: [{ rotate: rotateDeg }], opacity: 0.85 }]}>
          <LinearGradient
            colors={[...colors, colors[0]] as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "200%", height: "200%", marginLeft: "-50%", marginTop: "-50%" }}
          />
        </Animated.View>
      )}
      {showPulse && bg.highlight && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, backgroundColor: bg.highlight, opacity: pulseOpacity },
          ]}
        />
      )}
      {showShimmer && bg.highlight && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}
        >
          <Animated.View style={{
            position: "absolute",
            top: 0, bottom: 0,
            width: 90,
            transform: [{ translateX: shimmerTranslate }, { skewX: "-20deg" }],
            backgroundColor: bg.highlight,
            opacity: 0.35,
          }} />
        </View>
      )}
      {showSparkle && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
          <Sparkles color={bg.highlight ?? "#FFFFFF"} />
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
  },
  content: { position: "relative", zIndex: 2 },
});
