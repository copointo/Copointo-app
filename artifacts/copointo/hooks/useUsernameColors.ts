import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { useCallback, useEffect, useState } from "react";

const KEY_OWNED = "copointo_username_colors_owned_v1";
const KEY_EQUIPPED = "copointo_username_color_equipped_v1";

const DEFAULT_OWNED: string[] = [];

interface State {
  owned: string[];
  equipped: string | null;
}

let _cache: State | null = null;
const _listeners = new Set<(s: State) => void>();

function broadcast(s: State) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

export function useUsernameColors() {
  const [state, setState] = useState<State>(
    _cache ?? { owned: DEFAULT_OWNED, equipped: null },
  );
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: State) => setState(s);
    _listeners.add(listener);

    if (_cache === null) {
      Promise.all([
        AsyncStorage.getItem(KEY_OWNED),
        AsyncStorage.getItem(KEY_EQUIPPED),
      ]).then(([rawOwned, rawEq]) => {
        let owned = DEFAULT_OWNED;
        try {
          if (rawOwned) {
            const parsed = JSON.parse(rawOwned);
            if (Array.isArray(parsed)) {
              owned = Array.from(new Set([...DEFAULT_OWNED, ...parsed]));
            }
          }
        } catch {}
        const equipped = rawEq && owned.includes(rawEq) ? rawEq : null;
        broadcast({ owned, equipped });
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    return () => { _listeners.delete(listener); };
  }, []);

  const grantUsernameColor = useCallback(async (id: string) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipUsernameColor = useCallback(async (id: string | null) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (id !== null && !cur.owned.includes(id)) return;
    await AsyncStorage.setItem(KEY_EQUIPPED, id ?? "");
    broadcast({ ...cur, equipped: id });
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantUsernameColor,
    equipUsernameColor,
  };
}

registerAccountResetHandler(() => {
  broadcast({ owned: DEFAULT_OWNED, equipped: null });
});
