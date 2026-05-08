import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY_OWNED = "copointo_badges_owned_v1";
const KEY_EQUIPPED = "copointo_badge_equipped_v1";

export const DEFAULT_BADGE_ID = "badge-1";
const DEFAULT_OWNED: string[] = [DEFAULT_BADGE_ID];

interface BadgesState {
  owned: string[];
  equipped: string | null;
}

let _cache: BadgesState | null = null;
const _listeners = new Set<(s: BadgesState) => void>();

function broadcast(s: BadgesState) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

export function useBadges() {
  const [state, setState] = useState<BadgesState>(
    _cache ?? { owned: DEFAULT_OWNED, equipped: DEFAULT_BADGE_ID },
  );
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: BadgesState) => setState(s);
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
        // Default-equip the bronze badge for first-time users so it shows up
        // immediately in the leaderboard / profile.
        const equipped =
          rawEq === null
            ? DEFAULT_BADGE_ID
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

  const grantBadge = useCallback(async (id: string) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipBadge = useCallback(async (id: string | null) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (id !== null && !cur.owned.includes(id)) return;
    if (id === null) {
      // Persist an empty string to differentiate "user removed" from "first run"
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
    grantBadge,
    equipBadge,
  };
}
