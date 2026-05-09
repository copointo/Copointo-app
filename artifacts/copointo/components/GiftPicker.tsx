import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GIFTS, GiftDef, GiftTier } from "../data/gifts";

const PRIMARY = "#E8B86D";
const BG      = "#0A0606";
const BORDER  = "rgba(232,184,109,0.30)";

interface Props {
  visible: boolean;
  /** Coin balance — used to disable unaffordable gifts. */
  balance: number;
  /** Recipient display name shown in the header. */
  toName?: string;
  onClose: () => void;
  /** Called when user taps "Send" on a gift they can afford. */
  onSend: (gift: GiftDef) => void;
}

const TIER_LABELS: Record<GiftTier, string> = {
  1: "هدايا عادية",
  2: "هدايا عادية",
  3: "هدايا عادية",
};

/**
 * Modal sheet for picking a gift to send to another user. Groups gifts by tier,
 * shows price and disables anything above the user's coin balance.
 */
export default function GiftPicker({ visible, balance, toName, onClose, onSend }: Props) {
  const [selected, setSelected] = useState<GiftDef | null>(null);

  const groups = useMemo(() => {
    const by: Record<GiftTier, GiftDef[]> = { 1: [], 2: [], 3: [] };
    GIFTS.forEach(g => by[g.tier].push(g));
    return by;
  }, []);

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleSendTap = () => {
    if (!selected) return;
    if (balance < selected.price) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const g = selected;
    setSelected(null);
    onSend(g);
  };

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
              <Text style={styles.balanceCoin}>🪙</Text>
              <Text style={styles.balanceText}>{balance.toLocaleString("en-US")}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {([1, 2, 3] as GiftTier[]).map(tier => (
              <View key={tier} style={{ marginBottom: 14 }}>
                <Text style={styles.tierLabel}>{TIER_LABELS[tier]}</Text>
                <View style={styles.grid}>
                  {groups[tier].map(g => {
                    const affordable = balance >= g.price;
                    const isSel = selected?.id === g.id;
                    return (
                      <TouchableOpacity
                        key={g.id}
                        activeOpacity={0.85}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelected(g);
                        }}
                        style={[
                          styles.card,
                          isSel && { borderColor: g.color, backgroundColor: `${g.color}22` },
                          !affordable && { opacity: 0.45 },
                        ]}
                      >
                        <Text style={styles.cardEmoji}>{g.emoji}</Text>
                        <Text style={styles.cardName} numberOfLines={1}>{g.name}</Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceCoin}>🪙</Text>
                          <Text style={[styles.priceText, !affordable && { color: "#EF4444" }]}>
                            {g.price.toLocaleString("en-US")}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!selected || balance < (selected?.price ?? 0)) && styles.sendBtnDisabled,
            ]}
            onPress={handleSendTap}
            disabled={!selected || balance < (selected?.price ?? 0)}
            activeOpacity={0.85}
          >
            <Feather name="send" size={16} color="#000" />
            <Text style={styles.sendBtnText}>
              {selected
                ? balance < selected.price
                  ? "رصيد غير كافٍ"
                  : `إرسال — ${selected.price.toLocaleString("en-US")} 🪙`
                : "اختر هدية"}
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
  balanceCoin: { fontSize: 14 },
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
  priceRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  priceCoin: { fontSize: 10 },
  priceText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },
  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
});
