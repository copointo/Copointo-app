import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvatarWithFrame from "../components/AvatarWithFrame";
import { useApp } from "../context/AppContext";
import { FRAMES } from "../data/frames";
import { useFrames } from "../hooks/useFrames";

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

export default function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useApp();
  const { owned, equipped, equipFrame } = useFrames();

  const avatarUri = user?.avatar ?? null;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أغراضي</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Live preview ── */}
        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>معاينة</Text>
          <View style={{ height: 130, alignItems: "center", justifyContent: "center" }}>
            <AvatarWithFrame size={84}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.previewAvatarImg} />
              ) : (
                <View style={styles.previewAvatarFallback}>
                  <Feather name="user" size={32} color={PRIMARY} />
                </View>
              )}
            </AvatarWithFrame>
          </View>
          <Text style={styles.previewSub}>
            {equipped ? "هذا الإطار يظهر على صورتك في كل مكان" : "اختر إطاراً ليظهر على صورتك الشخصية وفي التصنيفات"}
          </Text>
        </View>

        {/* ── Section title ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>الإطارات</Text>
          {equipped && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipFrame(null); }}
              style={styles.removeBtn}
            >
              <Feather name="x" size={12} color={PRIMARY} />
              <Text style={styles.removeBtnText}>إزالة الإطار</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Frames grid ── */}
        <View style={styles.grid}>
          {FRAMES.map(f => {
            const isOwned = owned.includes(f.id);
            const isEquipped = equipped === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.tile,
                  isEquipped && styles.tileEquipped,
                  !isOwned && styles.tileLocked,
                ]}
                disabled={!isOwned}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  equipFrame(isEquipped ? null : f.id);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.tileImgWrap}>
                  <Image
                    source={f.source}
                    style={[styles.tileImg, !isOwned && { opacity: 0.25 }]}
                  />
                  {!isOwned && (
                    <View style={styles.lockOverlay}>
                      <Feather name="lock" size={20} color="rgba(255,255,255,0.75)" />
                    </View>
                  )}
                </View>
                <Text style={[styles.tileName, !isOwned && { color: "rgba(255,255,255,0.45)" }]}>
                  {f.name}
                </Text>
                {isEquipped ? (
                  <View style={styles.equippedChip}>
                    <Feather name="check" size={10} color="#000" />
                    <Text style={styles.equippedChipText}>مُجهَّز</Text>
                  </View>
                ) : isOwned ? (
                  <View style={styles.ownedChip}>
                    <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                  </View>
                ) : (
                  <View style={styles.lockedChip}>
                    <Feather name="lock" size={9} color="rgba(255,255,255,0.55)" />
                    <Text style={styles.lockedChipText}>مقفل</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    transform: [{ scaleX: -1 }],
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  scroll: { padding: 16, paddingBottom: 60, gap: 16 },

  previewCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", gap: 8,
  },
  previewLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  previewAvatarImg: { width: 84, height: 84, borderRadius: 42 },
  previewAvatarFallback: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  previewSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)", textAlign: "center",
    lineHeight: 18, paddingHorizontal: 8,
  },

  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  removeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  removeBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },

  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between",
  },
  tile: {
    width: "48%",
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", gap: 8,
  },
  tileEquipped: {
    borderColor: PRIMARY, borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tileLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  tileImgWrap: {
    width: 96, height: 96,
    alignItems: "center", justifyContent: "center",
  },
  tileImg: { width: 96, height: 96, resizeMode: "contain" },
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  tileName: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },

  equippedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: PRIMARY,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  equippedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  ownedChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
  },
  ownedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  lockedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  lockedChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
});
