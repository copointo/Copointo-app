import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerAccountResetHandler } from "../lib/accountResetRegistry";
import { syncEquipmentToServer } from "../lib/equipmentSync";
import { useCallback, useEffect, useState } from "react";
import { CHARACTERS, defaultCharacterForGender } from "../data/characters";

const KEY_OWNED = "copointo_characters_owned_v1";
const KEY_EQUIPPED = "copointo_character_equipped_v1";
const KEY_MIGRATION_V2_DONE = "copointo_characters_migration_v2_done";
const KEY_MIGRATION_REFUND = "copointo_characters_migration_refund_pending_v1";

// Every character flagged `defaultOwned` is granted to all users automatically
// (gender-locked free starters: boy + girl).
const DEFAULT_OWNED: string[] = CHARACTERS.filter(c => c.defaultOwned).map(c => c.id);
const VALID_IDS = new Set(CHARACTERS.map(c => c.id));

/**
 * Prices users paid for characters BEFORE the May-2026 character roster
 * replacement. Used to refund coins for any character they purchased that
 * no longer exists. char-1 (the old "cup" starter) was a free defaultOwned
 * item so it is intentionally excluded — only paid purchases get refunded.
 */
const LEGACY_CHARACTER_PRICES: Record<string, number> = {
  "char-2": 800, "char-3": 800, "char-4": 800, "char-5": 800, "char-6": 800,
  "char-7": 800, "char-8": 800, "char-9": 800, "char-10": 800,
  "char-11": 1200, "char-12": 1200,
  "char-13": 2000, "char-14": 2000, "char-15": 2000, "char-16": 2000,
  "char-17": 5000, "char-18": 5000,
  "char-19": 10000, "char-20": 10000,
  "char-21": 2000,
};

export interface PendingCharacterRefund {
  amount: number;
  count: number;
}

export async function readPendingCharacterRefund(): Promise<PendingCharacterRefund | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_MIGRATION_REFUND);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.amount === "number" && typeof parsed?.count === "number" && parsed.count > 0) {
      return { amount: parsed.amount, count: parsed.count };
    }
  } catch {}
  return null;
}

export async function clearPendingCharacterRefund(): Promise<void> {
  await AsyncStorage.removeItem(KEY_MIGRATION_REFUND);
}

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
    AsyncStorage.getItem(KEY_MIGRATION_V2_DONE),
  ]).then(async ([rawOwned, rawEq, migrationDone]) => {
    // ── One-time migration: legacy character roster → new roster ──────
    // If the user persisted ownership before the May-2026 roster swap,
    // refund coins for every PAID old character they owned, then reset
    // ownership to the new gender-locked starters. The refund is staged
    // in AsyncStorage so a top-level component can credit coins + show
    // a notice the next time the app mounts.
    if (!migrationDone && rawOwned !== null) {
      let legacyOwned: string[] = [];
      try {
        const parsed = JSON.parse(rawOwned);
        if (Array.isArray(parsed)) legacyOwned = parsed;
      } catch {}
      let refundAmount = 0;
      let refundCount = 0;
      for (const id of legacyOwned) {
        const price = LEGACY_CHARACTER_PRICES[id];
        if (typeof price === "number" && price > 0) {
          refundAmount += price;
          refundCount += 1;
        }
      }
      if (refundCount > 0) {
        try {
          await AsyncStorage.setItem(
            KEY_MIGRATION_REFUND,
            JSON.stringify({ amount: refundAmount, count: refundCount }),
          );
        } catch {}
      }
      // Reset ownership to the new starter pack and clear any equipped
      // legacy character.
      await AsyncStorage.setItem(KEY_OWNED, JSON.stringify(DEFAULT_OWNED));
      await AsyncStorage.setItem(KEY_EQUIPPED, "");
      await AsyncStorage.setItem(KEY_MIGRATION_V2_DONE, "1");
      const next: State = { owned: [...DEFAULT_OWNED], equipped: null };
      broadcast(next);
      return next;
    }

    let owned: string[];
    if (rawOwned === null) {
      owned = [...DEFAULT_OWNED];
    } else {
      owned = [];
      try {
        const parsed = JSON.parse(rawOwned);
        if (Array.isArray(parsed)) owned = parsed;
      } catch {}
      for (const d of DEFAULT_OWNED) if (!owned.includes(d)) owned.push(d);
    }
    owned = owned.filter(id => VALID_IDS.has(id));

    const equipped = rawEq && VALID_IDS.has(rawEq) && owned.includes(rawEq)
      ? rawEq
      : null;

    const next: State = { owned, equipped };
    broadcast(next);
    AsyncStorage.setItem(KEY_OWNED, JSON.stringify(owned)).catch(() => {});
    if (rawEq && !equipped) AsyncStorage.setItem(KEY_EQUIPPED, "").catch(() => {});
    // Brand-new users (rawOwned === null) also count as already-migrated.
    if (!migrationDone) {
      AsyncStorage.setItem(KEY_MIGRATION_V2_DONE, "1").catch(() => {});
    }
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
