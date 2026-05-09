import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useFrames } from "@/hooks/useFrames";
import { useBadges } from "@/hooks/useBadges";
import { getRewardsUpToLevel } from "@/data/levelRewards";

/**
 * Grants every frame + badge tied to a level the user has already reached
 * — runs once at app startup (after auth) regardless of which tab the user
 * lands on. Without this, the rewards were only granted when the user
 * opened the Game tab, so newcomers who jumped straight to "أغراضي" saw
 * an empty collection even though their level had earned them prizes.
 *
 * grantFrame / grantBadge are idempotent, so re-running on every level
 * change is safe.
 */
export default function LevelRewardsGranter() {
  const { user } = useApp();
  const level = user?.level ?? 0;
  const { grantFrame, hydrated: framesHydrated } = useFrames();
  const { grantBadge, hydrated: badgesHydrated } = useBadges();

  useEffect(() => {
    if (!framesHydrated || !badgesHydrated) return;
    const earned = getRewardsUpToLevel(level);
    for (const r of earned) {
      grantFrame(r.frameId).catch(() => {});
      grantBadge(r.badgeId).catch(() => {});
    }
  }, [level, framesHydrated, badgesHydrated, grantFrame, grantBadge]);

  return null;
}
