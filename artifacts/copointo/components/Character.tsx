import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CharacterDef } from "../data/characters";

interface Props {
  def: CharacterDef;
  /** Pixel size of the character emoji body. */
  size?: number;
  /** Kept for API compatibility — ignored (no animations). */
  animated?: boolean;
}

/**
 * A small companion (emoji + optional static glow / decorations) that sits
 * above the user's current level tile. Three tiers of visual treatment
 * controlled by CharacterDef:
 *  - tier 1 (1-10):  static emoji
 *  - tier 2 (11-15): glow halo
 *  - tier 3 (16-20): glow + static sparkles + optional rainbow ring
 *
 * NOTE: Animations were intentionally removed per user request.
 */
export default function Character({ def, size = 36 }: Props) {
  const wrapSize = Math.round(size * 1.8);
  const glowSize = Math.round(size * 1.55);

  return (
    <View
      style={{ width: wrapSize, height: wrapSize, alignItems: "center", justifyContent: "center" }}
      pointerEvents="none"
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

      {/* Static sparkles around the character (tier 3) */}
      {def.sparkle && (
        <>
          <View style={{ position: "absolute", top: 2, left: "50%", marginLeft: -4 }}>
            <Text style={styles.sparkle}>✨</Text>
          </View>
          <View style={{ position: "absolute", bottom: 2, left: "50%", marginLeft: -4 }}>
            <Text style={styles.sparkle}>✨</Text>
          </View>
        </>
      )}
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
