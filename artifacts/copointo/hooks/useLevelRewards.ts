import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_REWARDS, LevelReward, getRewardsUpToLevel } from "../data/levelRewards";
import { useFrames } from "./useFrames";
import { useBadges } from "./useBadges";

const ACK_KEY = "copointo_level_rewards_acked_v1";

export function useLevelRewards(level: number) {
  const { grantFrame, hydrated: framesHydrated } = useFrames();
  const { grantBadge, hydrated: badgesHydrated } = useBadges();
  const [acked, setAcked] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [queue, setQueue] = useState<LevelReward[]>([]);
  const processedRef = useRef<Set<number>>(new Set());

  // Per-instance reset: clear queue + processedRef + acked so reward
  // popups behave like a brand-new account after `resetAccount()`.
  useEffect(() => {
    const off = registerAccountResetHandler(() => {
      processedRef.current.clear();
      setAcked([]);
      setQueue([]);
    });
    return off;
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ACK_KEY)
      .then(raw => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setAcked(parsed.filter((x): x is number => typeof x === "number"));
              parsed.forEach(t => processedRef.current.add(t));
            }
          } catch {}
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || !framesHydrated || !badgesHydrated) return;
    const earned = getRewardsUpToLevel(level);
    const newOnes: LevelReward[] = [];
    for (const r of earned) {
      // Always grant the items (idempotent in the underlying hooks).
      grantFrame(r.frameId).catch(() => {});
      grantBadge(r.badgeId).catch(() => {});
      // Tier 1 is the default (level 0) — never celebrate it.
      if (r.tier === 1) {
        if (!processedRef.current.has(r.tier)) {
          processedRef.current.add(r.tier);
        }
        continue;
      }
      if (!processedRef.current.has(r.tier)) {
        processedRef.current.add(r.tier);
        if (!acked.includes(r.tier)) newOnes.push(r);
      }
    }
    if (newOnes.length > 0) {
      setQueue(prev => [...prev, ...newOnes]);
    }
  }, [level, hydrated, framesHydrated, badgesHydrated, acked, grantFrame, grantBadge]);

  const dismissCurrent = useCallback(() => {
    setQueue(prev => {
      if (prev.length === 0) return prev;
      const [head, ...rest] = prev;
      const nextAcked = Array.from(new Set([...acked, head.tier]));
      setAcked(nextAcked);
      AsyncStorage.setItem(ACK_KEY, JSON.stringify(nextAcked)).catch(() => {});
      return rest;
    });
  }, [acked]);

  return {
    current: queue[0] ?? null,
    remaining: queue.length,
    dismiss: dismissCurrent,
    allRewards: LEVEL_REWARDS,
  };
}
