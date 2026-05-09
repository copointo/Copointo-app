import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COIN_MILESTONES,
  CoinMilestone,
  getMilestonesUpToLevel,
} from "../data/coinMilestones";
import { useCoins } from "./useCoins";

const ACK_KEY = "copointo_coin_milestones_acked_v1";

export function useCoinMilestones(level: number) {
  const { addCoins, hydrated: coinsHydrated } = useCoins();
  const [acked,    setAcked]    = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [queue,    setQueue]    = useState<CoinMilestone[]>([]);
  const processedRef = useRef<Set<number>>(new Set());

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
              const nums = parsed.filter((x): x is number => typeof x === "number");
              setAcked(nums);
              nums.forEach(l => processedRef.current.add(l));
            }
          } catch {}
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated || !coinsHydrated) return;
    const earned = getMilestonesUpToLevel(level);
    const newOnes: CoinMilestone[] = [];
    for (const m of earned) {
      if (processedRef.current.has(m.level)) continue;
      processedRef.current.add(m.level);
      // Credit the wallet immediately so the user sees the new balance even
      // if they dismiss the celebration modal without interacting.
      addCoins(m.coins).catch(() => {});
      // Persist this milestone as granted right away — the modal queue is
      // only for the "🎉 you got X coins" celebration; the coins themselves
      // must never be granted twice across app restarts.
      const nextAcked = Array.from(new Set([...acked, m.level]));
      setAcked(nextAcked);
      AsyncStorage.setItem(ACK_KEY, JSON.stringify(nextAcked)).catch(() => {});
      newOnes.push(m);
    }
    if (newOnes.length > 0) {
      setQueue(prev => [...prev, ...newOnes]);
    }
  }, [level, hydrated, coinsHydrated, acked, addCoins]);

  const dismissCurrent = useCallback(() => {
    setQueue(prev => prev.length === 0 ? prev : prev.slice(1));
  }, []);

  return {
    current:   queue[0] ?? null,
    remaining: queue.length,
    dismiss:   dismissCurrent,
    allMilestones: COIN_MILESTONES,
  };
}
