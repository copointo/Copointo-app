import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { BACKGROUNDS, DEFAULT_BACKGROUND_ID } from "../data/backgrounds";

const KEY_OWNED = "copointo_backgrounds_owned_v1";
const KEY_EQUIPPED = "copointo_background_equipped_v1";

// All backgrounds are free for now — every user owns the entire collection.
const DEFAULT_OWNED: string[] = BACKGROUNDS.map(b => b.id);

interface BackgroundsState {
  owned: string[];
  equipped: string | null;
}

let _cache: BackgroundsState | null = null;
const _listeners = new Set<(s: BackgroundsState) => void>();

function broadcast(s: BackgroundsState) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

export function useBackgrounds() {
  const [state, setState] = useState<BackgroundsState>(
    _cache ?? { owned: DEFAULT_OWNED, equipped: DEFAULT_BACKGROUND_ID },
  );
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: BackgroundsState) => setState(s);
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
        const equipped =
          rawEq === null
            ? DEFAULT_BACKGROUND_ID
            : rawEq && owned.includes(rawEq)
              ? rawEq
              : null;
        broadcast({ owned, equipped });
        setHydrated(true);
      });
    } else {
      setHydrated(true);
    }
    return () => { _listeners.delete(listener); };
  }, []);

  const grantBackground = useCallback(async (id: string) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipBackground = useCallback(async (id: string | null) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (id !== null && !cur.owned.includes(id)) return;
    if (id === null) {
      await AsyncStorage.setItem(KEY_EQUIPPED, "");
    } else {
      await AsyncStorage.setItem(KEY_EQUIPPED, id);
    }
    broadcast({ ...cur, equipped: id });
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantBackground,
    equipBackground,
  };
}
