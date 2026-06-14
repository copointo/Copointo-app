import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const KEY = "@copointo:favoriteCafes";

/**
 * Per-device favourite cafés, persisted in AsyncStorage. Returns the list of
 * favourited cafe IDs plus helpers to check / toggle membership. The heart on
 * the home-screen cafe cards is wired to this.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setFavorites(JSON.parse(raw));
      } catch { /* ignore — start with an empty set */ }
    })();
  }, []);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, toggle, isFavorite };
}
