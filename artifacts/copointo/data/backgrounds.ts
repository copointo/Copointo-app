export type BgEffect = "none" | "shimmer" | "pulse" | "rotate" | "sparkle" | "aurora";

export interface BackgroundDef {
  id: string;
  name: string;
  /** Linear-gradient stops (top-left → bottom-right). 2–4 colors. */
  colors: string[];
  /** Optional shimmer/highlight color. */
  highlight?: string;
  effect: BgEffect;
  defaultOwned?: boolean;
}

export const BACKGROUNDS: BackgroundDef[] = [
  // ───── Tier 1 (1-5): solid color, no animation ─────
  { id: "bg-1",  name: "كلاسيكي ذهبي",   colors: ["#3a2510", "#1a0e08"],                       highlight: "#E8B86D", effect: "none", defaultOwned: true },
  { id: "bg-2",  name: "ليل أرجواني",    colors: ["#4A1D7A", "#1B0944"],                        highlight: "#B388FF", effect: "none" },
  { id: "bg-3",  name: "محيط هادئ",      colors: ["#0E7C9C", "#063B5C"],                        highlight: "#7FE3FF", effect: "none" },
  { id: "bg-4",  name: "غابة زمردية",    colors: ["#0F8A3F", "#0B3D1F"],                        highlight: "#A8F0BE", effect: "none" },
  { id: "bg-5",  name: "وردي حالم",      colors: ["#F472B6", "#9D174D"],                        highlight: "#FFD6E8", effect: "none" },

  // ───── Tier 2 (6-10): shimmer (single sweep of light) ─────
  { id: "bg-6",  name: "شفق ذهبي",       colors: ["#E8B86D", "#8B5A2B", "#3a2510"],            highlight: "#FFE5A8", effect: "shimmer" },
  { id: "bg-7",  name: "غروب الكوفي",    colors: ["#FF6B35", "#D6336C", "#7B1F4F"],             highlight: "#FFD580", effect: "shimmer" },
  { id: "bg-8",  name: "سماء صافية",     colors: ["#38BDF8", "#1E40AF"],                        highlight: "#BAE6FD", effect: "shimmer" },
  { id: "bg-9",  name: "بحر فيروزي",     colors: ["#14B8A6", "#0F766E", "#064E3B"],             highlight: "#99F6E4", effect: "shimmer" },
  { id: "bg-10", name: "زمرد ملكي",      colors: ["#10B981", "#065F46"],                        highlight: "#A7F3D0", effect: "shimmer" },

  // ───── Tier 3 (11-15): sparkle (shimmer + pulse + floating particles) ─────
  { id: "bg-11", name: "كرز ملتهب",      colors: ["#EF4444", "#7F1D1D"],                        highlight: "#FCA5A5", effect: "sparkle" },
  { id: "bg-12", name: "لافندر",         colors: ["#A78BFA", "#5B21B6"],                        highlight: "#E9D5FF", effect: "sparkle" },
  { id: "bg-13", name: "شمس صحراوية",    colors: ["#FACC15", "#F97316", "#9A3412"],             highlight: "#FEF08A", effect: "sparkle" },
  { id: "bg-14", name: "أوركيد",         colors: ["#D946EF", "#7E22CE"],                        highlight: "#F0ABFC", effect: "sparkle" },
  { id: "bg-15", name: "فجر وردي",       colors: ["#FBCFE8", "#FB7185", "#9F1239"],             highlight: "#FECDD3", effect: "sparkle" },

  // ───── Tier 4 (16-20): aurora (everything combined — most luxurious) ─────
  { id: "bg-16", name: "نيون",           colors: ["#06B6D4", "#A21CAF", "#F97316"],             highlight: "#67E8F9", effect: "aurora" },
  { id: "bg-17", name: "مجرة",           colors: ["#312E81", "#7E22CE", "#DB2777"],             highlight: "#C4B5FD", effect: "aurora" },
  { id: "bg-18", name: "ذهب وردي",       colors: ["#7A1F3D", "#C2185B", "#E8B86D"],             highlight: "#FFD9C2", effect: "aurora" },
  { id: "bg-19", name: "ليل عميق",       colors: ["#1E3A8A", "#0F172A", "#000000"],             highlight: "#60A5FA", effect: "aurora" },
  { id: "bg-20", name: "نار ملكية",      colors: ["#7F1D1D", "#EA580C", "#FACC15"],             highlight: "#FCD34D", effect: "aurora" },
];

export function getBackground(id: string | null): BackgroundDef | null {
  if (!id) return null;
  return BACKGROUNDS.find(b => b.id === id) ?? null;
}

export const DEFAULT_BACKGROUND_ID = "bg-1";
