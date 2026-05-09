export interface TextStyleDef {
  id: string;
  name: string;
  /** Color of the message text. */
  textColor: string;
  /** Optional themed bubble background (used in tiers 2 & 3). */
  bg?: {
    color?: string;
    gradient?: readonly [string, string, ...string[]];
    border: string;
  };
  /** Animated shimmer overlay across the bubble (tier 3). */
  shine?: boolean;
  defaultOwned?: boolean;
}

export const TEXT_STYLES: TextStyleDef[] = [
  // ── 1-10: text color on transparent-black bubble (like incoming msgs) ─
  { id: "ts-1",  name: "أبيض",         textColor: "#FFFFFF", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-2",  name: "ذهبي",         textColor: "#FFD700", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-3",  name: "أحمر",         textColor: "#EF4444", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-4",  name: "أخضر",         textColor: "#22C55E", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-5",  name: "أزرق",         textColor: "#3B82F6", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-6",  name: "بنفسجي",       textColor: "#8B5CF6", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-7",  name: "وردي",         textColor: "#EC4899", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-8",  name: "تركواز",       textColor: "#06B6D4", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-9",  name: "ليموني",       textColor: "#FACC15", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },
  { id: "ts-10", name: "برتقالي",      textColor: "#F97316", bg: { color: "rgba(10,6,6,0.85)", border: "rgba(232,184,109,0.30)" } },

  // ── 11-15: full themed bubble (bg + text color) ─────────────────────
  {
    id: "ts-11", name: "ثيم بحري",
    textColor: "#E0F2FE",
    bg: { gradient: ["#0C1E3D", "#1E3A8A"], border: "#60A5FA" },
  },
  {
    id: "ts-12", name: "ثيم زمردي",
    textColor: "#D1FAE5",
    bg: { gradient: ["#022C22", "#065F46"], border: "#34D399" },
  },
  {
    id: "ts-13", name: "ثيم بنفسجي",
    textColor: "#F3E8FF",
    bg: { gradient: ["#1E1033", "#4C1D95"], border: "#C084FC" },
  },
  {
    id: "ts-14", name: "ثيم وردي",
    textColor: "#FCE7F3",
    bg: { gradient: ["#3B0F26", "#9D174D"], border: "#F472B6" },
  },
  {
    id: "ts-15", name: "ثيم رمادي ناعم",
    textColor: "#FFFFFF",
    bg: { gradient: ["#1A1A1A", "#2D2D2D"], border: "#9CA3AF" },
  },

  // ── 16-20: themed bubble with animated shimmer ──────────────────────
  {
    id: "ts-16", name: "نار متحركة",
    textColor: "#FFE4B5",
    bg: { gradient: ["#3B0F0F", "#7C2D12"], border: "#FB923C" },
    shine: true,
  },
  {
    id: "ts-17", name: "ذهب لامع",
    textColor: "#000000",
    bg: { gradient: ["#FFD700", "#FFA500", "#FFD700"], border: "#FFF1B0" },
    shine: true,
  },
  {
    id: "ts-18", name: "محيط لامع",
    textColor: "#E0F2FE",
    bg: { gradient: ["#0C1E3D", "#1E3A8A", "#0C1E3D"], border: "#7DD3FC" },
    shine: true,
  },
  {
    id: "ts-19", name: "بنفسجي ملكي",
    textColor: "#F3E8FF",
    bg: { gradient: ["#1E1033", "#4C1D95", "#1E1033"], border: "#E9D5FF" },
    shine: true,
  },
  {
    id: "ts-20", name: "أسطوري",
    textColor: "#FFFFFF",
    bg: { gradient: ["#FF6B6B", "#FFD93D", "#22C55E", "#3B82F6", "#8B5CF6"], border: "#FFFFFF" },
    shine: true,
  },
];

export function getTextStyle(id: string | null): TextStyleDef | null {
  if (!id) return null;
  return TEXT_STYLES.find(t => t.id === id) ?? null;
}

export const TEXT_STYLE_PRICE = (idx: number): number => {
  if (idx < 10) return 800;
  if (idx < 15) return 800;
  return 2000;
};
