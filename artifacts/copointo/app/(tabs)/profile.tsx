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
const DANGER = "#E55353";

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

// ─── Auth Modal ──────────────────────────────────────────────
function AuthModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { register, login } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  // login fields
  const [logPhone, setLogPhone] = useState("");
  const [logPass,  setLogPass]  = useState("");

  // register fields (simplified)
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regGender, setRegGender] = useState<"male" | "female" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gameUser, setGameUser] = useState("");
  const [pass, setPass] = useState("");

  const reset = () => {
    setLogPhone(""); setLogPass("");
    setRegAvatar(null); setRegGender(null);
    setName(""); setPhone(""); setGameUser(""); setPass("");
    setErr(""); setBusy(false);
  };

  const close = () => { reset(); onClose(); };

  const pickRegAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { setErr("نحتاج إذن الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setRegAvatar(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const submitLogin = async () => {
    setErr("");
    if (!logPhone.trim() || !logPass.trim()) { setErr("يرجى تعبئة جميع الحقول"); return; }
    setBusy(true);
    const r = await login(logPhone.trim(), logPass);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const submitRegister = async () => {
    setErr("");
    if (!name.trim() || !phone.trim() || !gameUser.trim() || !pass) {
      setErr("يرجى تعبئة جميع الحقول"); return;
    }
    if (!regGender) { setErr("الرجاء اختيار الجنس"); return; }
    if (pass.length < 6) { setErr("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setBusy(true);
    const r = await register({
      name: name.trim(),
      phone: phone.trim(),
      gameUsername: gameUser.trim(),
      password: pass,
      gender: regGender,
      avatar: regAvatar ?? undefined,
    });
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const fallbackEmoji = regGender === "female" ? "👩" : regGender === "male" ? "🧑" : "📷";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={[styles.authCard, { maxHeight: "94%" }]}>
          {/* close */}
          <TouchableOpacity onPress={close} style={styles.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>

          {/* Brand header */}
          <View style={styles.authBrand}>
            <View style={styles.authLogo}>
              <Text style={{ fontSize: 32 }}>☕</Text>
            </View>
            <Text style={styles.authBrandName}>كوبوينتو</Text>
            <Text style={styles.authBrandSub}>
              {mode === "login" ? "أهلاً بعودتك!" : "ابدأ رحلتك مع القهوة"}
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.authTabs}>
            <TouchableOpacity
              onPress={() => { setMode("login"); setErr(""); }}
              style={[styles.authTab, mode === "login" && styles.authTabActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.authTabText, mode === "login" && styles.authTabTextActive]}>
                دخول
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setMode("register"); setErr(""); }}
              style={[styles.authTab, mode === "register" && styles.authTabActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.authTabText, mode === "register" && styles.authTabTextActive]}>
                حساب جديد
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {mode === "login" ? (
              <>
                <AuthField icon="phone" placeholder="رقم الهاتف" value={logPhone} onChange={setLogPhone} keyboardType="phone-pad" />
                <AuthField icon="lock" placeholder="كلمة المرور" value={logPass} onChange={setLogPass} secure />
              </>
            ) : (
              <>
                {/* Avatar picker (optional) */}
                <View style={{ alignItems: "center", marginBottom: 4 }}>
                  <TouchableOpacity onPress={pickRegAvatar} activeOpacity={0.85} style={styles.regAvatarWrap}>
                    {regAvatar ? (
                      <Image source={{ uri: regAvatar }} style={styles.regAvatarImg} />
                    ) : (
                      <Text style={{ fontSize: 36 }}>{fallbackEmoji}</Text>
                    )}
                    <View style={styles.regAvatarBadge}>
                      <Feather name={regAvatar ? "edit-2" : "camera"} size={13} color="#FFF" />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.regAvatarHint}>
                    {regAvatar ? "اضغط لتغيير الصورة" : "أضف صورة (اختياري)"}
                  </Text>
                </View>

                <AuthField icon="user" placeholder="الاسم الكامل" value={name} onChange={setName} />
                <AuthField icon="phone" placeholder="رقم الهاتف" value={phone} onChange={setPhone} keyboardType="phone-pad" />

                {/* Gender selector */}
                <View>
                  <Text style={styles.fieldLabel}>الجنس</Text>
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      onPress={() => { setRegGender("male"); Haptics.selectionAsync(); }}
                      style={[styles.genderBtn, regGender === "male" && styles.genderBtnActiveMale]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.genderEmoji}>🧑</Text>
                      <Text style={[styles.genderText, regGender === "male" && { color: "#FFF" }]}>ذكر</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setRegGender("female"); Haptics.selectionAsync(); }}
                      style={[styles.genderBtn, regGender === "female" && styles.genderBtnActiveFemale]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.genderEmoji}>👩</Text>
                      <Text style={[styles.genderText, regGender === "female" && { color: "#FFF" }]}>أنثى</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <AuthField icon="award" placeholder="يوزر اللعبة" value={gameUser} onChange={setGameUser} />
                <AuthField icon="lock" placeholder="كلمة المرور (6 أحرف على الأقل)" value={pass} onChange={setPass} secure />
              </>
            )}

            {err ? <Text style={styles.errorText}>{err}</Text> : null}

            <TouchableOpacity
              onPress={mode === "login" ? submitLogin : submitRegister}
              style={[styles.authPrimaryBtn, busy && { opacity: 0.6 }]}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={styles.authPrimaryText}>
                {busy ? "جارٍ المعالجة..." : mode === "login" ? "دخول" : "إنشاء الحساب"}
              </Text>
              {!busy && <Feather name="arrow-left" size={18} color="#FFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
              style={{ paddingVertical: 8, alignItems: "center" }}
            >
              <Text style={styles.authSwitchText}>
                {mode === "login" ? "ليس لديك حساب؟ " : "لديك حساب؟ "}
                <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>
                  {mode === "login" ? "سجّل الآن" : "ادخل"}
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AuthField({
  icon, placeholder, value, onChange, secure, keyboardType,
}: {
  icon: keyof typeof Feather.glyphMap;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <Feather name={icon} size={16} color="rgba(255,255,255,0.45)" />
      <TextInput
        style={[styles.input, { paddingHorizontal: 10 }]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !show}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.30)"
        selectionColor={PRIMARY}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
      {secure && (
        <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
          <Feather name={show ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Logout Confirm Modal ────────────────────────────────────
function LogoutConfirmModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <View style={styles.warnIcon}>
              <Feather name="log-out" size={26} color={DANGER} />
            </View>
            <Text style={styles.modalTitle}>تأكيد تسجيل الخروج</Text>
            <Text style={styles.confirmSub}>هل أنت متأكد من رغبتك في تسجيل الخروج من حسابك؟</Text>
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: DANGER }]}
              onPress={() => { onConfirm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, setUser, logout, friends, registeredUsers } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [authOpen,    setAuthOpen]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [modal, setModal] = useState<null | "username" | "password">(null);

  const avatarUri = user?.avatar ?? null;
  const genderEmoji = user?.gender === "female" ? "👩" : user?.gender === "male" ? "🧑" : "👤";

  // ── Logged-out empty state ──
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الملف الشخصي</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="user" size={56} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>مرحباً بك في كوبوينتو</Text>
          <Text style={styles.emptySub}>سجّل دخولك الآن للاستفادة من كامل ميزات التطبيق</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setAuthOpen(true)}
            activeOpacity={0.88}
          >
            <Feather name="log-in" size={18} color="#FFF" />
            <Text style={styles.loginBtnText}>سجّل الدخول الآن لاستخدام التطبيق</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
      </View>
    );
  }

  // ── Logged-in state ──
  const username = user.gameUsername || user.name;
  const level = user.level ?? 0;
  const rank  = getRank(level);
  const nextRank = getRank(Math.min(level + 1, 1000));
  const pct   = rank ? ((level - rank.min) / Math.max(rank.max - rank.min, 1)) * 100 : 0;
  const freeCoffees = Math.floor((user.totalOrders ?? 0) / 7);

  // Friends count + ranks (show "—" for brand-new users with no activity)
  const friendsCount = friends.length;
  const hasActivity = (user.level ?? 0) > 0 || (user.totalOrders ?? 0) > 0 || (user.points ?? 0) > 0;

  const omanRankStr = (() => {
    if (!hasActivity) return "—";
    const sorted = [...registeredUsers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const friendsRankStr = (() => {
    if (!hasActivity) return "—";
    const friendPool = registeredUsers.filter(u => friends.includes(u.id) || u.id === user.id);
    if (friendPool.length === 0) return "—";
    const sorted = friendPool.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("نحتاج إذن الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user) {
      setUser({ ...user, avatar: result.assets[0].uri });
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
                <Text style={styles.avatarLetter}>{genderEmoji}</Text>
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

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          {/* Row 1 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{friendsCount}</Text>
              <Text style={styles.statLabel}>الأصدقاء</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>{level}</Text>
              <Text style={styles.statLabel}>المستوى</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>🎁</Text>
              <Text style={styles.statValue}>{freeCoffees}</Text>
              <Text style={styles.statLabel}>قهوة مجانية</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>👫</Text>
              <Text style={styles.statValue}>{friendsRankStr}</Text>
              <Text style={styles.statLabel}>تصنيف الأصدقاء</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>🇴🇲</Text>
              <Text style={styles.statValue}>{omanRankStr}</Text>
              <Text style={styles.statLabel}>تصنيف عُمان</Text>
            </View>
          </View>
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
              <Text style={styles.fieldLabel}>يوزر اللعبة</Text>
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

        {/* ── Logout button ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setConfirmOpen(true)}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={17} color={DANGER} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Username modal */}
      <EditModal
        visible={modal === "username"}
        title="تعديل يوزر اللعبة"
        value={username}
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim() && user) setUser({ ...user, gameUsername: v.trim() }); }}
      />

      {/* Password modal */}
      <EditModal
        visible={modal === "password"}
        title="تعديل كلمة المرور"
        value=""
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim() && user) setUser({ ...user, password: v.trim() }); }}
        secure
      />

      {/* Logout confirmation */}
      <LogoutConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => { setConfirmOpen(false); await logout(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  header:        { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:   { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Empty state
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  emptyIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 2, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 },
  loginBtn:   {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 16, shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  loginBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

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
  statsGrid:    { gap: 10 },
  statsRow:     { flexDirection: "row", gap: 10 },
  statBox:      { alignItems: "center", gap: 6, paddingVertical: 16, paddingHorizontal: 8 },
  statBoxCard:  {
    flex: 1, backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
  },
  statIcon:  { fontSize: 22 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", textAlign: "center" },

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

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_700Bold", color: DANGER },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#1A143A",
    borderRadius: 24, padding: 24, gap: 16,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  closeBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap:  {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: "Inter_500Medium",
    color: "#FFF", paddingVertical: 13,
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

  // Tabs
  tabsRow: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 4, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  tabTextActive: { color: "#FFF" },

  errorText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: DANGER, textAlign: "center",
    backgroundColor: `${DANGER}15`, padding: 10, borderRadius: 10,
  },

  // ── Auth modal (new) ──
  authCard: {
    width: "100%", backgroundColor: "#1A143A",
    borderRadius: 28, padding: 22, gap: 14,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  authBrand: { alignItems: "center", gap: 4, marginTop: 6 },
  authLogo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: `${PRIMARY}25`,
    borderWidth: 1.5, borderColor: `${PRIMARY}55`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  authBrandName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  authBrandSub:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  authTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 4, gap: 4,
  },
  authTab: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
  authTabActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  authTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  authTabTextActive: { color: "#FFF" },
  authPrimaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 15, marginTop: 4,
    shadowColor: PRIMARY, shadowOpacity: 0.45,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  authPrimaryText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  authSwitchText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },

  // Register avatar
  regAvatarWrap: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2, borderColor: `${PRIMARY}60`, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  },
  regAvatarImg: { width: "100%", height: "100%", borderRadius: 43 },
  regAvatarBadge: {
    position: "absolute", bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#1A143A",
  },
  regAvatarHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", marginTop: 6 },

  // Gender
  genderRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  genderBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
  },
  genderBtnActiveMale:   { backgroundColor: "#4FC3F7", borderColor: "#4FC3F7" },
  genderBtnActiveFemale: { backgroundColor: "#F06292", borderColor: "#F06292" },
  genderEmoji: { fontSize: 20 },
  genderText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },

  // Confirm
  warnIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    alignItems: "center", justifyContent: "center",
  },
  confirmSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.60)", textAlign: "center", lineHeight: 20 },
});
