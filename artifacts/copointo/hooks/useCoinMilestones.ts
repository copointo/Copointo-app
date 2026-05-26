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
  // First-pass guard: on the very first effect run after hydration we
  // silently ack every milestone the user has already passed (no popup,
  // no coin re-credit). Only milestones crossed AFTER that — i.e. real
  // live level-ups within the session — fire the celebration and grant
  // coins. This prevents the showcase account (which jumps to level 240
  // on login) from triggering a flood of "+25 coin" popups for prizes
  // it already has.
  const firstPassDoneRef = useRef(false);

  useEffect(() => {
    const off = registerAccountResetHandler(() => {
      processedRef.current.clear();
      firstPassDoneRef.current = false;
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
    const isFirstPass = !firstPassDoneRef.current;
    const newOnes: CoinMilestone[] = [];
    const silentAcks: number[] = [];
    for (const m of earned) {
      if (processedRef.current.has(m.level)) continue;
      processedRef.current.add(m.level);
      if (isFirstPass) {
        // Account-restoration pass — silently ack without granting coins
        // or queuing a popup. The user either already received this
        // milestone in a previous session (in which case AsyncStorage
        // would normally hold the ack), or this is a pre-seeded
        // showcase account whose wallet is already topped up.
        if (!acked.includes(m.level)) silentAcks.push(m.level);
        continue;
      }
      // Live level-up — credit the wallet and queue the celebration.
      addCoins(m.coins).catch(() => {});
      const nextAcked = Array.from(new Set([...acked, m.level]));
      setAcked(nextAcked);
      AsyncStorage.setItem(ACK_KEY, JSON.stringify(nextAcked)).catch(() => {});
      newOnes.push(m);
    }
    firstPassDoneRef.current = true;
    if (silentAcks.length > 0) {
      const nextAcked = Array.from(new Set([...acked, ...silentAcks]));
      setAcked(nextAcked);
      AsyncStorage.setItem(ACK_KEY, JSON.stringify(nextAcked)).catch(() => {});
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
