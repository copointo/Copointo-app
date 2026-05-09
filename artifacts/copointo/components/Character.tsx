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
  const effSize = Math.round(size * (def.scale ?? 1));
  const wrapSize = Math.round(effSize * 1.8);

  return (
    <View
      style={{ width: wrapSize, height: wrapSize, alignItems: "center", justifyContent: "center" }}
      pointerEvents="none"
    >
      <Text style={{ fontSize: effSize, lineHeight: effSize * 1.15, textAlign: "center" }}>
        {def.emoji}
      </Text>
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
