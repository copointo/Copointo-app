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
  /** Per-character size multiplier applied on top of the base size. */
  scale?: number;
  /** If true, every user owns this character by default (free starter). */
  defaultOwned?: boolean;
}

export const CHARACTERS: CharacterDef[] = [
  // ── 1-10 normal companions ────────────────────────────────────────
  { id: "char-1",  name: "قطة",       emoji: "🐱", defaultOwned: true },
  { id: "char-2",  name: "أسد",       emoji: "🦁" },
  { id: "char-3",  name: "أرنب",      emoji: "🐰" },
  { id: "char-4",  name: "ثعلب",      emoji: "🦊" },
  { id: "char-5",  name: "باندا",     emoji: "🐼" },
  { id: "char-6",  name: "بطريق",     emoji: "🐧" },
  { id: "char-7",  name: "بومة",      emoji: "🦉" },
  { id: "char-8",  name: "ضفدع",      emoji: "🐸" },
  { id: "char-9",  name: "هامستر",    emoji: "🐹" },
  { id: "char-10", name: "حصان",      emoji: "🐴" },

  // ── 11-15 cooler companions ───────────────────────────────────────
  { id: "char-11", name: "طاووس",       emoji: "🦚" },
  { id: "char-12", name: "شبح متوهج",   emoji: "👻" },
  { id: "char-13", name: "نسر مهيب",    emoji: "🦅" },
  { id: "char-14", name: "كرة بلورية",  emoji: "🔮" },
  { id: "char-15", name: "ساحر",        emoji: "🧙" },

  // ── 16-20 legendary ───────────────────────────────────────────────
  { id: "char-16", name: "وردة سوداء",   emoji: "🥀" },
  { id: "char-17", name: "تنين أسطوري",  emoji: "🐉" },
  { id: "char-18", name: "فراشة سحرية",  emoji: "🦋" },
  { id: "char-19", name: "زومبي",        emoji: "🧟", scale: 1.15,
    ringGradient: ["#000000", "#7F1D1D", "#DC2626", "#7F1D1D", "#000000"] },
  { id: "char-20", name: "أسطوري",       emoji: "🦄", rainbow: true },
];

const PRICE_OVERRIDES: Record<string, number> = {
  "char-13": 2000,
  "char-14": 2000,
  "char-15": 2000,
  "char-16": 2000,
  "char-17": 5000,
  "char-18": 5000,
  "char-19": 10000,
  "char-20": 10000,
};

export function getCharacter(id: string | null): CharacterDef | null {
  if (!id) return null;
  return CHARACTERS.find(c => c.id === id) ?? null;
}

export const CHARACTER_PRICE = (idx: number): number => {
  const ch = CHARACTERS[idx];
  if (ch && PRICE_OVERRIDES[ch.id] !== undefined) return PRICE_OVERRIDES[ch.id];
  if (idx < 10) return 800;
  if (idx < 15) return 1200;
  return 3000;
};
