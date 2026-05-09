export interface CharacterDef {
  id: string;
  name: string;
  /** Emoji glyph used as the character body. */
  emoji: string;
  /** Glow halo color behind the character (tier 2 & 3). */
  glow?: string;
  /** Slow up-and-down bobbing animation (tier 2 & 3). */
  float?: boolean;
  /** Soft scale pulse animation (tier 3). */
  pulse?: boolean;
  /** Two small particles orbiting around the character (tier 3). */
  sparkle?: boolean;
  /** Fixed rainbow gradient ring around the body (tier 3 only). */
  rainbow?: boolean;
  /** Custom gradient ring colors (overrides rainbow palette). */
  ringGradient?: readonly [string, string, ...string[]];
}

export const CHARACTERS: CharacterDef[] = [
  // ── 1-10 normal companions (no effects) ───────────────────────────
  { id: "char-1",  name: "قطة",       emoji: "🐱" },
  { id: "char-2",  name: "كلب",       emoji: "🐶" },
  { id: "char-3",  name: "أرنب",      emoji: "🐰" },
  { id: "char-4",  name: "ثعلب",      emoji: "🦊" },
  { id: "char-5",  name: "باندا",     emoji: "🐼" },
  { id: "char-6",  name: "بطريق",     emoji: "🐧" },
  { id: "char-7",  name: "بومة",      emoji: "🦉" },
  { id: "char-8",  name: "ضفدع",      emoji: "🐸" },
  { id: "char-9",  name: "هامستر",    emoji: "🐹" },
  { id: "char-10", name: "حصان",      emoji: "🐴" },

  // ── 11-15 cooler + glow + float ───────────────────────────────────
  { id: "char-11", name: "طاووس",       emoji: "🦚", glow: "#06B6D4",   float: true },
  { id: "char-12", name: "شبح متوهج",   emoji: "👻", glow: "#A78BFA",   float: true },
  { id: "char-13", name: "نسر مهيب",    emoji: "🦅", glow: "#60A5FA",   float: true },
  { id: "char-14", name: "أسد ملكي",    emoji: "🦁", glow: "#F59E0B",   float: true },
  { id: "char-15", name: "ساحر",        emoji: "🧙", glow: "#C084FC",   float: true },

  // ── 16-20 legendary + glow + float + animations ───────────────────
  { id: "char-16", name: "وردة سوداء",   emoji: "🥀", glow: "#DC2626", float: true, pulse: true,   sparkle: true },
  { id: "char-17", name: "تنين أسطوري",  emoji: "🐉", glow: "#22C55E", float: true, pulse: true,   sparkle: true },
  { id: "char-18", name: "فراشة سحرية",  emoji: "🦋", glow: "#EC4899", float: true, pulse: true,   sparkle: true },
  { id: "char-19", name: "سكلتون",       emoji: "💀", glow: "#DC2626", float: true, pulse: true,   sparkle: true,
    ringGradient: ["#000000", "#7F1D1D", "#DC2626", "#7F1D1D", "#000000"] },
  { id: "char-20", name: "أسطوري",        emoji: "🦄", glow: "#FFFFFF", float: true, pulse: true,   sparkle: true, rainbow: true },
];

export function getCharacter(id: string | null): CharacterDef | null {
  if (!id) return null;
  return CHARACTERS.find(c => c.id === id) ?? null;
}

export const CHARACTER_PRICE = (idx: number): number => {
  if (idx < 10) return 300;
  if (idx < 15) return 1200;
  return 3000;
};
