import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { syncEquipmentToServer } from "../lib/equipmentSync";
import { useCallback, useEffect, useState } from "react";
import { CHARACTERS } from "../data/characters";

const KEY_OWNED = "copointo_characters_owned_v1";
const KEY_EQUIPPED = "copointo_character_equipped_v1";

// Every character flagged `defaultOwned` is granted to all users automatically
// (free starter pack). Currently this is just the cat (char-1).
const DEFAULT_OWNED: string[] = CHARACTERS.filter(c => c.defaultOwned).map(c => c.id);
const DEFAULT_EQUIPPED: string | null = DEFAULT_OWNED[0] ?? null;

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
    // First-run users (rawOwned === null) get the starter defaults.
    // Anyone with a persisted value (even "[]" after an account reset)
    // gets EXACTLY what was persisted, with no defaults merged in.
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
    // Only first-run users (rawEq === null AND rawOwned === null) auto-equip
    // the default starter. Reset writes "" so nothing stays equipped.
    const equipped =
      rawEq === null && rawOwned === null
        ? (DEFAULT_EQUIPPED && owned.includes(DEFAULT_EQUIPPED) ? DEFAULT_EQUIPPED : null)
        : rawEq && owned.includes(rawEq)
          ? rawEq
          : null;
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
    syncEquipmentToServer("character", id);
  }, []);

  return {
    owned: state.owned,
    equipped: state.equipped,
    hydrated,
    grantCharacter,
    equipCharacter,
  };
}

registerAccountResetHandler(() => {
  broadcast({ owned: [], equipped: null });
});
