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

/**
 * ⚠️ TEMP DEV-ONLY: idempotent grant used by AppContext when a demo /
 * skip-login user signs in. Bumps the balance to at least `floor` coins
 * exactly once per device install (guarded by `markerKey` in AsyncStorage).
 * Safe to call from any module — also broadcasts so live `useCoins()`
 * consumers re-render. Remove together with the skip-login button.
 */
export async function grantDevDemoCoinsOnce(floor: number, markerKey: string) {
  const already = await AsyncStorage.getItem(markerKey);
  if (already) return;
  const raw = await AsyncStorage.getItem(KEY);
  const current = raw ? parseInt(raw, 10) || 0 : 0;
  const next = Math.max(current, Math.floor(floor));
  await AsyncStorage.setItem(KEY, String(next));
  await AsyncStorage.setItem(markerKey, "1");
  broadcast(next);
}

/**
 * Idempotent ADDITIVE bonus: adds `delta` to the current balance exactly
 * once per `markerKey`. Unlike `grantDevDemoCoinsOnce` (which floors), this
 * stacks on top of whatever the user already has and broadcasts so live
 * `useCoins()` consumers re-render immediately.
 */
export async function grantBonusCoinsOnce(delta: number, markerKey: string) {
  const already = await AsyncStorage.getItem(markerKey);
  if (already) return;
  const raw = await AsyncStorage.getItem(KEY);
  const current = raw ? parseInt(raw, 10) || 0 : 0;
  const next = Math.max(0, current + Math.floor(delta));
  await AsyncStorage.setItem(KEY, String(next));
  await AsyncStorage.setItem(markerKey, "1");
  broadcast(next);
}

/**
 * Push-down apply: overwrite the local balance with a server-authoritative
 * value (used by the inventory sync when a super-admin edited the user).
 * Writes AsyncStorage + broadcasts so live `useCoins()` consumers re-render.
 * Also stamps the signup-grant marker so the next hydrate doesn't re-add the
 * 200-coin bonus on top of the admin-set value.
 */
export async function applyCoinsFromServer(n: number) {
  const v = Math.max(0, Math.floor(n));
  await AsyncStorage.setItem(KEY, String(v));
  await AsyncStorage.setItem(GRANT_KEY, "1");
  broadcast(v);
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
