import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { useCallback, useEffect, useState } from "react";
import { GIFTS } from "../data/gifts";

const KEY = "copointo_gift_inventory_v1";

// Starter pack: every brand-new user (no inventory key yet) gets 5 of each
// CHEAP gift only (price ≤ 50). Premium/cinematic gifts (500/750 coins)
// must be purchased — the freebie is meant to let newcomers try sending
// the basic gifts to friends, not to hand out expensive ones for free.
const STARTER_QTY_PER_GIFT = 5;
const STARTER_PRICE_CAP = 50;
const STARTER_INVENTORY: Record<string, number> = Object.fromEntries(
  GIFTS.filter(g => g.price <= STARTER_PRICE_CAP).map(g => [g.id, STARTER_QTY_PER_GIFT]),
);

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
        // First-run users (no key yet) get the starter pack persisted
        // immediately so it survives reloads.
        if (raw === null) {
          inv = { ...STARTER_INVENTORY };
          persist(inv);
        } else {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
              for (const [k, v] of Object.entries(parsed)) {
                if (typeof v === "number" && v > 0) inv[k] = v;
              }
            }
          } catch {}
        }
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

registerAccountResetHandler(() => {
  broadcast({});
});
