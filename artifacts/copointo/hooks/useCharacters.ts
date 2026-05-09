import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY_OWNED = "copointo_characters_owned_v1";
const KEY_EQUIPPED = "copointo_character_equipped_v1";

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
    const next: State = { owned, equipped };
    broadcast(next);
    return next;
  });
  return _hydrationPromise;
}

export function useCharacters() {
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

  const grantCharacter = useCallback(async (id: string) => {
    const cur = await hydrate();
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipCharacter = useCallback(async (id: string | null) => {
    const cur = await hydrate();
    if (id !== null && !cur.owned.includes(id)) return;
    await AsyncStorage.setItem(KEY_EQUIPPED, id ?? "");
    broadcast({ ...cur, equipped: id });
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantCharacter,
    equipCharacter,
  };
}
