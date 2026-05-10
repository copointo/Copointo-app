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
  // ── all gifts: simple, no halos, no particles ─────────────────────
  { id: "gift-3",  name: "جوهرة",         emoji: "💎", price: 20,   tier: 1, color: "#06B6D4" },
  { id: "gift-6",  name: "دونات",         emoji: "🍩", price: 20,   tier: 1, color: "#F59E0B" },
  { id: "gift-9",  name: "نجمة",          emoji: "⭐", price: 20,   tier: 1, color: "#FBBF24" },
  { id: "gift-12", name: "وردة استوائية", emoji: "🌺", price: 20, tier: 1, color: "#F97316" },
  { id: "gift-15", name: "تاج",           emoji: "👑", price: 20, tier: 1, color: "#FFD700" },
  { id: "gift-19", name: "مطر القلوب",    emoji: "💖", price: 20, tier: 1, color: "#EC4899" },
];

export function getGift(id: string | null | undefined): GiftDef | null {
  if (!id) return null;
  return GIFTS.find(g => g.id === id) ?? null;
}
