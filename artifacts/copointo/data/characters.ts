export interface CharacterDef {
  id: string;
  name: string;
  /** Emoji glyph used as the character body (fallback when no image). */
  emoji: string;
  /** Optional image asset (require'd) rendered instead of the emoji. */
  image?: number;
  /** Glow halo color behind the character. */
  glow?: string;
  /** Slow up-and-down bobbing animation. */
  float?: boolean;
  /** Soft scale pulse animation. */
  pulse?: boolean;
  /** Two small particles orbiting around the character. */
  sparkle?: boolean;
  /** Fixed rainbow gradient ring around the body. */
  rainbow?: boolean;
  /** Custom gradient ring colors (overrides rainbow palette). */
  ringGradient?: readonly [string, string, ...string[]];
  /** Per-character size multiplier applied on top of the base size. */
  scale?: number;
  /** If true, every user owns this character by default (free starter). */
  defaultOwned?: boolean;
  /** Restrict character visibility/ownership to a specific gender. */
  genderLocked?: "male" | "female";
}

export const CHARACTERS: CharacterDef[] = [
  // ── Free starters (gender-locked) ─────────────────────────────────
  { id: "char-1", name: "الولد",  emoji: "🧒", genderLocked: "male",
    image: require("../assets/images/characters/char-01.png"),
    defaultOwned: true, glow: "#E8B86D", scale: 1.25 },
  { id: "char-2", name: "البنت", emoji: "👧", genderLocked: "female",
    image: require("../assets/images/characters/char-02.png"),
    defaultOwned: true, glow: "#F472B6", scale: 1.25 },

  // ── Paid characters (5,000 coins each) ────────────────────────────
  { id: "char-3",  name: "الشاب الكاجوال",   emoji: "🧑",
    image: require("../assets/images/characters/char-03.png"),
    glow: "#9CA3AF", scale: 1.25 },
  { id: "char-4",  name: "فتاة الهودي",       emoji: "👩",
    image: require("../assets/images/characters/char-04.png"),
    glow: "#A78BFA", scale: 1.25 },
  { id: "char-5",  name: "ولد المدرسة",        emoji: "🎒",
    image: require("../assets/images/characters/char-05.png"),
    glow: "#60A5FA", scale: 1.25 },
  { id: "char-6",  name: "البنت الذهبية",      emoji: "💛",
    image: require("../assets/images/characters/char-06.png"),
    glow: "#FCD34D", scale: 1.25 },
  { id: "char-7",  name: "الولد المثقّف",      emoji: "🤓",
    image: require("../assets/images/characters/char-07.png"),
    glow: "#E5E7EB", scale: 1.25 },
  { id: "char-8",  name: "فتاة القهوة",        emoji: "☕",
    image: require("../assets/images/characters/char-08.png"),
    glow: "#D4A373", scale: 1.25 },
  { id: "char-9",  name: "المصوّر",             emoji: "📸",
    image: require("../assets/images/characters/char-09.png"),
    glow: "#A3A3A3", scale: 1.25 },
  { id: "char-10", name: "ساحر الظلام",        emoji: "🔮",
    image: require("../assets/images/characters/char-10.png"),
    glow: "#a855f7", scale: 1.3,
    ringGradient: ["#1E1B4B", "#7E22CE", "#A855F7", "#7E22CE", "#1E1B4B"] },
  { id: "char-11", name: "ساحرة الذهب",        emoji: "🌟",
    image: require("../assets/images/characters/char-11.png"),
    glow: "#FCD34D", scale: 1.3,
    ringGradient: ["#451A03", "#B45309", "#FCD34D", "#B45309", "#451A03"] },
  { id: "char-12", name: "الفارس الذهبي",      emoji: "⚔️",
    image: require("../assets/images/characters/char-12.png"),
    glow: "#FBBF24", scale: 1.3,
    ringGradient: ["#1F2937", "#B45309", "#FBBF24", "#B45309", "#1F2937"] },
  { id: "char-13", name: "ساحر الكتاب",        emoji: "📖",
    image: require("../assets/images/characters/char-13.png"),
    glow: "#60A5FA", scale: 1.3,
    ringGradient: ["#0C0A2C", "#1D4ED8", "#60A5FA", "#1D4ED8", "#0C0A2C"] },
  { id: "char-14", name: "محارب السيف",        emoji: "🗡️",
    image: require("../assets/images/characters/char-14.png"),
    glow: "#DC2626", scale: 1.3,
    ringGradient: ["#000000", "#7F1D1D", "#DC2626", "#7F1D1D", "#000000"] },
  { id: "char-15", name: "ملكة البنفسج",        emoji: "👑",
    image: require("../assets/images/characters/char-15.png"),
    glow: "#a855f7", scale: 1.3,
    ringGradient: ["#1E1B4B", "#6D28D9", "#C084FC", "#6D28D9", "#1E1B4B"] },
  { id: "char-16", name: "أمير الجليد",         emoji: "❄️",
    image: require("../assets/images/characters/char-16.png"),
    glow: "#60A5FA", scale: 1.3,
    ringGradient: ["#0C4A6E", "#0EA5E9", "#BAE6FD", "#0EA5E9", "#0C4A6E"] },
  { id: "char-17", name: "الملك الذهبي",        emoji: "🤴",
    image: require("../assets/images/characters/char-17.png"),
    glow: "#DC2626", scale: 1.3,
    ringGradient: ["#450A0A", "#B91C1C", "#FCD34D", "#B91C1C", "#450A0A"] },
  { id: "char-18", name: "أميرة الإلف",         emoji: "🧝",
    image: require("../assets/images/characters/char-18.png"),
    glow: "#84CC16", scale: 1.3,
    ringGradient: ["#1A2E05", "#4D7C0F", "#A3E635", "#4D7C0F", "#1A2E05"] },
];

/** IDs that are free-to-own (price = 0). Both gender-locked starters. */
export const FREE_CHARACTER_IDS: readonly string[] = ["char-1", "char-2"];

export function getCharacter(id: string | null): CharacterDef | null {
  if (!id) return null;
  return CHARACTERS.find(c => c.id === id) ?? null;
}

/** Picks the free starter that matches the user's gender, defaults to boy. */
export function defaultCharacterForGender(
  gender?: "male" | "female" | null,
): string {
  return gender === "female" ? "char-2" : "char-1";
}

/** Character IDs priced at the cheaper 1,000 tier (first 7 paid characters). */
const CHEAP_CHARACTER_IDS = new Set([
  "char-3", "char-4", "char-5", "char-6", "char-7", "char-8", "char-9",
]);

export const CHARACTER_PRICE = (idx: number): number => {
  const ch = CHARACTERS[idx];
  if (!ch) return 5000;
  if (FREE_CHARACTER_IDS.includes(ch.id)) return 0;
  if (CHEAP_CHARACTER_IDS.has(ch.id)) return 1000;
  return 5000;
};
