import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { runAccountResetHandlers } from "./accountResetRegistry";
// Side-effect imports: ensure each hook module is loaded so its
// registerAccountResetHandler() call has run before we trigger handlers.
import "../hooks/useFrames";
import "../hooks/useBadges";
import "../hooks/useBackgrounds";
import "../hooks/useUsernameColors";
import "../hooks/useTextStyles";
import "../hooks/useCharacters";
import "../hooks/useCoins";
import "../hooks/useGiftInventory";

/**
 * Strict account reset: wipes EVERY owned/equipped/inventory slot the
 * player has accumulated, leaving the inventory completely empty. The
 * user keeps their phone, username, avatar, friends, chats and
 * communities, but has to repurchase every item from the store using
 * coins.
 *
 * We persist explicit empty values (instead of just `removeItem`) so the
 * hook hydration code on next app reload knows the slot was intentionally
 * cleared and does NOT re-seed the new-user defaults (cat, bronze frame,
 * starter gift pack, etc.).
 *
 * Server-side level / orders are reset through `POST /users/:id/reset`.
 */
export async function resetAccount(userId: string): Promise<void> {
  // ── Server reset (level + totalOrders → 0) ──────────────────────────
  try {
    await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/reset`, {
      method: "POST",
    });
  } catch {}

  // ── Persist empty values to every owned/equipped/inventory slot so
  //    next-reload hydration treats it as a deliberately wiped account
  //    rather than a brand-new install. ────────────────────────────────
  const emptyArrayKeys = [
    "copointo_frames_owned_v3",
    "copointo_badges_owned_v3",
    "copointo_backgrounds_owned_v3",
    "copointo_username_colors_owned_v1",
    "copointo_text_styles_owned_v1",
    "copointo_characters_owned_v1",
  ];
  const emptyStringKeys = [
    "copointo_frame_equipped_v3",
    "copointo_badge_equipped_v3",
    "copointo_background_equipped_v3",
    "copointo_username_color_equipped_v1",
    "copointo_text_style_equipped_v1",
    "copointo_character_equipped_v1",
  ];
  const writes: [string, string][] = [
    ...emptyArrayKeys.map(k => [k, "[]"] as [string, string]),
    ...emptyStringKeys.map(k => [k, ""] as [string, string]),
    ["copointo_gift_inventory_v1", "{}"],
    ["copointo_coins_balance_v1", "0"],
    // Mark the 90k welcome bonus as already granted so the reset doesn't
    // accidentally re-credit 90,000 coins on the next app reload.
    ["copointo_coins_grant_190k_v1", "1"],
  ];
  await AsyncStorage.multiSet(writes);
  // Drop ack history so any future re-leveling re-shows reward popups.
  await AsyncStorage.removeItem("copointo_level_rewards_acked_v1");

  // ── Reset every hook's in-memory _cache and broadcast empty defaults
  //    so the UI reflects the wipe immediately (without it, screens keep
  //    showing pre-reset items, coins and characters until full reload).
  runAccountResetHandlers();
}
