import React from "react";
import { Text, TextStyle, StyleProp } from "react-native";
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
}

function shineStyle(color: string): TextStyle {
  return {
    textShadowColor: color,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  };
}

/**
 * Renders a username with the user's equipped color/gradient/shine effect.
 * For gradient entries we approximate gradient text by per-character coloring,
 * since masked-view isn't available in this project.
 */
export default function UsernameText({ text, style, override, fallbackColor = "#FFFFFF", numberOfLines }: Props) {
  const { equipped } = useUsernameColors();
  const def: UsernameColorDef | null =
    override !== undefined ? override : getUsernameColor(equipped);

  if (!def) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  if (def.gradient && def.gradient.length >= 2) {
    const stops = def.gradient;
    // Arabic / RTL scripts rely on contextual letter shaping that breaks when
    // each glyph is rendered as its own <Text>. For those (and emoji/ZWJ),
    // fall back to a representative gradient color + shine instead of
    // per-character coloring.
    const needsShaping = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\u200C\u200D]|\uD83C|\uD83D|\uD83E/.test(text);
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

  const color = def.color ?? fallbackColor;
  const merged: TextStyle = { color };
  if (def.shine) Object.assign(merged, shineStyle(color));
  return <Text style={[style, merged]} numberOfLines={numberOfLines}>{text}</Text>;
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
