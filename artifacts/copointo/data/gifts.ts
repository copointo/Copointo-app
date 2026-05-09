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
  // ── 1-10 normal gifts (50 coins, 1.5s simple pop) ─────────────────
  { id: "gift-1",  name: "وردة",       emoji: "🌹", price: 50,  tier: 1, color: "#EF4444" },
  { id: "gift-2",  name: "قلب",        emoji: "❤️", price: 50,  tier: 1, color: "#EC4899" },
  { id: "gift-3",  name: "جوهرة",      emoji: "💎", price: 50,  tier: 1, color: "#06B6D4" },
  { id: "gift-4",  name: "شوكولاتة",   emoji: "🍫", price: 50,  tier: 1, color: "#92400E" },
  { id: "gift-5",  name: "آيس كريم",   emoji: "🍦", price: 50,  tier: 1, color: "#F472B6" },
  { id: "gift-6",  name: "دونات",      emoji: "🍩", price: 50,  tier: 1, color: "#F59E0B" },
  { id: "gift-7",  name: "بالون",      emoji: "🎈", price: 50,  tier: 1, color: "#DC2626" },
  { id: "gift-8",  name: "زهرة",       emoji: "🌸", price: 50,  tier: 1, color: "#EC4899" },
  { id: "gift-9",  name: "نجمة",       emoji: "⭐", price: 50,  tier: 1, color: "#FBBF24" },
  { id: "gift-10", name: "برسيم الحظ", emoji: "🍀", price: 50,  tier: 1, color: "#22C55E" },

  // ── 11-15 fancy gifts (300 coins, 2.5s with sparkles) ─────────────
  { id: "gift-11", name: "قلب مغلّف",   emoji: "💝", price: 300, tier: 2, color: "#EF4444",
    particles: ["✨", "💕", "✨"] },
  { id: "gift-12", name: "وردة استوائية", emoji: "🌺", price: 300, tier: 2, color: "#F97316",
    particles: ["🌸", "✨", "🌼"] },
  { id: "gift-13", name: "خاتم ذهبي",   emoji: "💍", price: 300, tier: 2, color: "#FBBF24",
    particles: ["✨", "💫", "⭐"] },
  { id: "gift-14", name: "صندوق هدايا", emoji: "🎁", price: 300, tier: 2, color: "#E8B86D",
    particles: ["🎉", "✨", "🎊"] },
  { id: "gift-15", name: "تاج",          emoji: "👑", price: 300, tier: 2, color: "#FFD700",
    particles: ["✨", "💎", "⭐"] },

  // ── 16-20 cinematic gifts (1000+ coins, 3.5s+ full-screen) ────────
  { id: "gift-16", name: "يونيكورن سحري", emoji: "🦄", price: 1000, tier: 3, color: "#A855F7",
    particles: ["✨", "🌈", "💖", "⭐", "🌟"] },
  { id: "gift-17", name: "تنين النار",    emoji: "🐉", price: 1500, tier: 3, color: "#DC2626",
    particles: ["🔥", "✨", "💥", "🔥", "⚡"] },
  { id: "gift-18", name: "مجرة",          emoji: "🌌", price: 2000, tier: 3, color: "#6366F1",
    particles: ["✨", "🌟", "💫", "⭐", "🌠"] },
  { id: "gift-19", name: "مطر القلوب",    emoji: "💖", price: 2500, tier: 3, color: "#EC4899",
    particles: ["💕", "💖", "💗", "💝", "❤️"] },
  { id: "gift-20", name: "كأس أسطوري",    emoji: "🏆", price: 3000, tier: 3, color: "#FFD700",
    particles: ["🎉", "✨", "🎊", "🌟", "💫"] },
];

export function getGift(id: string | null | undefined): GiftDef | null {
  if (!id) return null;
  return GIFTS.find(g => g.id === id) ?? null;
}
