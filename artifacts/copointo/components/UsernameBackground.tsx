import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View, ViewStyle } from "react-native";
import { BackgroundDef, getBackground } from "../data/backgrounds";
import { useBackgrounds } from "../hooks/useBackgrounds";

interface Props {
  backgroundId?: string | null;
  bg?: BackgroundDef | null;
  borderRadius?: number;
  style?: ViewStyle;
  paddingHorizontal?: number;
  paddingVertical?: number;
  children: React.ReactNode;
}

type Sparkle = { x: number; y: number; size: number; delay: number; duration: number };

function makeSparkles(count: number, sizeMin = 2, sizeMax = 6): Sparkle[] {
  const out: Sparkle[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
      delay: Math.random() * 1500,
      duration: 1200 + Math.random() * 1800,
    });
  }
  return out;
}

function Sparkles({ color, count = 10, sizeMin = 2, sizeMax = 6 }: { color: string; count?: number; sizeMin?: number; sizeMax?: number }) {
  const sparkles = useMemo(() => makeSparkles(count, sizeMin, sizeMax), [count, sizeMin, sizeMax]);
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

/** Diagonal moving stripes — used by "wave" effect */
function WaveStripes({ color, borderRadius }: { color: string; borderRadius: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const l = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
    );
    l.start();
    return () => l.stop();
  }, [v]);
  const translateX1 = v.interpolate({ inputRange: [0, 1], outputRange: [-220, 220] });
  const translateX2 = v.interpolate({ inputRange: [0, 1], outputRange: [-260, 180] });
  const translateX3 = v.interpolate({ inputRange: [0, 1], outputRange: [-300, 140] });
  const stripe = (w: number, op: number, tx: Animated.AnimatedInterpolation<number>) => (
    <Animated.View style={{
      position: "absolute", top: -40, bottom: -40, width: w,
      backgroundColor: color, opacity: op,
      transform: [{ translateX: tx }, { skewX: "-25deg" }],
    }} />
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
      {stripe(28, 0.55, translateX1)}
      {stripe(14, 0.40, translateX2)}
      {stripe(8,  0.30, translateX3)}
    </View>
  );
}

/** Strong radial bloom — used by "glowBurst" effect */
function GlowBurst({ color, borderRadius }: { color: string; borderRadius: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] });
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.85] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", alignItems: "center", justifyContent: "center" }]}>
      <Animated.View style={{
        width: "120%", height: "240%", borderRadius: 9999,
        backgroundColor: color, opacity,
        transform: [{ scale }],
        shadowColor: color, shadowOpacity: 1, shadowRadius: 30,
      }} />
    </View>
  );
}

/** Slow swirling colorful blob — used by "nebula" effect */
function Nebula({ colors, borderRadius }: { colors: readonly [string, string, ...string[]]; borderRadius: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  const scl = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rot.setValue(0); scl.setValue(0);
    const l1 = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    const l2 = Animated.loop(Animated.sequence([
      Animated.timing(scl, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scl, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [rot, scl]);
  const rotateDeg = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = scl.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.35] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", alignItems: "center", justifyContent: "center" }]}>
      <Animated.View style={{
        width: "220%", height: "220%", borderRadius: 9999, opacity: 0.85,
        transform: [{ rotate: rotateDeg }, { scale }],
      }}>
        <LinearGradient
          colors={colors}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={{ flex: 1, borderRadius: 9999 }}
        />
      </Animated.View>
    </View>
  );
}

/** Flying bats with crimson glow — used by "bats" effect */
type Bat = { y: number; size: number; delay: number; duration: number; flap: number };
function makeBats(count: number): Bat[] {
  const out: Bat[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      y: 5 + Math.random() * 80,
      size: 14 + Math.random() * 18,
      delay: Math.random() * 3500,
      duration: 4500 + Math.random() * 3500,
      flap: 220 + Math.random() * 180,
    });
  }
  return out;
}
function FlyingBat({ bat, glow }: { bat: Bat; glow: string }) {
  const fly = useRef(new Animated.Value(0)).current;
  const flap = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fly.setValue(0); flap.setValue(0);
    const l1 = Animated.loop(
      Animated.sequence([
        Animated.delay(bat.delay),
        Animated.timing(fly, { toValue: 1, duration: bat.duration, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(fly, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(3000),
      ]),
    );
    const l2 = Animated.loop(
      Animated.sequence([
        Animated.timing(flap, { toValue: 1, duration: bat.flap, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(flap, { toValue: 0, duration: bat.flap, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, [fly, flap, bat]);
  const translateX = fly.interpolate({ inputRange: [0, 1], outputRange: [260, -80] });
  const translateY = flap.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] });
  const scaleY = flap.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.1] });
  return (
    <Animated.Text
      style={{
        position: "absolute",
        top: `${bat.y}%`,
        left: 0,
        fontSize: bat.size,
        color: "#0A0008",
        textShadowColor: glow,
        textShadowRadius: 8,
        transform: [{ translateX }, { translateY }, { scaleY }],
      }}
    >
      🦇
    </Animated.Text>
  );
}
function Bats({ glow, borderRadius }: { glow: string; borderRadius: number }) {
  const bats = useMemo(() => makeBats(7), []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
      {bats.map((b, i) => <FlyingBat key={i} bat={b} glow={glow} />)}
    </View>
  );
}

/** Rotating rainbow gradient — used by "prismatic" effect */
function Prismatic({ colors, borderRadius }: { colors: readonly [string, string, ...string[]]; borderRadius: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    rot.setValue(0);
    const l = Animated.loop(Animated.timing(rot, { toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [rot]);
  const rotateDeg = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const looped = [...colors, colors[0]] as readonly [string, string, ...string[]];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", alignItems: "center", justifyContent: "center" }]}>
      <Animated.View style={{
        width: "250%", height: "250%", opacity: 0.95,
        transform: [{ rotate: rotateDeg }],
      }}>
        <LinearGradient
          colors={looped}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
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
  const highlight = bg.highlight ?? "#FFFFFF";

  return (
    <View style={[
      styles.wrap,
      { borderRadius, paddingHorizontal, paddingVertical, borderColor: bg.highlight ?? "rgba(255,255,255,0.2)" },
      style,
    ]}>
      {eff === "prismatic" ? (
        <Prismatic colors={colors} borderRadius={borderRadius} />
      ) : (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius }]}
        />
      )}
      {eff === "nebula" && <Nebula colors={colors} borderRadius={borderRadius} />}
      {eff === "glowBurst" && <GlowBurst color={highlight} borderRadius={borderRadius} />}
      {eff === "wave" && <WaveStripes color={highlight} borderRadius={borderRadius} />}
      {eff === "bats" && (
        <>
          <GlowBurst color={highlight} borderRadius={borderRadius} />
          <Bats glow={highlight} borderRadius={borderRadius} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
            <Sparkles color={highlight} count={14} sizeMin={1.5} sizeMax={3} />
          </View>
        </>
      )}
      {eff === "blackDiamond" && (
        <>
          {/* iridescent facet wash */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", opacity: 0.55 }]}>
            <LinearGradient
              colors={["rgba(180,200,255,0.10)", "rgba(220,200,255,0.05)", "rgba(120,160,255,0.12)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1 }}
            />
          </View>
          {/* slow facet shimmer sweep */}
          <WaveStripes color="#FFFFFF" borderRadius={borderRadius} />
          {/* dense bright diamond twinkles */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
            <Sparkles color="#FFFFFF" count={28} sizeMin={1.3} sizeMax={3.8} />
          </View>
          {/* a few large iridescent flares */}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
            <Sparkles color="#B5C7FF" count={6} sizeMin={3} sizeMax={6} />
          </View>
        </>
      )}
      {eff === "starfield" && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden" }]}>
          <Sparkles color={highlight} count={36} sizeMin={1.2} sizeMax={3.2} />
        </View>
      )}
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
