import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "copointo_gift_inventory_v1";

export type GiftInventory = Record<string, number>;

let _cache: GiftInventory | null = null;
const _listeners = new Set<(s: GiftInventory) => void>();

function broadcast(s: GiftInventory) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

async function persist(s: GiftInventory) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

export function useGiftInventory() {
  const [state, setState] = useState<GiftInventory>(_cache ?? {});
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: GiftInventory) => setState(s);
    _listeners.add(listener);

    if (_cache === null) {
      AsyncStorage.getItem(KEY).then(raw => {
        let inv: GiftInventory = {};
        try {
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "number" && v > 0) inv[k] = v;
              }
            }
          }
        } catch {}
        broadcast(inv);
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    return () => { _listeners.delete(listener); };
  }, []);

  const addGift = useCallback(async (id: string, qty: number = 1) => {
    if (qty <= 0) return;
    const cur = _cache ?? {};
    const next: GiftInventory = { ...cur, [id]: (cur[id] ?? 0) + qty };
    await persist(next);
    broadcast(next);
  }, []);

  const consumeGift = useCallback(async (id: string, qty: number = 1): Promise<boolean> => {
    const cur = _cache ?? {};
    const have = cur[id] ?? 0;
    if (have < qty) return false;
    const remaining = have - qty;
    const next: GiftInventory = { ...cur };
    if (remaining <= 0) delete next[id]; else next[id] = remaining;
    await persist(next);
    broadcast(next);
    return true;
  }, []);

  const countOf = useCallback((id: string) => state[id] ?? 0, [state]);

  return { inventory: state, hydrated, addGift, consumeGift, countOf };
}
