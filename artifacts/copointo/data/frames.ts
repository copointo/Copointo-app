export interface FrameDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
}

export const FRAMES: FrameDef[] = [
  { id: "frame-1", name: "إطار البرونز",  source: require("../assets/images/badges/badge-1.png"), defaultOwned: true },
  { id: "frame-2", name: "إطار الفضة",    source: require("../assets/images/badges/badge-2.png") },
  { id: "frame-3", name: "إطار الذهب",    source: require("../assets/images/badges/badge-3.png") },
  { id: "frame-4", name: "إطار البلاتين", source: require("../assets/images/badges/badge-4.png") },
  { id: "frame-5", name: "إطار العنبر",   source: require("../assets/images/badges/badge-5.png") },
  { id: "frame-6", name: "إطار اللهب",    source: require("../assets/images/badges/badge-6.png") },
  { id: "frame-7", name: "إطار الياقوت",  source: require("../assets/images/badges/badge-7.png") },
  { id: "frame-8", name: "إطار الملوك",   source: require("../assets/images/badges/badge-8.png") },
  { id: "frame-9", name: "إطار التاج",    source: require("../assets/images/badges/badge-9.png") },
  { id: "frame-10", name: "الإطار الأسطوري", source: require("../assets/images/badges/badge-10.png") },
];

export function getFrame(id: string | null): FrameDef | null {
  if (!id) return null;
  return FRAMES.find(f => f.id === id) ?? null;
}
