export interface FrameDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
}

export const FRAMES: FrameDef[] = [
  { id: "frame-1",  name: "إطار البرونز",       source: require("../assets/images/frames/frame-1.png"), defaultOwned: true },
  { id: "frame-2",  name: "إطار الفضة",         source: require("../assets/images/frames/frame-2.png") },
  { id: "frame-3",  name: "إطار الذهب",         source: require("../assets/images/frames/frame-3.png") },
  { id: "frame-4",  name: "إطار الفارس الفضي",  source: require("../assets/images/frames/frame-4.png") },
  { id: "frame-5",  name: "إطار الأرجوان",       source: require("../assets/images/frames/frame-5.png") },
  { id: "frame-6",  name: "إطار اللهب الذهبي",  source: require("../assets/images/frames/frame-6.png") },
  { id: "frame-7",  name: "إطار الياقوت الأزرق", source: require("../assets/images/frames/frame-7.png") },
  { id: "frame-8",  name: "إطار العنبر الوردي",  source: require("../assets/images/frames/frame-8.png") },
  { id: "frame-9",  name: "إطار التاج الملكي",   source: require("../assets/images/frames/frame-9.png") },
  { id: "frame-10", name: "الإطار الأسطوري",     source: require("../assets/images/frames/frame-10.png") },
];

export function getFrame(id: string | null): FrameDef | null {
  if (!id) return null;
  return FRAMES.find(f => f.id === id) ?? null;
}
