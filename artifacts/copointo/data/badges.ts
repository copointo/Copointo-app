export interface BadgeDef {
  id: string;
  name: string;
  source: number;
  defaultOwned?: boolean;
  /** If true, this badge is unlocked by leveling up — never appears in the item shop. */
  levelReward?: boolean;
}

export const BADGES: BadgeDef[] = [];

export function getBadge(id: string | null): BadgeDef | null {
  if (!id) return null;
  return BADGES.find(b => b.id === id) ?? null;
}
