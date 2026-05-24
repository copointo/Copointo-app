export interface BadgeDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
  /** If true, this badge is unlocked by leveling up — never appears in the item shop. */
  levelReward?: boolean;
  /** Optional fixed price (overrides PRICE_BY_TIER in the shop). */
  price?: number;
}

export const BADGES: BadgeDef[] = [
  { id: "badge-1",  name: "وسام البرونز",        source: require("../assets/images/badges/badge-1.png"),  defaultOwned: true, levelReward: true },
  { id: "badge-2",  name: "وسام الفضة",          source: require("../assets/images/badges/badge-2.png"),  levelReward: true },
  { id: "badge-3",  name: "وسام الذهب",          source: require("../assets/images/badges/badge-3.png"),  levelReward: true },
  { id: "badge-4",  name: "وسام الفارس الفضي",   source: require("../assets/images/badges/badge-4.png"),  levelReward: true },
  { id: "badge-5",  name: "وسام الأرجوان",        source: require("../assets/images/badges/badge-5.png"),  levelReward: true },
  { id: "badge-6",  name: "وسام اللهب الذهبي",   source: require("../assets/images/badges/badge-6.png"),  levelReward: true },
  { id: "badge-7",  name: "وسام الياقوت الأزرق", source: require("../assets/images/badges/badge-7.png"),  levelReward: true },
  { id: "badge-8",  name: "وسام العنبر الوردي",   source: require("../assets/images/badges/badge-8.png"),  levelReward: true },
  { id: "badge-9",  name: "وسام التاج الملكي",    source: require("../assets/images/badges/badge-9.png"),  levelReward: true },
  { id: "badge-10", name: "الوسام الأسطوري",      source: require("../assets/images/badges/badge-10.png"), levelReward: true },
  { id: "badge-11", name: "وسام الجناح الذهبي",   source: require("../assets/images/badges/badge-11.png"), price: 1000 },
  { id: "badge-12", name: "وسام الجمشت الأرجواني", source: require("../assets/images/badges/badge-12.png"), price: 1000 },
  { id: "badge-13", name: "وسام الزمرد الملكي",    source: require("../assets/images/badges/badge-13.png"), price: 1000 },
  { id: "badge-14", name: "وسام الياقوت الناري",   source: require("../assets/images/badges/badge-14.png"), price: 1000 },
  { id: "badge-15", name: "وسام النجم الذهبي",     source: require("../assets/images/badges/badge-15.png"), price: 1000 },
  { id: "badge-16", name: "وسام الكون البنفسجي",   source: require("../assets/images/badges/badge-16.png"), price: 1000 },
];

export function getBadge(id: string | null): BadgeDef | null {
  if (!id) return null;
  return BADGES.find(b => b.id === id) ?? null;
}
