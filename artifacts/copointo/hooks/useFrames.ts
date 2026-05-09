import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY_OWNED = "copointo_frames_owned_v2";
const KEY_EQUIPPED = "copointo_frame_equipped_v2";

export const DEFAULT_FRAME_ID = "frame-1";

const DEFAULT_OWNED: string[] = [DEFAULT_FRAME_ID];

interface FramesState {
  owned: string[];
  equipped: string | null;
}

let _cache: FramesState | null = null;
const _listeners = new Set<(s: FramesState) => void>();

function broadcast(s: FramesState) {
  _cache = s;
  _listeners.forEach(l => l(s));
}

export function useFrames() {
  const [state, setState] = useState<FramesState>(
    _cache ?? { owned: DEFAULT_OWNED, equipped: null },
  );
  const [hydrated, setHydrated] = useState<boolean>(_cache !== null);

  useEffect(() => {
    const listener = (s: FramesState) => setState(s);
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

  const grantFrame = useCallback(async (id: string) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (cur.owned.includes(id)) return;
    const owned = [...cur.owned, id];
    await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned));
    broadcast({ ...cur, owned });
  }, []);

  const equipFrame = useCallback(async (id: string | null) => {
    const cur = _cache ?? { owned: DEFAULT_OWNED, equipped: null };
    if (id !== null && !cur.owned.includes(id)) return;
    if (id === null) {
      await AsyncStorage.removeItem(KEY_EQUIPPED);
    } else {
      await AsyncStorage.setItem(KEY_EQUIPPED, id);
    }
    broadcast({ ...cur, equipped: id });
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantFrame,
    equipFrame,
  };
}
