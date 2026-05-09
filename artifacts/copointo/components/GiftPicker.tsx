import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GIFTS, GiftDef } from "../data/gifts";
import { useGiftInventory } from "../hooks/useGiftInventory";

const PRIMARY = "#E8B86D";
const BG      = "#0A0606";
const BORDER  = "rgba(232,184,109,0.30)";

interface Props {
  visible: boolean;
  /** Recipient display name shown in the header. */
  toName?: string;
  onClose: () => void;
  /** Called when user taps "Send". Should consume from inventory. */
  onSend: (gift: GiftDef) => void;
}

/**
 * Sheet for picking which owned gift to send. Uses the user's gift inventory:
 * gifts with count 0 are dimmed and disabled, with a hint to buy from the store.
 */
export default function GiftPicker({ visible, toName, onClose, onSend }: Props) {
  const { countOf } = useGiftInventory();
  const [selected, setSelected] = useState<GiftDef | null>(null);

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleSendTap = () => {
    if (!selected) return;
    if (countOf(selected.id) <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const g = selected;
    setSelected(null);
    onSend(g);
  };

  const totalOwned = GIFTS.reduce((sum, g) => sum + countOf(g.id), 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>إرسال هدية</Text>
              {toName ? <Text style={styles.subtitle}>إلى {toName}</Text> : null}
            </View>
            <View style={styles.balancePill}>
              <Feather name="gift" size={13} color={PRIMARY} />
              <Text style={styles.balanceText}>{totalOwned}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.tierLabel}>هدايا عادية</Text>
            <View style={styles.grid}>
              {GIFTS.map(g => {
                const have = countOf(g.id);
                const has = have > 0;
                const isSel = selected?.id === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    activeOpacity={0.85}
                    disabled={!has}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSelected(g);
                    }}
                    style={[
                      styles.card,
                      isSel && { borderColor: g.color, backgroundColor: `${g.color}22` },
                      !has && { opacity: 0.35 },
                    ]}
                  >
                    <Text style={styles.cardEmoji}>{g.emoji}</Text>
                    <Text style={styles.cardName} numberOfLines={1}>{g.name}</Text>
                    <View style={[styles.countChip, has ? null : { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                      <Text style={[styles.countText, !has && { color: "rgba(255,255,255,0.55)" }]}>
                        ×{have}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {totalOwned === 0 && (
              <View style={styles.emptyHint}>
                <Feather name="shopping-bag" size={22} color={PRIMARY} />
                <Text style={styles.emptyHintText}>لا تملك أي هدية بعد — اشترِ من المتجر</Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.sendBtn, (!selected || countOf(selected?.id ?? "") <= 0) && styles.sendBtnDisabled]}
            onPress={handleSendTap}
            disabled={!selected || countOf(selected?.id ?? "") <= 0}
            activeOpacity={0.85}
          >
            <Feather name="send" size={16} color="#000" />
            <Text style={styles.sendBtnText}>
              {selected ? `إرسال ${selected.emoji} ${selected.name}` : "اختر هدية"}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.70)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: BG, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20,
    maxHeight: "85%",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.55)", marginTop: 2 },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,184,109,0.14)", borderColor: BORDER, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  balanceText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  closeBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  tierLabel: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "rgba(232,184,109,0.75)",
    marginBottom: 8, textAlign: "right",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: {
    width: "23.5%", aspectRatio: 0.85,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 8, gap: 4,
  },
  cardEmoji: { fontSize: 28 },
  cardName: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#F5E6CC", textAlign: "center", paddingHorizontal: 4 },
  countChip: {
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.40)",
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  countText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },
  emptyHint: {
    alignItems: "center", gap: 8,
    paddingVertical: 22, paddingHorizontal: 16,
    borderRadius: 14, marginTop: 8,
    backgroundColor: "rgba(232,184,109,0.06)",
    borderWidth: 1, borderColor: BORDER,
  },
  emptyHintText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
});
