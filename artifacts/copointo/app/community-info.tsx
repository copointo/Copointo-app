import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useCommunities } from "@/context/CommunityContext";
import {
  COMMUNITY_MAX_MEMBERS,
  COMMUNITY_ROLE_LABEL_AR,
  CommunityRole,
  getCommunityRole,
} from "@/data/mockData";

const BG     = "#000000";
const CARD   = "#0A0606";
const BORDER = "rgba(232,184,109,0.30)";
const ACCENT = "#E8B86D";

export default function CommunityInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user, friends, registeredUsers } = useApp();
  const {
    getCommunity, getCommunityScore, rankingList,
    updateCommunity, removeMember, leaveCommunity, inviteToCommunity,
    setMemberRole,
    refresh,
  } = useCommunities();

  // Refresh on focus (for cross-user member changes)
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const community = id ? getCommunity(id) : undefined;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState("");
  const [showInvite, setShowInvite]   = useState(false);
  const [invitePick, setInvitePick]   = useState<Set<string>>(new Set());
  const [busy, setBusy]               = useState(false);
  const [err, setErr]                 = useState("");

  const memberUsers = useMemo(
    () => (community?.members ?? [])
      .map(mid => registeredUsers.find(u => u.id === mid))
      .filter((u): u is NonNullable<typeof u> => !!u),
    [community?.members, registeredUsers],
  );

  // Friends not yet members → invitable
  const invitableFriends = useMemo(
    () => registeredUsers
      .filter(u =>
        friends.includes(u.id) &&
        u.id !== user?.id &&
        !community?.members.includes(u.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
    [registeredUsers, friends, user?.id, community?.members],
  );

  // Ranking position (1-based)
  const rankPos = useMemo(() => {
    if (!community) return null;
    const idx = rankingList.findIndex(r => r.community.id === community.id);
    return idx === -1 ? null : idx + 1;
  }, [community, rankingList]);

  if (!community) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المجتمع</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>المجتمع غير موجود</Text>
        </View>
      </View>
    );
  }

  const myRole: CommunityRole | null = user ? getCommunityRole(community, user.id) : null;
  const isLeader = myRole === "leader";
  const isVice   = myRole === "vice";
  const isCreator = isLeader; // backward-compat alias used in styling/permissions
  const score = getCommunityScore(community.id);

  const roleColor = (role: CommunityRole): string => {
    switch (role) {
      case "leader": return "#FFD700";
      case "vice":   return "#E8B86D";
      case "senior": return "#7FB7E8";
      default:       return "rgba(255,255,255,0.55)";
    }
  };
  const roleIcon = (role: CommunityRole): string => {
    switch (role) {
      case "leader": return "👑";
      case "vice":   return "⭐";
      case "senior": return "🎖️";
      default:       return "👤";
    }
  };

  const handleSetRole = async (mid: string, next: CommunityRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setErr("");
    const r = await setMemberRole(community.id, mid, next);
    if (!r.ok) setErr(r.error);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pickAvatar = async () => {
    if (!isCreator) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setBusy(true);
        await updateCommunity(community.id, { avatar: result.assets[0].uri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBusy(false);
      }
    } catch (_) { setBusy(false); }
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === community.name) { setEditingName(false); return; }
    setBusy(true);
    await updateCommunity(community.id, { name: trimmed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(false);
    setEditingName(false);
  };

  const submitInvite = async () => {
    setErr("");
    if (invitePick.size === 0) { setShowInvite(false); return; }
    if (community.members.length + invitePick.size > COMMUNITY_MAX_MEMBERS) {
      setErr(`الحد الأقصى ${COMMUNITY_MAX_MEMBERS} عضواً`); return;
    }
    setBusy(true);
    const r = await inviteToCommunity(community.id, Array.from(invitePick));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setInvitePick(new Set());
    setShowInvite(false);
  };

  const handleRemove = async (mid: string) => {
    if (!isCreator || mid === user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await removeMember(community.id, mid);
  };

  const handleLeave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await leaveCommunity(community.id);
    router.back();
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
        <Text style={styles.headerTitle}>معلومات المجتمع</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={pickAvatar}
            activeOpacity={isCreator ? 0.85 : 1}
            style={styles.avatarWrap}
            disabled={busy || !isCreator}
          >
            {community.avatar ? (
              <Image source={{ uri: community.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={{ fontSize: 44 }}>🏛️</Text>
              </View>
            )}
            {isCreator && (
              <View style={styles.avatarEditDot}>
                <Feather name="camera" size={12} color="#000" />
              </View>
            )}
          </TouchableOpacity>

          {editingName && isCreator ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameDraft}
                onChangeText={setNameDraft}
                maxLength={40}
                autoFocus
                textAlign="center"
              />
              <TouchableOpacity onPress={saveName} style={styles.nameSaveBtn}>
                <Feather name="check" size={16} color="#000" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                if (!isCreator) return;
                setNameDraft(community.name); setEditingName(true);
              }}
              activeOpacity={isCreator ? 0.8 : 1}
              style={styles.nameDisplayRow}
              disabled={!isCreator}
            >
              <Text style={styles.groupName}>{community.name}</Text>
              {isCreator && <Feather name="edit-2" size={14} color={ACCENT} />}
            </TouchableOpacity>
          )}
          <Text style={styles.subInfo}>
            {community.members.length} / {COMMUNITY_MAX_MEMBERS} أعضاء
          </Text>
        </View>

        {/* Score / Rank cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>☕</Text>
            <Text style={styles.statValue}>{score}</Text>
            <Text style={styles.statLabel}>إجمالي القهوات</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🏆</Text>
            <Text style={styles.statValue}>
              {rankPos !== null ? `#${rankPos}` : "—"}
            </Text>
            <Text style={styles.statLabel}>الترتيب</Text>
          </View>
        </View>

        {/* Members */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الأعضاء</Text>
          {(isLeader || isVice) && invitableFriends.length > 0 && community.members.length < COMMUNITY_MAX_MEMBERS && (
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setErr(""); setShowInvite(true);
              }}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={13} color="#000" />
              <Text style={styles.addMemberText}>دعوة</Text>
            </TouchableOpacity>
          )}
        </View>

        {memberUsers
          .slice()
          .sort((a, b) => {
            // Sort by role weight first (leader → vice → senior → member), then by orders
            const order: Record<CommunityRole, number> = { leader: 0, vice: 1, senior: 2, member: 3 };
            const ra = order[getCommunityRole(community, a.id)];
            const rb = order[getCommunityRole(community, b.id)];
            if (ra !== rb) return ra - rb;
            return (b.totalOrders ?? 0) - (a.totalOrders ?? 0);
          })
          .map(m => {
            const isMe        = m.id === user?.id;
            const targetRole  = getCommunityRole(community, m.id);
            const tColor      = roleColor(targetRole);
            // Permission to act on this member
            const canPromote =
              !isMe && (
                (isLeader && targetRole !== "leader" && targetRole !== "vice") ||
                (isVice   && targetRole === "member")
              );
            const canDemote =
              !isMe && isLeader && (targetRole === "vice" || targetRole === "senior");
            const promoteNext: CommunityRole | null =
              targetRole === "member" ? "senior"
              : targetRole === "senior" ? "vice"
              : null;
            const demoteNext: CommunityRole | null =
              targetRole === "vice" ? "senior"
              : targetRole === "senior" ? "member"
              : null;

            return (
              <View key={m.id} style={styles.row}>
                {m.avatar ? (
                  <Image source={{ uri: m.avatar }} style={styles.rowAvatar} />
                ) : (
                  <View style={styles.rowAvatarPlaceholder}>
                    <Text style={{ fontSize: 18 }}>
                      {m.gender === "female" ? "👩" : m.gender === "male" ? "🧑" : "👤"}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.rowNameRow}>
                    <Text style={styles.rowName}>{isMe ? "أنت" : m.name}</Text>
                    <View style={[styles.roleTag, { backgroundColor: tColor + "22", borderColor: tColor + "55" }]}>
                      <Text style={[styles.roleTagText, { color: tColor }]}>
                        {roleIcon(targetRole)} {COMMUNITY_ROLE_LABEL_AR[targetRole]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowSub}>
                    @{m.gameUsername} · ☕ {m.totalOrders ?? 0}
                  </Text>
                </View>

                {/* Action buttons (promote / demote / remove) */}
                <View style={styles.actionsCol}>
                  {canPromote && promoteNext && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.promoteBtn]}
                      onPress={() => handleSetRole(m.id, promoteNext)}
                      activeOpacity={0.8}
                    >
                      <Feather name="chevron-up" size={16} color="#000" />
                    </TouchableOpacity>
                  )}
                  {canDemote && demoteNext && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.demoteBtn]}
                      onPress={() => handleSetRole(m.id, demoteNext)}
                      activeOpacity={0.8}
                    >
                      <Feather name="chevron-down" size={16} color="#E8B86D" />
                    </TouchableOpacity>
                  )}
                  {isLeader && !isMe && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.removeBtn]}
                      onPress={() => handleRemove(m.id)}
                      activeOpacity={0.8}
                    >
                      <Feather name="user-minus" size={14} color="#FF6B6B" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

        {!!err && <Text style={styles.err}>{err}</Text>}

        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.85}>
          <Feather name="log-out" size={14} color="#E8B86D" />
          <Text style={styles.leaveText}>مغادرة المجتمع</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Invite modal */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>دعوة أعضاء جدد</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)}>
                <Feather name="x" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {invitableFriends.map(f => {
                const sel = invitePick.has(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.modalRow, sel && styles.modalRowSel]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setInvitePick(prev => {
                        const next = new Set(prev);
                        if (next.has(f.id)) next.delete(f.id); else next.add(f.id);
                        return next;
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    {f.avatar ? (
                      <Image source={{ uri: f.avatar }} style={styles.rowAvatar} />
                    ) : (
                      <View style={styles.rowAvatarPlaceholder}>
                        <Text style={{ fontSize: 18 }}>
                          {f.gender === "female" ? "👩" : f.gender === "male" ? "🧑" : "👤"}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.rowName, { flex: 1 }]}>{f.name}</Text>
                    <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                      {sel && <Feather name="check" size={14} color="#000" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {!!err && <Text style={styles.err}>{err}</Text>}
            <TouchableOpacity
              style={[styles.modalSubmitBtn, busy && { opacity: 0.6 }]}
              onPress={submitInvite}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Feather name="send" size={15} color="#000" />
              <Text style={styles.modalSubmitText}>
                {invitePick.size === 0 ? "إغلاق" : `إرسال ${invitePick.size} دعوة`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },

  avatarSection: { alignItems: "center", marginVertical: 18, gap: 8, paddingHorizontal: 20 },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 2, borderColor: ACCENT,
  },
  avatarPlaceholder: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: ACCENT + "22",
    borderWidth: 2, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  avatarEditDot: {
    position: "absolute", right: 0, bottom: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: BG,
  },
  nameDisplayRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 4,
  },
  groupName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  nameEditRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 4,
  },
  nameInput: {
    fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF",
    backgroundColor: CARD, borderRadius: 10,
    borderWidth: 1, borderColor: ACCENT,
    paddingHorizontal: 12, paddingVertical: 8,
    minWidth: 200,
  },
  nameSaveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  subInfo: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },

  statsRow: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 20, marginTop: 6, marginBottom: 16,
  },
  statCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 14, alignItems: "center", gap: 4,
  },
  statIcon: { fontSize: 22 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold", color: ACCENT },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)" },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20, marginTop: 6, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.7)",
  },
  addMemberBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: ACCENT,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16,
  },
  addMemberText: {
    fontSize: 11, fontFamily: "Inter_700Bold", color: "#000",
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: CARD,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rowAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
  },
  rowAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  rowNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  rowSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  roleTag: {
    borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1,
  },
  roleTagText: {
    fontSize: 10, fontFamily: "Inter_700Bold",
  },
  actionsCol: { flexDirection: "row", gap: 6, alignItems: "center" },
  actionBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  promoteBtn: { backgroundColor: ACCENT },
  demoteBtn: {
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)",
  },
  removeBtn: {
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1, borderColor: "rgba(255,107,107,0.35)",
  },

  leaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    marginHorizontal: 20, marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,107,107,0.4)",
    backgroundColor: "rgba(255,107,107,0.05)",
  },
  leaveText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#FF6B6B",
  },

  emptyWrap: { alignItems: "center", paddingTop: 80 },
  emptyText: {
    fontSize: 15, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
  },

  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },

  modalBg: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: CARD,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 16,
    borderTopWidth: 1, borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  modalRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalRowSel: { backgroundColor: ACCENT + "12" },
  modalSubmitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14, paddingVertical: 14,
    marginTop: 12,
  },
  modalSubmitText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  err: {
    color: "#FF6B6B", textAlign: "center",
    marginTop: 8, marginBottom: 4,
    fontSize: 13, fontFamily: "Inter_500Medium",
  },
});
