import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "copointo_coins_balance_v1";

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
      AsyncStorage.getItem(KEY).then(v => {
        const n = v ? parseInt(v, 10) || 0 : 0;
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

  return { balance, hydrated, addCoins };
}
