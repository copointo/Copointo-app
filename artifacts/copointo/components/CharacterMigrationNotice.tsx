import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useCoins } from "@/hooks/useCoins";
import { useApp } from "@/context/AppContext";
import {
  readPendingCharacterRefund,
  clearPendingCharacterRefund,
  ensureDefaultCharacterEquipped,
  type PendingCharacterRefund,
} from "@/hooks/useCharacters";

const COIN = require("../assets/images/copointo-coin.png");
const PRIMARY = "#E8B86D";

/**
 * One-time notice shown to users whose old character roster was wiped by
 * the May-2026 character replacement. Reads any staged refund from
 * AsyncStorage on mount, credits the coins, and shows a modal explaining
 * what happened. Mounted globally in _layout.tsx so it triggers regardless
 * of which screen the user lands on first.
 */
export default function CharacterMigrationNotice() {
  const { addCoins, hydrated: coinsHydrated } = useCoins();
  const { user } = useApp();
  const [pending, setPending] = useState<PendingCharacterRefund | null>(null);

  useEffect(() => {
    if (!coinsHydrated) return;
    let cancelled = false;
    (async () => {
      const refund = await readPendingCharacterRefund();
      if (cancelled || !refund) return;
      // Credit the refund THEN clear the pending marker so we never
      // double-credit if the modal is dismissed/remounted.
      await addCoins(refund.amount);
      await clearPendingCharacterRefund();
      setPending(refund);
    })();
    return () => { cancelled = true; };
  }, [coinsHydrated, addCoins]);

  // For pre-update accounts: after login, force the equipped character
  // to match the user's registered gender (boy → char-1, girl → char-2).
  // This covers users who already had a legacy character equipped before
  // the roster swap, or whose equipped slot got cleared by the migration.
  useEffect(() => {
    if (!user?.gender) return;
    ensureDefaultCharacterEquipped(user.gender).catch(() => {});
  }, [user?.gender]);

  // Keep the Modal mounted at all times and drive it with `visible`. On iOS/iPad
  // unmounting a presented Modal (the old `if (!pending) return null`) can leave
  // the native dialog stuck on screen, so the dismiss button appeared to do
  // nothing. Toggling `visible` lets the native modal dismiss cleanly.
  return (
    <Modal
      visible={!!pending}
      transparent
      animationType="fade"
      onRequestClose={() => setPending(null)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>تم تحديث الشخصيات ✨</Text>
          <Text style={styles.body}>
            تم استبدال شخصيات اللعبة بمجموعة جديدة كلياً، والشخصيات القديمة التي
            كنت تمتلكها تم حذفها.
          </Text>
          <Text style={styles.body}>
            تم إرجاع قيمة الشخصيات المشتراة فقط إلى رصيدك:
          </Text>
          <View style={styles.refundRow}>
            <Image source={COIN} style={styles.coin} />
            <Text style={styles.refundAmount}>+{(pending?.amount ?? 0).toLocaleString("en")}</Text>
            <Text style={styles.refundSub}>({pending?.count ?? 0} شخصية)</Text>
          </View>
          <Text style={styles.hint}>
            تقدر تتفرّج على الشخصيات الجديدة في المتجر 🎁
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => setPending(null)} activeOpacity={0.85}>
            <Text style={styles.btnText}>تمام</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  card: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#0E0E0E",
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    padding: 20, gap: 12, alignItems: "center",
  },
  title: {
    color: PRIMARY, fontSize: 20, fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.85)", fontSize: 14,
    fontFamily: "Inter_500Medium", textAlign: "center", lineHeight: 22,
  },
  refundRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderColor: "rgba(232,184,109,0.40)", borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
    marginVertical: 4,
  },
  coin: { width: 26, height: 26, resizeMode: "contain" },
  refundAmount: {
    color: PRIMARY, fontSize: 22, fontFamily: "Inter_700Bold",
  },
  refundSub: {
    color: "rgba(255,255,255,0.55)", fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  hint: {
    color: "rgba(255,255,255,0.55)", fontSize: 12,
    fontFamily: "Inter_500Medium", textAlign: "center",
  },
  btn: {
    marginTop: 6, backgroundColor: PRIMARY,
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12,
    alignSelf: "stretch", alignItems: "center",
  },
  btnText: { color: "#000", fontSize: 16, fontFamily: "Inter_700Bold" },
});
