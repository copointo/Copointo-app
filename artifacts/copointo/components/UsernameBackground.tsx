import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
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
    let loop: Animated.CompositeAnimation | null = null;
    if (bg.effect === "shimmer") {
      shimmer.setValue(0);
      loop = Animated.loop(
        Animated.timing(shimmer, {
          toValue: 1, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      );
    } else if (bg.effect === "pulse") {
      pulse.setValue(0);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      );
    } else if (bg.effect === "rotate") {
      rotate.setValue(0);
      loop = Animated.loop(
        Animated.timing(rotate, {
          toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true,
        }),
      );
    }
    if (loop) loop.start();
    return () => { if (loop) loop.stop(); };
  }, [bg, shimmer, pulse, rotate]);

  if (!bg) {
    return <View style={[{ paddingHorizontal, paddingVertical }, style]}>{children}</View>;
  }

  const colors = bg.colors as unknown as readonly [string, string, ...string[]];
  const rotateDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const shimmerTranslate = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] });

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
      {bg.effect === "rotate" && (
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius, overflow: "hidden", transform: [{ rotate: rotateDeg }] }]}>
          <LinearGradient
            colors={[...colors, colors[0]] as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: "200%", height: "200%", marginLeft: "-50%", marginTop: "-50%" }}
          />
        </Animated.View>
      )}
      {bg.effect === "pulse" && bg.highlight && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, backgroundColor: bg.highlight, opacity: pulseOpacity },
          ]}
        />
      )}
      {bg.effect === "shimmer" && bg.highlight && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius, overflow: "hidden" },
          ]}
        >
          <Animated.View style={{
            position: "absolute",
            top: 0, bottom: 0,
            width: 80,
            transform: [{ translateX: shimmerTranslate }, { skewX: "-20deg" }],
            backgroundColor: bg.highlight,
            opacity: 0.35,
          }} />
        </Animated.View>
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
