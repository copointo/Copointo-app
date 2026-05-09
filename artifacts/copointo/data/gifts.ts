export type GiftTier = 1 | 2 | 3;

export interface GiftDef {
  id: string;
  name: string;
  /** Main emoji shown in catalog and as the body of the animation. */
  emoji: string;
  /** Cost in coins to send this gift. */
  price: number;
  /** Tier 1 = simple, 2 = fancy animated, 3 = cinematic 3+ seconds. */
  tier: GiftTier;
  /** Theme color used for halos, particles and gradient backdrops. */
  color: string;
  /** Optional secondary emojis used as orbiting particles (tier 2 & 3). */
  particles?: readonly string[];
}

export const GIFTS: GiftDef[] = [
  // ── normal gifts (50 coins, 1.5s simple pop) ──────────────────────
  { id: "gift-3",  name: "جوهرة",      emoji: "💎", price: 50,  tier: 1, color: "#06B6D4" },
  { id: "gift-6",  name: "دونات",      emoji: "🍩", price: 50,  tier: 1, color: "#F59E0B" },
  { id: "gift-9",  name: "نجمة",       emoji: "⭐", price: 50,  tier: 1, color: "#FBBF24" },

  // ── fancy gifts (300 coins, 2.5s with sparkles) ───────────────────
  { id: "gift-12", name: "وردة استوائية", emoji: "🌺", price: 300, tier: 2, color: "#F97316",
    particles: ["🌸", "✨", "🌼"] },
  { id: "gift-15", name: "تاج",          emoji: "👑", price: 300, tier: 2, color: "#FFD700",
    particles: ["✨", "💎", "⭐"] },

  // ── cinematic gifts (3.5s+ full-screen) ───────────────────────────
  { id: "gift-19", name: "مطر القلوب",    emoji: "💖", price: 2500, tier: 3, color: "#EC4899",
    particles: ["💕", "💖", "💗", "💝", "❤️"] },
];

export function getGift(id: string | null | undefined): GiftDef | null {
  if (!id) return null;
  return GIFTS.find(g => g.id === id) ?? null;
}
