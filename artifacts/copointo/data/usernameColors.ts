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
];

export function getUsernameColor(id: string | null): UsernameColorDef | null {
  if (!id) return null;
  return USERNAME_COLORS.find(u => u.id === id) ?? null;
}

export const USERNAME_COLOR_PRICE = (_idx: number): number => 5000;
