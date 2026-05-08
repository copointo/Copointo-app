export interface BadgeDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
}

export const BADGES: BadgeDef[] = [
  { id: "badge-1",  name: "شارة البرونز",   source: require("../assets/images/badges/badge-1.png"), defaultOwned: true },
  { id: "badge-2",  name: "شارة الفضة",     source: require("../assets/images/badges/badge-2.png") },
  { id: "badge-3",  name: "شارة الذهب",     source: require("../assets/images/badges/badge-3.png") },
  { id: "badge-4",  name: "شارة البلاتين",  source: require("../assets/images/badges/badge-4.png") },
  { id: "badge-5",  name: "شارة العنبر",    source: require("../assets/images/badges/badge-5.png") },
  { id: "badge-6",  name: "شارة اللهب",     source: require("../assets/images/badges/badge-6.png") },
  { id: "badge-7",  name: "شارة الياقوت",   source: require("../assets/images/badges/badge-7.png") },
  { id: "badge-8",  name: "شارة الملوك",    source: require("../assets/images/badges/badge-8.png") },
  { id: "badge-9",  name: "شارة التاج",     source: require("../assets/images/badges/badge-9.png") },
  { id: "badge-10", name: "الشارة الأسطورية", source: require("../assets/images/badges/badge-10.png") },
];

export function getBadge(id: string | null): BadgeDef | null {
  if (!id) return null;
  return BADGES.find(b => b.id === id) ?? null;
}
