import { RANKS } from "./mockData";

export interface LevelReward {
  tier: number;
  unlockLevel: number;
  rankName: string;
  rankColor: string;
  frameId: string;
  badgeId: string;
}

export const LEVEL_REWARDS: LevelReward[] = RANKS.map((r, i) => ({
  tier: i + 1,
  unlockLevel: r.min,
  rankName: r.name,
  rankColor: r.color,
  frameId: `frame-${i + 1}`,
  badgeId: `badge-${i + 1}`,
}));

export function getRewardsUpToLevel(level: number): LevelReward[] {
  return LEVEL_REWARDS.filter(r => level >= r.unlockLevel);
}

export function getRewardForTier(tier: number): LevelReward | undefined {
  return LEVEL_REWARDS.find(r => r.tier === tier);
}
