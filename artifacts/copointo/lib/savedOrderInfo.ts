import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "copointo_saved_order_info_v1";

export interface SavedOrderInfo {
  dineName?: string;
  dineNameEn?: string;
  dinePhone?: string;
  dineTable?: string;

  carName?: string;
  carNameEn?: string;
  carPhone?: string;
  carPlateNum?: string;
  carPlateChar?: string;

  bookName?: string;
  bookPhone?: string;
}

export async function loadSavedOrderInfo(): Promise<SavedOrderInfo> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveOrderInfo(patch: Partial<SavedOrderInfo>): Promise<void> {
  try {
    const current = await loadSavedOrderInfo();
    const next: SavedOrderInfo = { ...current };
    for (const k of Object.keys(patch) as (keyof SavedOrderInfo)[]) {
      const v = patch[k];
      if (typeof v === "string" && v.trim().length > 0) {
        (next as any)[k] = v.trim();
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
  }
}

export async function clearSavedOrderInfo(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
