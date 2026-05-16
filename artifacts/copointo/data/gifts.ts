export type GiftTier = 1 | 2 | 3;

/** Animation style for the full-screen gift overlay. */
export type GiftAnimKind = "fall" | "burst" | "spiral" | "zoom" | "video";

export interface GiftDef {
  id: string;
  name: string;
  /** Main emoji shown in catalog and as the body of the animation. */
  emoji: string;
  /** Optional image (e.g. animated GIF) to render instead of the emoji.
   *  Use `require("../assets/...")` so Metro bundles it. */
  image?: number;
  /** Optional MP4 video asset (require'd) used by the "video" animationKind
   *  to play a full-screen cinematic clip. */
  video?: number;
  /** Cost in coins to send this gift. */
  price: number;
  /** Tier 1 = simple, 2 = fancy animated, 3 = cinematic 3+ seconds. */
  tier: GiftTier;
  /** Theme color used for halos, particles and gradient backdrops. */
  color: string;
  /** Optional secondary emojis used as orbiting particles (tier 2 & 3). */
  particles?: readonly string[];
  /** When true, the falling animation renders ONE big particle no matter
   *  the qty (used for cinematic image gifts so the GIF appears once). */
  singleParticle?: boolean;
  /** Animation style. Defaults to "fall". Premium gifts use "burst",
   *  "spiral", or "zoom" for distinctive motion. */
  animationKind?: GiftAnimKind;
  /** Optional override for the on-screen duration in milliseconds.
   *  When omitted, GiftAnimation picks a sensible default per animationKind. */
  durationMs?: number;
}

export const GIFTS: GiftDef[] = [
  // ── all gifts: simple, no halos, no particles ─────────────────────
  { id: "gift-3",  name: "جوهرة",         emoji: "💎", price: 20,   tier: 1, color: "#06B6D4" },
  { id: "gift-6",  name: "دونات",         emoji: "🍩", price: 20,   tier: 1, color: "#F59E0B" },
  { id: "gift-9",  name: "نجمة",          emoji: "⭐", price: 20,   tier: 1, color: "#FBBF24" },
  { id: "gift-12", name: "وردة استوائية", emoji: "🌺", price: 20, tier: 1, color: "#F97316" },
  { id: "gift-15", name: "تاج",           emoji: "👑", price: 20, tier: 1, color: "#FFD700" },
  { id: "gift-19", name: "مطر القلوب",    emoji: "💖", price: 20, tier: 1, color: "#EC4899" },
  // ── premium cinematic gifts (500 coins each) ─────────────────────
  {
    id: "gift-fireworks",
    name: "الألعاب النارية",
    emoji: "🎆",
    particles: ["✨", "💥", "⭐", "🎆"] as const,
    price: 500,
    tier: 3,
    color: "#FF3D7F",
    animationKind: "burst",
  },
  {
    id: "gift-rose-vortex",
    name: "دوامة الورود",
    emoji: "🌹",
    particles: ["🌹", "🌸", "💐", "🌷"] as const,
    price: 500,
    tier: 3,
    color: "#E8B86D",
    animationKind: "spiral",
  },
  {
    id: "gift-legend-diamond",
    name: "الجوهرة الأسطورية",
    emoji: "💎",
    particles: ["✨", "💎", "🌟", "⭐"] as const,
    price: 500,
    tier: 3,
    color: "#7C3AED",
    animationKind: "zoom",
  },
  {
    id: "gift-cinema-video",
    name: "لا مبالي",
    emoji: "😎",
    image: require("../assets/images/gift-indifferent.gif"),
    price: 500,
    tier: 3,
    color: "#E8B86D",
    animationKind: "zoom",
    singleParticle: true,
    durationMs: 5000,
  },
];

export function getGift(id: string | null | undefined): GiftDef | null {
  if (!id) return null;
  return GIFTS.find(g => g.id === id) ?? null;
}
