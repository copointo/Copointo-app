import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
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
import { RankBadge } from "@/components/RankBadge";
import { useApp } from "@/context/AppContext";
import { getRank } from "@/data/mockData";

const BG   = "#0F0A2E";
const CARD = "rgba(255,255,255,0.06)";
const BORDER = "rgba(255,255,255,0.10)";
const PRIMARY = "#C67C4E";

// ─── Edit Modal ──────────────────────────────────────────────
function EditModal({
  visible, title, value, onClose, onSave, secure,
}: {
  visible: boolean; title: string; value: string;
  onClose: () => void; onSave: (v: string) => void;
  secure?: boolean;
}) {
  const [text, setText] = useState(value);
  const [show, setShow]  = useState(false);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              secureTextEntry={secure && !show}
              autoFocus
              placeholderTextColor="rgba(255,255,255,0.30)"
              placeholder={secure ? "••••••••" : ""}
              selectionColor={PRIMARY}
            />
            {secure && (
              <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
                <Feather name={show ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => { onSave(text); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [username,  setUsername]  = useState(user?.name ?? "Ahmed");
  const [password,  setPassword]  = useState("••••••••");
  const [modal, setModal] = useState<null | "username" | "password">(null);

  const level = user?.level ?? 0;
  const rank  = getRank(level);
  const nextRank = getRank(Math.min(level + 1, 1000));
  const pct   = rank ? ((level - rank.min) / Math.max(rank.max - rank.min, 1)) * 100 : 0;
  const freeCoffees = Math.floor((user?.totalOrders ?? 0) / 7);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("نحتاج إذن الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, gap: 16 }}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarFallback, { borderColor: rank?.color ?? PRIMARY }]}>
                <Text style={styles.avatarLetter}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {/* Camera overlay */}
            <View style={styles.cameraOverlay}>
              <Feather name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoHint}>اضغط لتغيير الصورة</Text>
        </View>

        {/* ── Rank badge ── */}
        <View style={{ alignItems: "center" }}>
          <RankBadge level={level} size="lg" />
        </View>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          {[
            { icon: "⭐", label: "المستوى",       value: level.toString() },
            { icon: "☕", label: "الطلبات",        value: (user?.totalOrders ?? 0).toString() },
            { icon: "🎁", label: "قهوة مجانية",   value: freeCoffees.toString() },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={{ fontSize: 22 }}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>التقدم نحو الرتبة التالية</Text>
            <Text style={[styles.progressPct, { color: rank?.color ?? PRIMARY }]}>{Math.round(pct)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: rank?.color ?? PRIMARY }]} />
          </View>
          <Text style={styles.progressSub}>
            {rank?.nameEn} {rank?.icon}  →  {nextRank?.nameEn} {nextRank?.icon}
          </Text>
        </View>

        {/* ── Edit fields ── */}
        <View style={styles.fieldsCard}>
          {/* Username */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("username")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="user" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>اسم المستخدم</Text>
              <Text style={styles.fieldValue}>@{username}</Text>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Password */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("password")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="lock" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>كلمة المرور</Text>
              <Text style={styles.fieldValue}>{"•".repeat(10)}</Text>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Username modal */}
      <EditModal
        visible={modal === "username"}
        title="تعديل اسم المستخدم"
        value={username}
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim()) { setUsername(v.trim()); if (user) setUser({ ...user, name: v.trim() }); }}}
      />

      {/* Password modal */}
      <EditModal
        visible={modal === "password"}
        title="تعديل كلمة المرور"
        value=""
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim()) setPassword(v.trim()); }}
        secure
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  header:        { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:   { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Avatar
  avatarSection:  { alignItems: "center", gap: 8, marginTop: 8 },
  avatarWrap:     { position: "relative" },
  avatarImg:      { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  avatarLetter:   { fontSize: 42, fontFamily: "Inter_700Bold", color: "#FFF" },
  cameraOverlay:  {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: BG,
  },
  changePhotoHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.35)" },

  // Stats
  statsRow:  {
    flexDirection: "row", backgroundColor: CARD,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    paddingVertical: 16,
  },
  statBox:   { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },

  // Progress
  progressCard:   {
    backgroundColor: CARD, borderRadius: 18, borderWidth: 1,
    borderColor: BORDER, padding: 16, gap: 10,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  progressPct:    { fontSize: 14, fontFamily: "Inter_700Bold" },
  progressTrack:  { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" },
  progressFill:   { height: "100%", borderRadius: 4 },
  progressSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", textAlign: "center" },

  // Edit fields
  fieldsCard: {
    backgroundColor: CARD, borderRadius: 20, borderWidth: 1,
    borderColor: BORDER, overflow: "hidden",
  },
  fieldRow:  {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  fieldIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: `${PRIMARY}20`, alignItems: "center", justifyContent: "center",
  },
  fieldText: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },
  fieldValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  divider:    { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#1A143A",
    borderRadius: 24, padding: 24, gap: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  inputWrap:  {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: "Inter_500Medium",
    color: "#FFF", paddingVertical: 14,
  },
  eyeBtn:  { padding: 8 },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", paddingVertical: 14,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.50)" },
  saveBtn:   { flex: 1, borderRadius: 14, backgroundColor: PRIMARY, alignItems: "center", paddingVertical: 14 },
  saveText:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
});
