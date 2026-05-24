import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { syncEquipmentToServer } from "../lib/equipmentSync";
import { useCallback, useEffect, useState } from "react";
import { CHARACTERS, defaultCharacterForGender } from "../data/characters";

const KEY_OWNED = "copointo_characters_owned_v1";
const KEY_EQUIPPED = "copointo_character_equipped_v1";

// Every character flagged `defaultOwned` is granted to all users automatically
// (gender-locked free starters: boy + girl).
const DEFAULT_OWNED: string[] = CHARACTERS.filter(c => c.defaultOwned).map(c => c.id);
const VALID_IDS = new Set(CHARACTERS.map(c => c.id));

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
      owned = [...DEFAULT_OWNED];
    } else {
      owned = [];
      try {
        const parsed = JSON.parse(rawOwned);
        if (Array.isArray(parsed)) owned = parsed;
      } catch {}
      // Always make sure starter characters are present
      for (const d of DEFAULT_OWNED) if (!owned.includes(d)) owned.push(d);
    }
    // Drop unknown ids (legacy characters from older versions)
    owned = owned.filter(id => VALID_IDS.has(id));

    // Equipped char must still exist; otherwise clear it (gender helper sets it)
    const equipped = rawEq && VALID_IDS.has(rawEq) && owned.includes(rawEq)
      ? rawEq
      : null;

    const next: State = { owned, equipped };
    broadcast(next);
    // Persist cleaned owned/equipped so we don't repeat the migration
    AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned)).catch(() => {});
    if (rawEq && !equipped) AsyncStorage.setItem(KEY_EQUIPPED, "").catch(() => {});
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

/**
 * Equip the gender-matching free starter character if the user currently
 * has nothing equipped. Safe to call on every mount / gender change.
 */
export async function ensureDefaultCharacterEquipped(
  gender?: "male" | "female" | null,
): Promise<void> {
  const cur = await hydrate();
  const targetId = defaultCharacterForGender(gender);
  // If nothing equipped, equip the gender starter
  if (!cur.equipped) {
    if (!cur.owned.includes(targetId)) return;
    await AsyncStorage.setItem(KEY_EQUIPPED, targetId);
    broadcast({ ...cur, equipped: targetId });
    syncEquipmentToServer("character", targetId);
    return;
  }
  // If the user currently has the WRONG-gender starter equipped (e.g. they
  // changed gender or it was set by a legacy default), swap to the right one.
  const opposite = targetId === "char-1" ? "char-2" : "char-1";
  if (cur.equipped === opposite && cur.owned.includes(targetId)) {
    await AsyncStorage.setItem(KEY_EQUIPPED, targetId);
    broadcast({ ...cur, equipped: targetId });
    syncEquipmentToServer("character", targetId);
  }
}

registerAccountResetHandler(() => {
  broadcast({ owned: [], equipped: null });
});
