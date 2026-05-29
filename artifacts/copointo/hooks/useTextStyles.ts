import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { syncEquipmentToServer } from "../lib/equipmentSync";
import { useCallback, useEffect, useState } from "react";

const KEY_OWNED = "copointo_text_styles_owned_v1";
const KEY_EQUIPPED = "copointo_text_style_equipped_v1";

const DEFAULT_OWNED: string[] = [];

interface State {
  owned: string[];
  equipped: string | null;
}

let _cache: State | null = null;
let _hydrationPromise: Promise<State> | null = null;
const _listeners = new Set<(s: State) => void>();

function broadcast(s: State) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

function hydrate(): Promise<State> {
  if (_cache) return Promise.resolve(_cache);
  if (_hydrationPromise) return _hydrationPromise;
  _hydrationPromise = Promise.all([
    AsyncStorage.getItem(KEY_OWNED),
    AsyncStorage.getItem(KEY_EQUIPPED),
  ]).then(([rawOwned, rawEq]) => {
    let owned: string[];
    if (rawOwned === null) {
      owned = DEFAULT_OWNED;
    } else {
      owned = [];
      try {
        const parsed = JSON.parse(rawOwned);
        if (Array.isArray(parsed)) owned = parsed;
      } catch {}
    }
    const equipped = rawEq && owned.includes(rawEq) ? rawEq : null;
    const next: State = { owned, equipped };
    broadcast(next);
    return next;
  });
  return _hydrationPromise;
}

export function useTextStyles() {
  const [state, setState] = useState<State>(
    _cache ?? { owned: DEFAULT_OWNED, equipped: null },
  );
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: State) => setState(s);
    _listeners.add(listener);
    hydrate().then(() => setHydrated(true));
    return () => { _listeners.delete(listener); };
  }, []);

  const grantTextStyle = useCallback(async (id: string) => {
    const cur = await hydrate();
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipTextStyle = useCallback(async (id: string | null) => {
    const cur = await hydrate();
    if (id !== null && !cur.owned.includes(id)) return;
    await AsyncStorage.setItem(KEY_EQUIPPED, id ?? "");
    broadcast({ ...cur, equipped: id });
    syncEquipmentToServer("textStyle", id);
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantTextStyle,
    equipTextStyle,
  };
}

/** Push-down apply: overwrite owned text styles with a server list
 *  (super-admin edit). Clears equipped if it's no longer owned. */
export async function applyTextStylesOwnedFromServer(owned: string[]) {
  const list = Array.from(new Set(owned.map(String)));
  await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(list));
  const curEq = _cache?.equipped ?? null;
  const equipped = curEq && list.includes(curEq) ? curEq : null;
  if (!equipped) await AsyncStorage.setItem(KEY_EQUIPPED, "");
  broadcast({ owned: list, equipped });
}

registerAccountResetHandler(() => {
  broadcast({ owned: DEFAULT_OWNED, equipped: null });
});
