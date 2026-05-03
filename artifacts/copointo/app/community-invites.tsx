import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCommunities } from "@/context/CommunityContext";

const BG     = "#000000";
const CARD   = "#0A0606";
const BORDER = "rgba(232,184,109,0.30)";
const ACCENT = "#E8B86D";

export default function CommunityInvitesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { incomingInvites, acceptInvite, declineInvite, refresh } = useCommunities();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr]       = useState("");

  // Refresh on focus to pick up newly-arrived invites
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const handleAccept = async (cid: string) => {
    setErr("");
    setBusyId(cid);
    const r = await acceptInvite(cid);
    setBusyId(null);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace(`/community-info?id=${cid}`);
  };

  const handleDecline = async (cid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await declineInvite(cid);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📬 دعوات المجتمعات</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {!!err && <Text style={styles.err}>{err}</Text>}

        {incomingInvites.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={{ fontSize: 56 }}>📭</Text>
            <Text style={styles.emptyTitle}>لا توجد دعوات</Text>
            <Text style={styles.emptySub}>عندما يدعوك أحد الأصدقاء لمجتمع ستظهر هنا.</Text>
          </View>
        ) : (
          incomingInvites.map(inv => (
            <View key={inv.communityId} style={styles.card}>
              <View style={styles.cardTop}>
                {inv.communityAvatar ? (
                  <Image source={{ uri: inv.communityAvatar }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPh}>
                    <Text style={{ fontSize: 28 }}>🏛️</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.commName}>{inv.communityName}</Text>
                  <Text style={styles.fromText}>
                    دعاك <Text style={styles.fromName}>{inv.fromUserName}</Text>
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.acceptBtn, busyId === inv.communityId && { opacity: 0.5 }]}
                  onPress={() => handleAccept(inv.communityId)}
                  disabled={busyId === inv.communityId}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={14} color="#000" />
                  <Text style={styles.acceptText}>قبول</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDecline(inv.communityId)}
                  activeOpacity={0.85}
                  disabled={busyId === inv.communityId}
                >
                  <Feather name="x" size={14} color="#E8B86D" />
                  <Text style={styles.declineText}>رفض</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF" },

  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 30,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: BORDER,
    gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarImg: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: ACCENT,
  },
  avatarPh: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ACCENT + "22",
    borderWidth: 2, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  commName: {
    fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "right",
  },
  fromText: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 4, textAlign: "right",
  },
  fromName: { color: ACCENT, fontFamily: "Inter_700Bold" },

  actions: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 12, paddingVertical: 11,
  },
  acceptText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },
  declineBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderRadius: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: "rgba(255,107,107,0.4)",
  },
  declineText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FF6B6B" },

  err: {
    color: "#FF6B6B", textAlign: "center",
    marginBottom: 10, fontSize: 13, fontFamily: "Inter_500Medium",
  },
});
