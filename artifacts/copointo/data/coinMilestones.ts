export interface CoinMilestone {
  level: number;
  coins: number;
}

export const COIN_PER_MILESTONE = 25;
export const COIN_MILESTONE_STEP = 2;
export const COIN_MILESTONE_MAX  = 1000;

export const COIN_MILESTONES: CoinMilestone[] = (() => {
  const out: CoinMilestone[] = [];
  for (let lvl = COIN_MILESTONE_STEP; lvl <= COIN_MILESTONE_MAX; lvl += COIN_MILESTONE_STEP) {
    out.push({ level: lvl, coins: COIN_PER_MILESTONE });
  }
  return out;
})();

export function isCoinMilestone(level: number): boolean {
  return level > 0
    && level <= COIN_MILESTONE_MAX
    && level % COIN_MILESTONE_STEP === 0;
}

export function getMilestonesUpToLevel(level: number): CoinMilestone[] {
  return COIN_MILESTONES.filter(m => level >= m.level);
}

export function getMilestonesInRange(min: number, max: number): CoinMilestone[] {
  return COIN_MILESTONES.filter(m => m.level >= min && m.level <= max);
}

export function getNextCoinMilestone(level: number): CoinMilestone | undefined {
  return COIN_MILESTONES.find(m => m.level > level);
}
