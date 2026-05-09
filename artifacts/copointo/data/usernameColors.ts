export interface UsernameColorDef {
  id: string;
  name: string;
  color?: string;
  gradient?: readonly [string, string, ...string[]];
  shine?: boolean;
  defaultOwned?: boolean;
}

export const USERNAME_COLORS: UsernameColorDef[] = [
  { id: "uc-1",  name: "أبيض",          color: "#FFFFFF" },
  { id: "uc-2",  name: "أمبر",          color: "#E8B86D" },
  { id: "uc-3",  name: "أحمر",          color: "#EF4444" },
  { id: "uc-4",  name: "أخضر",          color: "#22C55E" },
  { id: "uc-5",  name: "أزرق",          color: "#3B82F6" },
  { id: "uc-6",  name: "بنفسجي",        color: "#8B5CF6" },
  { id: "uc-7",  name: "وردي",          color: "#EC4899" },
  { id: "uc-8",  name: "تركواز",        color: "#06B6D4" },
  { id: "uc-9",  name: "ليموني",        color: "#EAB308" },
  { id: "uc-10", name: "برتقالي",       color: "#F97316" },

  { id: "uc-11", name: "ذهبي لامع",     color: "#FFD700", shine: true },
  { id: "uc-12", name: "أمبر لامع",     color: "#E8B86D", shine: true },
  { id: "uc-13", name: "ياقوت لامع",    color: "#FF1744", shine: true },
  { id: "uc-14", name: "زمرد لامع",     color: "#00E676", shine: true },
  { id: "uc-15", name: "ياقوت أزرق",    color: "#2979FF", shine: true },

  { id: "uc-16", name: "غروب لامع",     gradient: ["#FF6B6B", "#FFD93D"], shine: true },
  { id: "uc-17", name: "محيط لامع",     gradient: ["#06B6D4", "#3B82F6", "#8B5CF6"], shine: true },
  { id: "uc-18", name: "غابة لامعة",    gradient: ["#22C55E", "#EAB308"], shine: true },
  { id: "uc-19", name: "قوس قزح",       gradient: ["#FF6B6B", "#FFD93D", "#22C55E", "#3B82F6", "#8B5CF6"], shine: true },
  { id: "uc-20", name: "ذهب ملكي",      gradient: ["#FFD700", "#FFA500", "#FFD700"], shine: true },
];

export function getUsernameColor(id: string | null): UsernameColorDef | null {
  if (!id) return null;
  return USERNAME_COLORS.find(u => u.id === id) ?? null;
}

export const USERNAME_COLOR_PRICE = (idx: number): number => {
  if (idx < 10) return 200;
  if (idx < 15) return 800;
  return 2000;
};
