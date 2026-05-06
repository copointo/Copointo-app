import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
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
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";

const BORDER  = "rgba(232,184,109,0.35)";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";

/**
 * Shared login / register modal. Originally lived inside profile.tsx — now
 * extracted so the global AuthGate can show the same UI for any unauthenticated
 * entry into the app (including QR-code deep links to /cafe/[id]).
 *
 * `dismissible=false` hides the close button so the gate cannot be bypassed.
 */
export function AuthModal({
  visible, onClose, dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const { register, login } = useApp();
  const { t } = useT();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const [logPhone, setLogPhone] = useState("");
  const [logPass,  setLogPass]  = useState("");

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
    if (status !== "granted") { setErr(t("auth.errPhotoPerm")); return; }
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
    if (!logPhone.trim() || !logPass.trim()) { setErr(t("auth.errFillAll")); return; }
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
      setErr(t("auth.errFillAll")); return;
    }
    if (!regGender) { setErr(t("auth.errPickGender")); return; }
    if (pass.length < 6) { setErr(t("auth.errPasswordShort")); return; }
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismissible ? close : () => {}}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={[styles.authCard, { maxHeight: "94%" }]}>
          {dismissible && (
            <TouchableOpacity onPress={close} style={styles.closeBtn} activeOpacity={0.7}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}

          <View style={styles.authBrand}>
            <View style={styles.authLogo}>
              <Image
                source={require("../assets/images/copointo-logo.png")}
                style={{ width: 56, height: 56, resizeMode: "contain" }}
              />
            </View>
            <Text style={styles.authBrandName}>{t("auth.brandName")}</Text>
            <Text style={styles.authBrandSub}>
              {mode === "login" ? t("auth.welcomeBack") : t("auth.startJourney")}
            </Text>
          </View>

          <View style={styles.authTabs}>
            <TouchableOpacity
              onPress={() => { setMode("login"); setErr(""); }}
              style={[styles.authTab, mode === "login" && styles.authTabActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.authTabText, mode === "login" && styles.authTabTextActive]}>
                {t("auth.tabLogin")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setMode("register"); setErr(""); }}
              style={[styles.authTab, mode === "register" && styles.authTabActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.authTabText, mode === "register" && styles.authTabTextActive]}>
                {t("auth.tabRegister")}
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
                <AuthField icon="phone" placeholder={t("auth.fieldPhone")} value={logPhone} onChange={setLogPhone} keyboardType="phone-pad" />
                <AuthField icon="lock" placeholder={t("auth.fieldPassword")} value={logPass} onChange={setLogPass} secure />
              </>
            ) : (
              <>
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
                    {regAvatar ? t("auth.changeAvatar") : t("auth.addAvatar")}
                  </Text>
                </View>

                <AuthField icon="user" placeholder={t("auth.fieldName")} value={name} onChange={setName} />
                <AuthField icon="phone" placeholder={t("auth.fieldPhone")} value={phone} onChange={setPhone} keyboardType="phone-pad" />

                <View>
                  <Text style={styles.fieldLabel}>{t("auth.fieldGenderLabel")}</Text>
                  <View style={styles.genderRow}>
                    <TouchableOpacity
                      onPress={() => { setRegGender("male"); Haptics.selectionAsync(); }}
                      style={[styles.genderBtn, regGender === "male" && styles.genderBtnActiveMale]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.genderEmoji}>🧑</Text>
                      <Text style={[styles.genderText, regGender === "male" && { color: "#FFF" }]}>{t("auth.genderMale")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setRegGender("female"); Haptics.selectionAsync(); }}
                      style={[styles.genderBtn, regGender === "female" && styles.genderBtnActiveFemale]}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.genderEmoji}>👩</Text>
                      <Text style={[styles.genderText, regGender === "female" && { color: "#FFF" }]}>{t("auth.genderFemale")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <AuthField icon="award" placeholder={t("auth.fieldGameUser")} value={gameUser} onChange={setGameUser} />
                <AuthField icon="lock" placeholder={t("auth.fieldPasswordMin")} value={pass} onChange={setPass} secure />
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
                {busy ? t("auth.busy") : mode === "login" ? t("auth.btnLogin") : t("auth.btnRegister")}
              </Text>
              {!busy && <Feather name="arrow-left" size={18} color="#FFF" />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
              style={{ paddingVertical: 8, alignItems: "center" }}
            >
              <Text style={styles.authSwitchText}>
                {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}
                <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>
                  {mode === "login" ? t("auth.signupNow") : t("auth.loginNow")}
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

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
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
  eyeBtn: { padding: 8 },
  errorText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: DANGER, textAlign: "center",
    backgroundColor: `${DANGER}15`, padding: 10, borderRadius: 10,
  },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },

  authCard: {
    width: "100%", backgroundColor: "#0F0606",
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
    borderWidth: 2, borderColor: "#0F0606",
  },
  regAvatarHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", marginTop: 6 },

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
});
