import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { applyCoinsFromServer } from "../hooks/useCoins";
import { applyFramesOwnedFromServer } from "../hooks/useFrames";
import { applyBadgesOwnedFromServer } from "../hooks/useBadges";
import { applyBackgroundsOwnedFromServer } from "../hooks/useBackgrounds";
import { applyCharactersOwnedFromServer } from "../hooks/useCharacters";
import { applyUsernameColorsOwnedFromServer } from "../hooks/useUsernameColors";
import { applyTextStylesOwnedFromServer } from "../hooks/useTextStyles";

/**
 * Inventory sync between the mobile device and the server so the super-admin
 * can SEE every user's coins + owned cosmetics (push-up) and so admin EDITS
 * flow back down to the device (push-down).
 *
 * Direction control is via `syncVersion`:
 *   • push-up (`pushInventoryToServer`) writes a plain snapshot and does NOT
 *     bump syncVersion — so the device's own mirror can never look "newer".
 *   • admin edits bump syncVersion server-side. The device applies a
 *     push-down only when the server's syncVersion is strictly greater than
 *     the version it last applied (persisted in `APPLIED_VERSION_KEY`).
 */

const COINS_KEY = "copointo_coins_balance_v1";
const APPLIED_VERSION_KEY = "copointo_sync_version_applied_v1";

const OWNED_KEYS = {
  frames:         "copointo_frames_owned_v3",
  badges:         "copointo_badges_owned_v3",
  backgrounds:    "copointo_backgrounds_owned_v3",
  characters:     "copointo_characters_owned_v1",
  usernameColors: "copointo_username_colors_owned_v1",
  textStyles:     "copointo_text_styles_owned_v1",
} as const;

export type OwnedItems = Record<keyof typeof OWNED_KEYS, string[]>;

const DEFAULT_OWNED: OwnedItems = {
  frames: ["frame-1"], badges: [], backgrounds: [],
  characters: [], usernameColors: [], textStyles: [],
};

function parseList(raw: string | null, fallback: string[]): string[] {
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [];
}

/** Read the current device coin balance + owned-item lists straight from
 *  AsyncStorage (no hook subscription needed). */
export async function readLocalInventory(): Promise<{ coins: number; ownedItems: OwnedItems }> {
  const keys = [COINS_KEY, ...Object.values(OWNED_KEYS)];
  const pairs = await AsyncStorage.multiGet(keys);
  const map = new Map(pairs);
  const coins = parseInt(map.get(COINS_KEY) ?? "", 10) || 0;
  const ownedItems = {} as OwnedItems;
  (Object.keys(OWNED_KEYS) as (keyof typeof OWNED_KEYS)[]).forEach(cat => {
    ownedItems[cat] = parseList(map.get(OWNED_KEYS[cat]) ?? null, DEFAULT_OWNED[cat]);
  });
  return { coins, ownedItems };
}

/** Push-up: mirror the device's coins + owned items to the server so the
 *  super-admin dashboard can display them. Non-fatal on network errors.
 *
 *  We send `clientSyncVersion` (the last admin edit this device applied) so
 *  the server can REJECT a stale push: if an admin edited the account after
 *  this device last reconciled, the server's syncVersion is newer than what
 *  we send and the write is ignored — preventing the device from clobbering
 *  a fresh admin edit it hasn't pulled down yet. */
export async function pushInventoryToServer(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const { coins, ownedItems } = await readLocalInventory();
    const appliedRaw = await AsyncStorage.getItem(APPLIED_VERSION_KEY);
    const clientSyncVersion = appliedRaw ? parseInt(appliedRaw, 10) || 0 : 0;
    await fetch(`${API_BASE}/users/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, coins, ownedItems, clientSyncVersion }),
    });
  } catch { /* network errors are non-fatal */ }
}

/** Push-down: apply a super-admin edit to the device when the server's
 *  syncVersion is newer than the last one we applied. Returns true if an
 *  apply happened. */
export async function reconcileInventory(args: {
  coins: number | null;
  ownedItems: Partial<OwnedItems> | null;
  syncVersion: number | null;
}): Promise<boolean> {
  const { coins, ownedItems, syncVersion } = args;
  if (typeof syncVersion !== "number") return false;
  const appliedRaw = await AsyncStorage.getItem(APPLIED_VERSION_KEY);
  const applied = appliedRaw ? parseInt(appliedRaw, 10) || 0 : 0;
  if (syncVersion <= applied) return false;

  if (typeof coins === "number") {
    await applyCoinsFromServer(coins);
  }
  if (ownedItems && typeof ownedItems === "object") {
    const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
    await applyFramesOwnedFromServer(arr(ownedItems.frames));
    await applyBadgesOwnedFromServer(arr(ownedItems.badges));
    await applyBackgroundsOwnedFromServer(arr(ownedItems.backgrounds));
    await applyCharactersOwnedFromServer(arr(ownedItems.characters));
    await applyUsernameColorsOwnedFromServer(arr(ownedItems.usernameColors));
    await applyTextStylesOwnedFromServer(arr(ownedItems.textStyles));
  }
  await AsyncStorage.setItem(APPLIED_VERSION_KEY, String(syncVersion));
  return true;
}
