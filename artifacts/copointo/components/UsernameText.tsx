import React from "react";
import { Text, TextStyle, StyleProp, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { UsernameColorDef, getUsernameColor } from "../data/usernameColors";
import { useUsernameColors } from "../hooks/useUsernameColors";

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  /** Override the equipped color — if provided, ignores the equipped one. Pass null to use default plain color. */
  override?: UsernameColorDef | null;
  /** Plain fallback color when nothing is equipped/overridden. */
  fallbackColor?: string;
  numberOfLines?: number;
  /** Wrap fancy bg-bearing entries in a colored box. Default true. Set false in tight rows. */
  withBg?: boolean;
}

const SHAPING_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u200C\u200D]|\uD83C|\uD83D|\uD83E/;

function shineStyle(color: string): TextStyle {
  return {
    textShadowColor: color,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  };
}

/**
 * Renders a username with the user's equipped color/mix/gradient/shine effect.
 *
 * Per-character coloring is skipped for Arabic/RTL/emoji text because contextual
 * letter shaping breaks when each glyph is its own <Text>. In that case we fall
 * back to a representative single color + shine.
 *
 * Fancy entries (with `bg`) wrap the username in a small colored card.
 */
export default function UsernameText({
  text, style, override, fallbackColor = "#FFFFFF",
  numberOfLines, withBg = true,
}: Props) {
  const { equipped } = useUsernameColors();
  const def: UsernameColorDef | null =
    override !== undefined ? override : getUsernameColor(equipped);

  if (!def) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const needsShaping = SHAPING_RE.test(text);
  const inner = renderInner(def, text, style, fallbackColor, numberOfLines, needsShaping);

  if (def.bg && withBg) {
    return wrapBg(def.bg, inner);
  }
  return inner;
}

function renderInner(
  def: UsernameColorDef,
  text: string,
  style: StyleProp<TextStyle> | undefined,
  fallbackColor: string,
  numberOfLines: number | undefined,
  needsShaping: boolean,
): React.ReactElement {
  // ── Mix: cycle palette per character ──────────────────────────────────
  if (def.mix && def.mix.length >= 2) {
    if (!needsShaping) {
      const chars = Array.from(text);
      return (
        <Text style={style} numberOfLines={numberOfLines}>
          {chars.map((ch, i) => {
            const color = def.mix![i % def.mix!.length];
            const charStyle: TextStyle = { color };
            if (def.shine) Object.assign(charStyle, shineStyle(color));
            return (
              <Text key={i} style={charStyle}>
                {ch}
              </Text>
            );
          })}
        </Text>
      );
    }
    const color = def.mix[0];
    const merged: TextStyle = { color };
    if (def.shine) Object.assign(merged, shineStyle(color));
    return <Text style={[style, merged]} numberOfLines={numberOfLines}>{text}</Text>;
  }

  // ── Gradient: per-character interpolation ─────────────────────────────
  if (def.gradient && def.gradient.length >= 2) {
    const stops = def.gradient;
    if (!needsShaping) {
      const chars = Array.from(text);
      const last = chars.length - 1;
      return (
        <Text style={style} numberOfLines={numberOfLines}>
          {chars.map((ch, i) => {
            const t = last === 0 ? 0 : i / last;
            const color = sampleGradient(stops, t);
            const charStyle: TextStyle = { color };
            if (def.shine) Object.assign(charStyle, shineStyle(color));
            return (
              <Text key={i} style={charStyle}>
                {ch}
              </Text>
            );
          })}
        </Text>
      );
    }
    const midColor = sampleGradient(stops, 0.5);
    const merged: TextStyle = { color: midColor };
    if (def.shine) Object.assign(merged, shineStyle(sampleGradient(stops, 0)));
    return <Text style={[style, merged]} numberOfLines={numberOfLines}>{text}</Text>;
  }

  // ── Plain solid ───────────────────────────────────────────────────────
  const color = def.color ?? fallbackColor;
  const merged: TextStyle = { color };
  if (def.shine) Object.assign(merged, shineStyle(color));
  return <Text style={[style, merged]} numberOfLines={numberOfLines}>{text}</Text>;
}

function wrapBg(bg: NonNullable<UsernameColorDef["bg"]>, inner: React.ReactElement) {
  const baseBox: ViewStyle = {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: bg.border,
    overflow: "hidden",
    alignSelf: "flex-start",
    shadowColor: bg.border, shadowOpacity: 0.55, shadowRadius: 8,
  };
  if (bg.gradient && bg.gradient.length >= 2) {
    const stops = bg.gradient as readonly [string, string, ...string[]];
    return (
      <View style={baseBox}>
        <LinearGradient
          colors={[...stops] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {inner}
      </View>
    );
  }
  return (
    <View style={[baseBox, { backgroundColor: bg.color ?? "#000" }]}>
      {inner}
    </View>
  );
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = h.length === 3
    ? h.split("").map(c => c + c).join("")
    : h;
  const num = parseInt(v, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => n.toString(16).padStart(2, "0");
  return `#${c(Math.round(r))}${c(Math.round(g))}${c(Math.round(b))}`;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function sampleGradient(stops: readonly string[], t: number): string {
  if (stops.length === 0) return "#FFFFFF";
  if (stops.length === 1) return stops[0];
  const segs = stops.length - 1;
  const scaled = t * segs;
  const i = Math.min(Math.floor(scaled), segs - 1);
  const localT = scaled - i;
  const [r1, g1, b1] = hexToRgb(stops[i]);
  const [r2, g2, b2] = hexToRgb(stops[i + 1]);
  return rgbToHex(lerp(r1, r2, localT), lerp(g1, g2, localT), lerp(b1, b2, localT));
}
