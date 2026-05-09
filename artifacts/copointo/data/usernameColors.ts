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
  // ── 1-10: plain solid colors ────────────────────────────────────────
  { id: "uc-1",  name: "كريمي",         color: "#FFE0B2" },
  { id: "uc-2",  name: "أمبر",          color: "#E8B86D" },
  { id: "uc-3",  name: "أحمر",          color: "#EF4444" },
  { id: "uc-4",  name: "أخضر",          color: "#22C55E" },
  { id: "uc-5",  name: "أزرق",          color: "#3B82F6" },
  { id: "uc-6",  name: "بنفسجي",        color: "#8B5CF6" },
  { id: "uc-7",  name: "وردي",          color: "#EC4899" },
  { id: "uc-8",  name: "تركواز",        color: "#06B6D4" },
  { id: "uc-9",  name: "ليموني",        color: "#EAB308" },
  { id: "uc-10", name: "برتقالي",       color: "#F97316" },

  // ── 11-15: mixed multi-color names with shine ───────────────────────
  { id: "uc-11", name: "ميكس ذهبي",     mix: ["#FFD700", "#E8B86D", "#FFA500"],                        shine: true },
  { id: "uc-12", name: "ميكس ناري",     mix: ["#FF6B6B", "#FFD93D", "#F97316"],                        shine: true },
  { id: "uc-13", name: "ميكس بحري",     mix: ["#06B6D4", "#3B82F6", "#8B5CF6"],                        shine: true },
  { id: "uc-14", name: "ميكس ربيعي",    mix: ["#22C55E", "#EAB308", "#EC4899"],                        shine: true },
  { id: "uc-15", name: "أسطوري",        mix: ["#FF6B6B", "#FFD93D", "#22C55E", "#3B82F6", "#8B5CF6"], shine: true },

  // ── 16-20: fancy gradient names with framed background ──────────────
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

export const USERNAME_COLOR_PRICE = (idx: number): number => {
  if (idx < 10) return 200;
  if (idx < 15) return 800;
  return 2000;
};
