import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Image,
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

export default function CreateGroupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { user, friends, registeredUsers } = useApp();
  const { createGroup } = useMessages();

  const [name, setName]       = useState("");
  const [avatar, setAvatar]   = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState("");

  const friendList = useMemo(
    () =>
      registeredUsers
        .filter(u => friends.includes(u.id) && u.id !== user?.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [registeredUsers, friends, user?.id],
  );

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pickAvatar = async () => {
    setErr("");
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { setErr("نحتاج إذن الوصول للصور"); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setAvatar(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (_) { setErr("تعذّر اختيار الصورة"); }
  };

  const submit = async () => {
    setErr("");
    if (!name.trim()) { setErr("الرجاء إدخال اسم للمجموعة"); return; }
    if (selected.size < 1) { setErr("اختر صديقاً واحداً على الأقل"); return; }
    setBusy(true);
    try {
      const grp = await createGroup(name.trim(), Array.from(selected), avatar ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Replace stack so back-button returns to messages tab
      router.replace(
        `/conversation?id=group_${grp.id}&name=${encodeURIComponent(grp.name)}&type=group`,
      );
    } catch (_) {
      setErr("تعذّر إنشاء المجموعة");
    } finally {
      setBusy(false);
    }
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
        <Text style={styles.headerTitle}>مجموعة جديدة</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Feather name="camera" size={26} color={ACCENT} />
              </View>
            )}
            <View style={styles.avatarEditDot}>
              <Feather name="edit-2" size={10} color="#000" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>اضغط لاختيار صورة (اختياري)</Text>
        </View>

        {/* Name input */}
        <Text style={styles.label}>اسم المجموعة</Text>
        <TextInput
          style={styles.input}
          placeholder="مثلاً: أصدقاء القهوة ☕"
          placeholderTextColor="rgba(232,184,109,0.40)"
          value={name}
          onChangeText={setName}
          maxLength={40}
          textAlign="right"
        />

        {/* Members section */}
        <View style={styles.membersHeader}>
          <Text style={styles.label}>اختر الأعضاء</Text>
          <Text style={styles.countText}>{selected.size} مختار</Text>
        </View>

        {friendList.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="users" size={36} color="rgba(232,184,109,0.35)" />
            <Text style={styles.emptyText}>
              ليس لديك أصدقاء بعد. أضف أصدقاء أولاً ثم أنشئ المجموعة.
            </Text>
          </View>
        ) : (
          friendList.map(f => {
            const isSel = selected.has(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.row, isSel && styles.rowSel]}
                onPress={() => toggle(f.id)}
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{f.name}</Text>
                  <Text style={styles.rowSub}>@{f.gameUsername}</Text>
                </View>
                <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                  {isSel && <Feather name="check" size={14} color="#000" />}
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {!!err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <TouchableOpacity
          style={[styles.submitBtn, (busy || friendList.length === 0) && { opacity: 0.5 }]}
          onPress={submit}
          activeOpacity={0.85}
          disabled={busy || friendList.length === 0}
        >
          <Feather name="check" size={16} color="#000" />
          <Text style={styles.submitText}>{busy ? "جارٍ الإنشاء..." : "إنشاء المجموعة"}</Text>
        </TouchableOpacity>
      </View>
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
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },

  avatarSection: { alignItems: "center", marginVertical: 18, gap: 8 },
  avatarWrap: { position: "relative" },
  avatarImg: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: ACCENT,
  },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: CARD,
    borderWidth: 2, borderColor: BORDER, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  avatarEditDot: {
    position: "absolute", right: 0, bottom: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: BG,
  },
  avatarHint: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(232,184,109,0.55)",
  },

  label: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: "rgba(232,184,109,0.75)",
    marginHorizontal: 20, marginBottom: 8,
    textAlign: "right",
  },
  input: {
    marginHorizontal: 20,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_500Medium",
    color: "#F5E6CC",
    marginBottom: 18,
  },

  membersHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20, marginTop: 4, marginBottom: 8,
  },
  countText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: ACCENT,
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: CARD,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: BORDER,
  },
  rowSel: { borderColor: ACCENT, borderWidth: 1.5 },
  rowAvatar: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
  },
  rowAvatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  rowName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: "#F5E6CC", marginBottom: 2,
    textAlign: "right",
  },
  rowSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(232,184,109,0.55)",
    textAlign: "right",
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: ACCENT, borderColor: ACCENT },

  emptyWrap: {
    alignItems: "center", paddingVertical: 40, gap: 10,
    paddingHorizontal: 30,
  },
  emptyText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(232,184,109,0.50)",
    textAlign: "center",
  },

  err: {
    color: "#FF6B6B", textAlign: "center",
    marginTop: 14, fontSize: 13, fontFamily: "Inter_500Medium",
  },

  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: BG,
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14, paddingVertical: 14,
  },
  submitText: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#000",
  },
});
