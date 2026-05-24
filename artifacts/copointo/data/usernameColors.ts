export interface UsernameColorDef {
  id: string;
  name: string;
  /** Solid color (used when no gradient/mix). */
  color?: string;
  /** Gradient stops for tier-3 fancy entries. */
  gradient?: readonly [string, string, ...string[]];
  /** Mix of colors cycled per character (tier-2 mixed entries). */
  mix?: readonly string[];
  /** Glow/shine on the text. */
  shine?: boolean;
  /** Optional motion effect (animated luxury tier). */
  anim?: "shimmer" | "rainbow" | "pulse" | "wave" | "fire";
  /** Optional fancy background card around the username (tier-3). */
  bg?: {
    /** Solid background — overridden by gradient if provided. */
    color?: string;
    /** Gradient backdrop. */
    gradient?: readonly [string, string, ...string[]];
    border: string;
  };
  defaultOwned?: boolean;
}

export const USERNAME_COLORS: UsernameColorDef[] = [
  // ── fancy gradient names with framed background ──────────────
  {
    id: "uc-16", name: "غروب فخم",
    gradient: ["#FFD93D", "#FFFFFF", "#FFD93D"], shine: true,
    bg: { gradient: ["#3B0F0F", "#7C2D12", "#3B0F0F"], border: "#FF8A4C" },
  },
  {
    id: "uc-17", name: "محيط فخم",
    gradient: ["#7DD3FC", "#FFFFFF", "#7DD3FC"], shine: true,
    bg: { gradient: ["#0C1E3D", "#1E3A8A", "#0C1E3D"], border: "#60A5FA" },
  },
  {
    id: "uc-18", name: "زمرد فخم",
    gradient: ["#A7F3D0", "#FFFFFF", "#A7F3D0"], shine: true,
    bg: { gradient: ["#022C22", "#065F46", "#022C22"], border: "#34D399" },
  },
  {
    id: "uc-19", name: "ملكي بنفسجي",
    gradient: ["#E9D5FF", "#FFFFFF", "#E9D5FF"], shine: true,
    bg: { gradient: ["#1E1033", "#4C1D95", "#1E1033"], border: "#C084FC" },
  },
  {
    id: "uc-20", name: "ذهب ملكي",
    gradient: ["#FFF1B0", "#FFD700", "#FFF1B0"], shine: true,
    bg: { gradient: ["#2A1A05", "#5C3D0A", "#2A1A05"], border: "#FFD700" },
  },
  // ── Distinct gradient tier ─────────────────────────────────────
  {
    id: "uc-21", name: "💖 وردي ماسي",
    gradient: ["#FFD6F1", "#FF6FB5", "#C71585", "#FF6FB5", "#FFD6F1"], shine: true, anim: "rainbow",
    bg: { gradient: ["#2A0820", "#5C1148", "#2A0820"], border: "#FF6FB5" },
  },
  {
    id: "uc-22", name: "🌈 قوس قزح",
    gradient: ["#FF3B3B", "#FFB400", "#3CD96C", "#3A8DFF", "#A640FF", "#FF3B3B"], shine: true, anim: "rainbow",
    bg: { gradient: ["#0a0a0a", "#1a0a2e", "#0a0a0a"], border: "#A640FF" },
  },
  {
    id: "uc-23", name: "💚 لايم نيون",
    gradient: ["#F4FFB0", "#C8FF3D", "#7CFC00", "#C8FF3D", "#F4FFB0"], shine: true, anim: "rainbow",
    bg: { gradient: ["#0B1F00", "#1E4A00", "#0B1F00"], border: "#C8FF3D" },
  },
  {
    id: "uc-24", name: "🟠 نحاسي ملكي",
    gradient: ["#FFD4A8", "#E07A28", "#7C3A0E", "#E07A28", "#FFD4A8"], shine: true, anim: "rainbow",
    bg: { gradient: ["#1F0E04", "#4A1F08", "#1F0E04"], border: "#E07A28" },
  },
  {
    id: "uc-25", name: "⚪ فضي بلاتيني",
    gradient: ["#FFFFFF", "#D9DCE0", "#8C97A1", "#D9DCE0", "#FFFFFF"], shine: true, anim: "rainbow",
    bg: { gradient: ["#0E1116", "#252A33", "#0E1116"], border: "#D9DCE0" },
  },
];

export function getUsernameColor(id: string | null): UsernameColorDef | null {
  if (!id) return null;
  return USERNAME_COLORS.find(u => u.id === id) ?? null;
}

/**
 * Pricing: static colors 5,000 — animated luxury tier 12,000.
 */
export const USERNAME_COLOR_PRICE = (idx: number): number => {
  const def = USERNAME_COLORS[idx];
  return def?.anim ? 12000 : 5000;
};
