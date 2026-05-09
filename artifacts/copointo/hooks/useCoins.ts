import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { useCallback, useEffect, useState } from "react";

const KEY = "copointo_coins_balance_v1";
const GRANT_KEY = "copointo_coins_grant_signup_200_v1";
const SIGNUP_GRANT = 200;

let _cache: number | null = null;
const _listeners = new Set<(n: number) => void>();

function broadcast(n: number) {
  _cache = n;
  _listeners.forEach(l => l(n));
}

export function useCoins() {
  const [balance, setBalance] = useState<number>(_cache ?? 0);
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (n: number) => setBalance(n);
    _listeners.add(listener);
    if (_cache === null) {
      Promise.all([
        AsyncStorage.getItem(KEY),
        AsyncStorage.getItem(GRANT_KEY),
      ]).then(async ([v, granted]) => {
        let n = v ? parseInt(v, 10) || 0 : 0;
        if (!granted) {
          n += SIGNUP_GRANT;
          await AsyncStorage.setItem(KEY, String(n));
          await AsyncStorage.setItem(GRANT_KEY, "1");
        }
        broadcast(n);
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    return () => { _listeners.delete(listener); };
  }, []);

  const addCoins = useCallback(async (delta: number) => {
    const next = Math.max(0, (_cache ?? 0) + delta);
    await AsyncStorage.setItem(KEY, String(next));
    broadcast(next);
    return next;
  }, []);

  /** Force the balance to an exact value (used by account reset). */
  const setCoins = useCallback(async (next: number) => {
    const v = Math.max(0, Math.floor(next));
    await AsyncStorage.setItem(KEY, String(v));
    broadcast(v);
    return v;
  }, []);

  return { balance, hydrated, addCoins, setCoins };
}

registerAccountResetHandler(() => {
  broadcast(0);
});
