import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CharacterDef } from "../data/characters";

interface Props {
  def: CharacterDef;
  /** Pixel size of the character emoji body. */
  size?: number;
  /** Optional override for animations (preview tiles can disable to stay still). */
  animated?: boolean;
}

/**
 * A small companion (emoji + optional glow / animations) that floats above the
 * user's current level tile. Three tiers of effects controlled by CharacterDef:
 *  - tier 1 (1-10):  static emoji
 *  - tier 2 (11-15): glow halo + soft float
 *  - tier 3 (16-20): glow + float + scale pulse + orbiting sparkles + rainbow ring
 */
export default function Character({ def, size = 36, animated = true }: Props) {
  const float   = useRef(new Animated.Value(0)).current;
  const pulse   = useRef(new Animated.Value(0)).current;
  const orbit   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const loops: Animated.CompositeAnimation[] = [];
    if (def.float) {
      const a = Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loops.push(a); a.start();
    }
    if (def.pulse) {
      const a = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loops.push(a); a.start();
    }
    if (def.sparkle) {
      const a = Animated.loop(
        Animated.timing(orbit, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
      );
      loops.push(a); a.start();
    }
    return () => { loops.forEach(l => l.stop()); };
  }, [def.float, def.pulse, def.sparkle, animated, float, pulse, orbit]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const scale      = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const rot        = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const wrapSize = Math.round(size * 1.8);
  const glowSize = Math.round(size * 1.55);

  return (
    <View style={{ width: wrapSize, height: wrapSize, alignItems: "center", justifyContent: "center" }} pointerEvents="none">
      <Animated.View
        style={{
          width: wrapSize, height: wrapSize,
          alignItems: "center", justifyContent: "center",
          transform: [{ translateY }, { scale }],
        }}
      >
        {/* Glow halo (tier 2 & 3) */}
        {def.glow && (
          <View style={[
            styles.glow,
            {
              width: glowSize, height: glowSize, borderRadius: glowSize / 2,
              backgroundColor: def.glow,
              shadowColor: def.glow,
            },
          ]} />
        )}

        {/* Rainbow ring (tier 3, char-20) */}
        {def.rainbow && (
          <LinearGradient
            colors={["#FF6B6B", "#FFD93D", "#22C55E", "#3B82F6", "#8B5CF6", "#FF6B6B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              width: glowSize + 6, height: glowSize + 6,
              borderRadius: (glowSize + 6) / 2,
              opacity: 0.45,
            }}
          />
        )}

        {/* Body */}
        <Text style={{ fontSize: size, lineHeight: size * 1.15, textAlign: "center" }}>
          {def.emoji}
        </Text>

        {/* Orbiting sparkles (tier 3) */}
        {def.sparkle && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center", transform: [{ rotate: rot }] },
            ]}
          >
            <View style={{ position: "absolute", top: 0, left: "50%", marginLeft: -4 }}>
              <Text style={styles.sparkle}>✨</Text>
            </View>
            <View style={{ position: "absolute", bottom: 0, left: "50%", marginLeft: -4 }}>
              <Text style={styles.sparkle}>✨</Text>
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: "absolute",
    opacity: 0.30,
    shadowOpacity: 0.95,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  sparkle: { fontSize: 11 },
});
