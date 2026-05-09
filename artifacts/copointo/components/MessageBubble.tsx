import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, ViewStyle, StyleProp, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { TextStyleDef } from "../data/textStyles";

interface Props {
  style?: StyleProp<ViewStyle>;
  /** Equipped text style — controls bubble bg + animated shimmer. Pass null for default. */
  textStyleDef?: TextStyleDef | null;
  /** Fallback background when no themed bg is provided. */
  fallbackBg: string;
  /** Fallback border when no themed bg is provided. */
  fallbackBorder: string;
  children: React.ReactNode;
}

/**
 * Bubble container that supports an optional gradient/solid themed background
 * and an optional animated shimmer overlay. Used in chat conversation for the
 * sender's own messages; falls back to the original amber bubble otherwise.
 */
export default function MessageBubble({
  style, textStyleDef, fallbackBg, fallbackBorder, children,
}: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!textStyleDef?.shine) return;
    shimmer.setValue(0);
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => { loop.stop(); };
  }, [textStyleDef?.shine, shimmer]);

  const bg = textStyleDef?.bg;
  const baseStyle: ViewStyle = {
    overflow: "hidden",
    backgroundColor: bg?.color ?? (bg?.gradient ? "transparent" : fallbackBg),
    borderColor: bg?.border ?? fallbackBorder,
  };

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 320],
  });

  return (
    <View style={[style, baseStyle]}>
      {bg?.gradient && (
        <LinearGradient
          colors={[...bg.gradient] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {textStyleDef?.shine && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX }, { skewX: "-20deg" }] },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ width: 90, height: "100%" }}
          />
        </Animated.View>
      )}
      <View>{children}</View>
    </View>
  );
}
