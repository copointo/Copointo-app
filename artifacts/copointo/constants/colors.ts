// ─── Copointo Black + Amber-Glow Theme ─────────────────────────
// Both light and dark palettes share the same black + amber values
// to keep the entire app consistent with the Profile & Game screens.

const palette = {
  text: "#FFFFFF",
  tint: "#E8B86D",

  background: "#000000",
  foreground: "#FFFFFF",

  card: "#0A0606",
  cardForeground: "#FFFFFF",

  primary: "#E8B86D",
  primaryForeground: "#000000",

  secondary: "#1A1010",
  secondaryForeground: "#E8B86D",

  muted: "#1A1010",
  mutedForeground: "rgba(255,255,255,0.55)",

  accent: "#E8B86D",
  accentForeground: "#000000",

  destructive: "#E55353",
  destructiveForeground: "#FFFFFF",

  border: "rgba(232,184,109,0.30)",
  input: "rgba(232,184,109,0.30)",

  success: "#7DD87D",
  successForeground: "#000000",

  coffee: "#E8B86D",
  espresso: "#000000",
  cream: "#0A0606",
  gold: "#E8B86D",
};

const colors = {
  light: palette,
  dark:  palette,
  radius: 18,
};

export default colors;
