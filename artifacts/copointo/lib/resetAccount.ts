import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/constants/api";
import { GIFTS } from "@/data/gifts";
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
 * Wipes every owned/equipped/inventory storage slot the player has
 * accumulated, then re-seeds the free starter pack (the cat character +
 * 5 of every gift) so the account behaves like a brand-new signup. Coins
 * are zeroed via the caller's `setCoins(0)`. Server-side level / orders
 * are reset through `POST /users/:id/reset`.
 *
 * Friend lists, chats, communities, language preference and the user's
 * own profile (phone, username, avatar) are intentionally NOT touched.
 */
export async function resetAccount(userId: string): Promise<void> {
  // ── Server reset (level + totalOrders → 0) ──────────────────────────
  try {
    await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/reset`, {
      method: "POST",
    });
  } catch {}

  // ── Wipe local owned/equipped + inventory slots ─────────────────────
  const keysToClear = [
    "copointo_frames_owned_v3",
    "copointo_frame_equipped_v3",
    "copointo_badges_owned_v3",
    "copointo_badge_equipped_v3",
    "copointo_backgrounds_owned_v3",
    "copointo_background_equipped_v3",
    "copointo_username_colors_owned_v1",
    "copointo_username_color_equipped_v1",
    "copointo_text_styles_owned_v1",
    "copointo_text_style_equipped_v1",
    "copointo_characters_owned_v1",
    "copointo_character_equipped_v1",
    "copointo_gift_inventory_v1",
    "copointo_level_rewards_acked_v1",
    "copointo_coins_balance_v1",
  ];
  await AsyncStorage.multiRemove(keysToClear);
  // Mark the 90k welcome bonus as already granted so the reset doesn't
  // accidentally re-credit 90,000 coins on the next app reload (when the
  // hook's _cache is null and the hydration effect runs again).
  await AsyncStorage.setItem("copointo_coins_grant_190k_v1", "1");

  // ── Re-seed the free starter gift pack so the user still has 5 of
  //    every gift after the reset (matches new-user behaviour). ────────
  const starter: Record<string, number> = {};
  for (const g of GIFTS) starter[g.id] = 5;
  await AsyncStorage.setItem(
    "copointo_gift_inventory_v1",
    JSON.stringify(starter),
  );

  // ── Reset every hook's in-memory _cache and broadcast defaults so the
  //    UI reflects the wipe immediately (without it, screens keep showing
  //    pre-reset items, coins and characters until full app reload). ────
  runAccountResetHandlers();
}
