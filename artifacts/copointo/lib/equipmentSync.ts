import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";

export type EquipKey =
  | "frame"
  | "badge"
  | "background"
  | "character"
  | "usernameColor"
  | "textStyle";

/** Storage keys used by each per-cosmetic hook to persist the equipped id. */
const EQUIP_STORAGE_KEYS: Record<EquipKey, string> = {
  frame:         "copointo_frame_equipped_v3",
  badge:         "copointo_badge_equipped_v3",
  background:    "copointo_background_equipped_v3",
  character:     "copointo_character_equipped_v1",
  usernameColor: "copointo_username_color_equipped_v1",
  textStyle:     "copointo_text_style_equipped_v1",
};

/**
 * One-shot backfill: push EVERY locally-equipped cosmetic for the given user
 * to the server. Called once on app hydration so accounts that pre-date
 * server-side cosmetic sync show their loadout on other devices on the next
 * roster refresh, without the user having to re-equip anything.
 */
export async function backfillEquipmentToServer(userId: string): Promise<void> {
  if (!userId) return;
  const keys = Object.keys(EQUIP_STORAGE_KEYS) as EquipKey[];
  const reads = await Promise.all(
    keys.map(k => AsyncStorage.getItem(EQUIP_STORAGE_KEYS[k]).catch(() => null)),
  );
  await Promise.all(
    keys.map((k, i) => {
      const raw = reads[i];
      const value: string | null = raw && raw !== "" ? raw : null;
      return fetch(`${API_BASE}/users/equipment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, key: k, value }),
      }).catch(() => {});
    }),
  );
}

/**
 * Mirror the current user's equipped cosmetic to the server so OTHER devices
 * can render this player's loadout on profile/leaderboard/etc. Fire-and-forget
 * — never block the local equip flow on the network.
 */
export async function syncEquipmentToServer(
  key: EquipKey,
  value: string | null,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem("currentUser");
    if (!raw) return;
    const u = JSON.parse(raw);
    if (!u?.id) return;
    await fetch(`${API_BASE}/users/equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, key, value }),
    });
  } catch {
    /* network errors are non-fatal — local state is the source of truth */
  }
}
