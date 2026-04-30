import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import { useMessages } from "@/context/MessagesContext";

const BG     = "#000000";
const CARD   = "#0A0606";
const BORDER = "rgba(232,184,109,0.30)";
const ACCENT = "#E8B86D";

export default function GroupInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user, friends, registeredUsers } = useApp();
  const { getGroup, updateGroup, addGroupMember, removeGroupMember, leaveGroup } = useMessages();

  const group = id ? getGroup(id) : undefined;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState(group?.name ?? "");
  const [showAdd, setShowAdd]         = useState(false);
  const [addPick, setAddPick]         = useState<Set<string>>(new Set());
  const [busy, setBusy]               = useState(false);

  const memberUsers = useMemo(
    () => (group?.members ?? [])
      .map(mid => registeredUsers.find(u => u.id === mid))
      .filter((u): u is NonNullable<typeof u> => !!u),
    [group?.members, registeredUsers],
  );

  // Friends not yet in the group → can be added
  const addableFriends = useMemo(
    () => registeredUsers
      .filter(u =>
        friends.includes(u.id) &&
        u.id !== user?.id &&
        !group?.members.includes(u.id),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
    [registeredUsers, friends, user?.id, group?.members],
  );

  if (!group) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>المجموعة</Text>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>المجموعة غير موجودة</Text>
        </View>
      </View>
    );
  }

  const isCreator = group.createdBy === user?.id;

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setBusy(true);
        await updateGroup(group.id, { avatar: result.assets[0].uri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setBusy(false);
      }
    } catch (_) { setBusy(false); }
  };

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === group.name) { setEditingName(false); return; }
    setBusy(true);
    await updateGroup(group.id, { name: trimmed });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(false);
    setEditingName(false);
  };

  const submitAdd = async () => {
    if (addPick.size === 0) { setShowAdd(false); return; }
    setBusy(true);
    for (const mid of addPick) {
      await addGroupMember(group.id, mid);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBusy(false);
    setAddPick(new Set());
    setShowAdd(false);
  };

  const handleRemove = async (mid: string) => {
    if (!isCreator || mid === user?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await removeGroupMember(group.id, mid);
  };

  const handleLeave = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await leaveGroup(group.id);
    router.back();
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
        <Text style={styles.headerTitle}>معلومات المجموعة</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarWrap} disabled={busy}>
            {group.avatar ? (
              <Image source={{ uri: group.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={{ fontSize: 40 }}>👥</Text>
              </View>
            )}
            <View style={styles.avatarEditDot}>
              <Feather name="camera" size={12} color="#000" />
            </View>
          </TouchableOpacity>

          {editingName ? (
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
              onPress={() => { setNameDraft(group.name); setEditingName(true); }}
              activeOpacity={0.8}
              style={styles.nameDisplayRow}
            >
              <Text style={styles.groupName}>{group.name}</Text>
              <Feather name="edit-2" size={14} color={ACCENT} />
            </TouchableOpacity>
          )}
          <Text style={styles.subInfo}>
            {group.members.length} أعضاء · أنشئت {new Date(group.createdAt).toLocaleDateString("ar")}
          </Text>
        </View>

        {/* Members list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الأعضاء</Text>
          {addableFriends.length > 0 && (
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
              activeOpacity={0.85}
            >
              <Feather name="user-plus" size={13} color="#000" />
              <Text style={styles.addMemberText}>إضافة</Text>
            </TouchableOpacity>
          )}
        </View>

        {memberUsers.map(m => {
          const isMe   = m.id === user?.id;
          const isOwn  = m.id === group.createdBy;
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
                  {isOwn && (
                    <View style={styles.creatorTag}>
                      <Text style={styles.creatorTagText}>المنشئ</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.rowSub}>@{m.gameUsername}</Text>
              </View>
              {isCreator && !isMe && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(m.id)}
                  activeOpacity={0.8}
                >
                  <Feather name="user-minus" size={14} color="#FF6B6B" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* Leave group */}
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.85}>
          <Feather name="log-out" size={14} color="#FF6B6B" />
          <Text style={styles.leaveText}>مغادرة المجموعة</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add member modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>إضافة أعضاء</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Feather name="x" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {addableFriends.map(f => {
                const sel = addPick.has(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.modalRow, sel && styles.modalRowSel]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setAddPick(prev => {
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
            <TouchableOpacity
              style={[styles.modalSubmitBtn, busy && { opacity: 0.6 }]}
              onPress={submitAdd}
              activeOpacity={0.85}
              disabled={busy}
            >
              <Feather name="check" size={15} color="#000" />
              <Text style={styles.modalSubmitText}>
                {addPick.size === 0 ? "إغلاق" : `إضافة ${addPick.size}`}
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

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20, marginTop: 12, marginBottom: 8,
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
  creatorTag: {
    backgroundColor: ACCENT + "33",
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  creatorTagText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: ACCENT,
  },
  removeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,107,107,0.10)",
    alignItems: "center", justifyContent: "center",
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
  modalRowSel: {
    backgroundColor: ACCENT + "12",
  },
  modalSubmitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14, paddingVertical: 14,
    marginTop: 12,
  },
  modalSubmitText: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#000",
  },
});
