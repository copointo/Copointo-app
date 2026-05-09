export interface FrameDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
  /** If true, this frame is unlocked by leveling up — never appears in the item shop. */
  levelReward?: boolean;
  /** Optional fixed price (overrides PRICE_BY_TIER in the shop). */
  price?: number;
}

export const FRAMES: FrameDef[] = [
  { id: "frame-1",  name: "إطار البرونز",       source: require("../assets/images/frames/frame-1.png"), defaultOwned: true, levelReward: true },
  { id: "frame-2",  name: "إطار الفضة",         source: require("../assets/images/frames/frame-2.png"), levelReward: true },
  { id: "frame-3",  name: "إطار الذهب",         source: require("../assets/images/frames/frame-3.png"), levelReward: true },
  { id: "frame-4",  name: "إطار الفارس الفضي",  source: require("../assets/images/frames/frame-4.png"), levelReward: true },
  { id: "frame-5",  name: "إطار الأرجوان",       source: require("../assets/images/frames/frame-5.png"), levelReward: true },
  { id: "frame-6",  name: "إطار اللهب الذهبي",  source: require("../assets/images/frames/frame-6.png"), levelReward: true },
  { id: "frame-7",  name: "إطار الياقوت الأزرق", source: require("../assets/images/frames/frame-7.png"), levelReward: true },
  { id: "frame-8",  name: "إطار العنبر الوردي",  source: require("../assets/images/frames/frame-8.png"), levelReward: true },
  { id: "frame-9",  name: "إطار التاج الملكي",   source: require("../assets/images/frames/frame-9.png"), levelReward: true },
  { id: "frame-10", name: "الإطار الأسطوري",     source: require("../assets/images/frames/frame-10.png"), levelReward: true },
  { id: "frame-11", name: "إطار الجمر الأسود",   source: require("../assets/images/frames/frame-11.png"), price: 5000 },
  { id: "frame-12", name: "إطار الجليد الأزرق",  source: require("../assets/images/frames/frame-12.png"), price: 5000 },
  { id: "frame-13", name: "إطار الجوهرة البنفسجية", source: require("../assets/images/frames/frame-13.png"), price: 5000 },
  { id: "frame-14", name: "إطار الزمرد الأخضر",   source: require("../assets/images/frames/frame-14.png"), price: 5000 },
  { id: "frame-15", name: "إطار الذهب الملكي",    source: require("../assets/images/frames/frame-15.png"), price: 5000 },
  { id: "frame-16", name: "إطار اللهب البرتقالي", source: require("../assets/images/frames/frame-16.png"), price: 5000 },
];

export function getFrame(id: string | null): FrameDef | null {
  if (!id) return null;
  return FRAMES.find(f => f.id === id) ?? null;
}
