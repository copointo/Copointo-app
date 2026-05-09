import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

interface Props {
  index?: number;
  delayStep?: number;
  duration?: number;
  translateY?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Wraps children with a fade-in + slide-up animation on mount.
 * Pass `index` to stagger multiple items in a list.
 */
export default function FadeInItem({
  index = 0,
  delayStep = 45,
  duration = 320,
  translateY = 12,
  style,
  children,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    const delay = index * delayStep;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(ty, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, delayStep, duration, opacity, ty]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: ty }] }]}>
      {children}
    </Animated.View>
  );
}
