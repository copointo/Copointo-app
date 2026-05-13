import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
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
import { useApp, sendOtp, verifyOtp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";

// All phone numbers are treated as Omani (+968) by default. Strips any
// non-digit characters and any leading 0 (e.g. "076611997" → "76611997"),
// then prepends "+968".
const buildOmanPhone = (raw: string) => {
  const digits = raw.replace(/\D+/g, "").replace(/^0+/, "");
  if (!digits) return "";
  // If the user already typed the country code (e.g. "96876611997"),
  // don't double-prefix it.
  if (digits.startsWith("968")) return `+${digits}`;
  return `+968${digits}`;
};

const BORDER  = "rgba(232,184,109,0.35)";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";

const USERNAME_EN_RE     = /^[A-Za-z0-9_.-]+$/;
const ASCII_PRINTABLE_RE = /^[\x20-\x7E]+$/;

type Step =
  | "login"
  | "register-form"      // form + inline OTP field/button — single screen
  | "forgot-phone"       // enter phone for reset
  | "forgot-otp"         // confirm SMS code (reset)
  | "forgot-newpass";    // pick new password & sign in

export function AuthModal({
  visible, onClose, dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const { register, login, resetPasswordWithOtp, initialAuthStep, consumeInitialAuthStep } = useApp();
  const { t } = useT();
  const [step, setStep] = useState<Step>(initialAuthStep ?? "login");

  // If the AppContext flagged a forced initial step (e.g. right after a
  // permanent account-deletion the user should land on the "register" tab,
  // not the default "login" tab), honour it once and then clear the flag so
  // it doesn't override later auth-flow navigation.
  useEffect(() => {
    if (initialAuthStep) {
      setStep(initialAuthStep);
      consumeInitialAuthStep();
    }
  }, [initialAuthStep, consumeInitialAuthStep]);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  // Login
  const [logPhone, setLogPhone] = useState("");
  const [logPass,  setLogPass]  = useState("");

  // Register
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regGender, setRegGender] = useState<"male" | "female" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gameUser, setGameUser] = useState("");
  const [pass, setPass] = useState("");

  // OTP (shared by inline-register + forgot-otp)
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState("");        // set after verify
  const [resendIn, setResendIn] = useState(0);          // seconds until resend allowed
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // True once an OTP has been sent for the current register-form session,
  // so the code input + verify button stay visible afterwards.
  const [regOtpSent, setRegOtpSent] = useState(false);
  // Phone the OTP was actually sent to. If the user edits `phone` after
  // sending we invalidate the code so they can't accidentally verify a
  // mismatched number.
  const [regOtpPhone, setRegOtpPhone] = useState("");

  // Forgot
  const [resetPhone, setResetPhone] = useState("");
  const [newPass, setNewPass]       = useState("");

  const startResendTimer = (sec: number) => {
    setResendIn(sec);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendIn(prev => {
        if (prev <= 1) {
          if (resendTimerRef.current) clearInterval(resendTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => {
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  }, []);

  const reset = () => {
    setLogPhone(""); setLogPass("");
    setRegAvatar(null); setRegGender(null);
    setName(""); setPhone(""); setGameUser(""); setPass("");
    setOtpCode(""); setOtpToken(""); setResendIn(0);
    setRegOtpSent(false); setRegOtpPhone("");
    setResetPhone(""); setNewPass("");
    setErr(""); setBusy(false);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
  };

  const close = () => { reset(); setStep("login"); onClose(); };

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
    if (!ASCII_PRINTABLE_RE.test(logPass)) { setErr(t("auth.errPasswordEn")); return; }
    setBusy(true);
    const r = await login(logPhone.trim(), logPass);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  // Send OTP to the typed phone number. Just needs a plausible phone — the
  // rest of the form can still be empty when the user requests the code.
  const sendRegisterOtp = async () => {
    setErr("");
    if (!phone.trim()) { setErr("الرجاء إدخال رقم الهاتف أولاً"); return; }
    const p = buildOmanPhone(phone);
    if (p.replace(/\D+/g, "").length < 7) { setErr("رقم الهاتف غير صحيح"); return; }
    setBusy(true);
    const sent = await sendOtp(p, "register");
    setBusy(false);
    if (!sent.ok) {
      setErr(sent.error);
      if (sent.retryAfterSec) startResendTimer(sent.retryAfterSec);
      return;
    }
    setOtpCode(""); setOtpToken("");
    setRegOtpSent(true);
    setRegOtpPhone(p);
    startResendTimer(45);
  };

  // Final register: validate everything, verify the OTP code, then create
  // the account — all in one tap from the same screen.
  const submitRegister = async () => {
    setErr("");
    if (!name.trim() || !phone.trim() || !gameUser.trim() || !pass) {
      setErr(t("auth.errFillAll")); return;
    }
    if (!regGender) { setErr(t("auth.errPickGender")); return; }
    const u = gameUser.trim();
    if (u.length < 3) { setErr(t("auth.errUsernameShort")); return; }
    if (!USERNAME_EN_RE.test(u)) { setErr(t("auth.errUsernameEn")); return; }
    if (pass.length < 6) { setErr(t("auth.errPasswordShort")); return; }
    if (!ASCII_PRINTABLE_RE.test(pass)) { setErr(t("auth.errPasswordEn")); return; }
    if (!regOtpSent) { setErr("اضغط (إرسال الرمز) أولاً، ثم أدخل الرمز المُرسل إلى هاتفك"); return; }
    const fullPhone = buildOmanPhone(phone);
    if (regOtpPhone !== fullPhone) {
      setErr("تم تغيير رقم الهاتف بعد إرسال الرمز — أعد إرسال الرمز");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) { setErr("الرجاء إدخال الرمز المكون من 6 أرقام"); return; }
    setBusy(true);
    const v = await verifyOtp(fullPhone, otpCode, "register");
    if (!v.ok) {
      setBusy(false);
      const left = typeof v.attemptsLeft === "number" ? ` (${v.attemptsLeft} محاولة متبقية)` : "";
      setErr(v.error + left);
      return;
    }
    const r = await register({
      name: name.trim(),
      phone: fullPhone,
      gameUsername: gameUser.trim(),
      password: pass,
      gender: regGender!,
      avatar: regAvatar ?? undefined,
    }, v.token);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  // Forgot-password step 1: send OTP to the phone the user typed.
  const submitForgotPhone = async () => {
    setErr("");
    if (!resetPhone.trim()) { setErr(t("auth.errFillAll")); return; }
    const p = buildOmanPhone(resetPhone);
    if (p.replace(/\D+/g, "").length < 7) { setErr("رقم الهاتف غير صحيح"); return; }
    setBusy(true);
    const sent = await sendOtp(p, "reset");
    setBusy(false);
    if (!sent.ok) {
      setErr(sent.error);
      if (sent.retryAfterSec) startResendTimer(sent.retryAfterSec);
      return;
    }
    setOtpCode(""); setOtpToken("");
    startResendTimer(45);
    setStep("forgot-otp");
  };

  // Forgot-password step 2: verify OTP, hold the token, advance to new-pass step.
  const submitForgotOtp = async () => {
    setErr("");
    if (!/^\d{6}$/.test(otpCode)) { setErr("الرجاء إدخال الرمز المكون من 6 أرقام"); return; }
    setBusy(true);
    const v = await verifyOtp(buildOmanPhone(resetPhone), otpCode, "reset");
    setBusy(false);
    if (!v.ok) {
      const left = typeof v.attemptsLeft === "number" ? ` (${v.attemptsLeft} محاولة متبقية)` : "";
      setErr(v.error + left);
      return;
    }
    setOtpToken(v.token);
    setStep("forgot-newpass");
  };

  // Forgot-password step 3: commit the new password locally & sign in.
  const submitForgotNewPass = async () => {
    setErr("");
    if (newPass.length < 6) { setErr(t("auth.errPasswordShort")); return; }
    if (!ASCII_PRINTABLE_RE.test(newPass)) { setErr(t("auth.errPasswordEn")); return; }
    if (!otpToken) { setErr("انتهت صلاحية الجلسة — أعد المحاولة"); setStep("forgot-phone"); return; }
    setBusy(true);
    const r = await resetPasswordWithOtp(otpToken, newPass);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    close();
  };

  const resendOtp = async () => {
    if (resendIn > 0) return;
    const target = step === "register-form"
      ? buildOmanPhone(phone)
      : buildOmanPhone(resetPhone);
    const purpose = step === "register-form" ? "register" : "reset";
    setErr("");
    setBusy(true);
    const sent = await sendOtp(target, purpose);
    setBusy(false);
    if (!sent.ok) {
      setErr(sent.error);
      if (sent.retryAfterSec) startResendTimer(sent.retryAfterSec);
      return;
    }
    startResendTimer(45);
  };

  const fallbackEmoji = regGender === "female" ? "👩" : regGender === "male" ? "🧑" : "📷";

  // Header back button — appears for any step beyond the primary login/register tabs.
  const showBack = step !== "login" && step !== "register-form";
  const goBack = () => {
    setErr("");
    if (step === "forgot-phone") setStep("login");
    else if (step === "forgot-otp") setStep("forgot-phone");
    else if (step === "forgot-newpass") setStep("forgot-otp");
  };

  const isOtpStep = step === "forgot-otp";
  const otpTargetPhone = buildOmanPhone(resetPhone);

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
          {showBack && (
            <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
              <Feather name="arrow-right" size={20} color="rgba(255,255,255,0.7)" />
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
          </View>

          {(step === "login" || step === "register-form") && (
            <View style={styles.authTabs}>
              <TouchableOpacity
                onPress={() => { setStep("login"); setErr(""); }}
                style={[styles.authTab, step === "login" && styles.authTabActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.authTabText, step === "login" && styles.authTabTextActive]}>
                  {t("auth.tabLogin")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setStep("register-form"); setErr(""); }}
                style={[styles.authTab, step === "register-form" && styles.authTabActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.authTabText, step === "register-form" && styles.authTabTextActive]}>
                  {t("auth.tabRegister")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 4 }}
            keyboardShouldPersistTaps="handled"
          >
            {step === "login" && (
              <>
                <AuthField icon="user" placeholder={t("auth.fieldPhoneOrUser")} value={logPhone} onChange={setLogPhone} />
                <AuthField icon="lock" placeholder={t("auth.fieldPassword")} value={logPass} onChange={setLogPass} secure />
                <TouchableOpacity
                  onPress={() => { setStep("forgot-phone"); setErr(""); setResetPhone(""); }}
                  style={{ alignSelf: "flex-end", paddingVertical: 4 }}
                >
                  <Text style={{ color: PRIMARY, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                    نسيت كلمة المرور؟
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === "register-form" && (
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
                <AuthField
                  icon="phone"
                  placeholder={t("auth.fieldPhone")}
                  value={phone}
                  onChange={(v) => {
                    const cleaned = v.replace(/\D+/g, "");
                    setPhone(cleaned);
                    const newFull = buildOmanPhone(cleaned);
                    if (regOtpSent && newFull !== regOtpPhone) {
                      setRegOtpSent(false);
                      setOtpCode("");
                      setOtpToken("");
                      setResendIn(0);
                      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
                    }
                  }}
                  keyboardType="phone-pad"
                />

                {/* Inline OTP row — code input + send/resend button. The
                    code field stays disabled until the first send so it's
                    clear which order to use. */}
                <View style={styles.otpRow}>
                  <View style={{ flex: 1, opacity: regOtpSent ? 1 : 0.5 }}>
                    <AuthField
                      icon="hash"
                      placeholder="الرمز"
                      value={otpCode}
                      onChange={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={sendRegisterOtp}
                    disabled={busy || resendIn > 0}
                    activeOpacity={0.85}
                    style={[
                      styles.otpSendBtn,
                      (busy || resendIn > 0) && { opacity: 0.55 },
                    ]}
                  >
                    <Feather name="send" size={13} color="#FFF" />
                    <Text style={styles.otpSendText} numberOfLines={1}>
                      {resendIn > 0
                        ? `${resendIn}s`
                        : regOtpSent
                          ? "إعادة"
                          : "إرسال"}
                    </Text>
                  </TouchableOpacity>
                </View>
                {regOtpSent && regOtpPhone === phone.trim() && (
                  <Text style={styles.otpHintInline}>
                    تم إرسال الرمز إلى{" "}
                    <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>{regOtpPhone}</Text>
                  </Text>
                )}

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

            {isOtpStep && (
              <>
                <Text style={styles.otpHelpText}>
                  أرسلنا رمزاً مكوناً من 6 أرقام إلى{"\n"}
                  <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>{otpTargetPhone}</Text>
                </Text>
                <AuthField
                  icon="hash"
                  placeholder="رمز التحقق (6 أرقام)"
                  value={otpCode}
                  onChange={(v) => setOtpCode(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  onPress={resendOtp}
                  disabled={resendIn > 0 || busy}
                  style={{ alignSelf: "center", paddingVertical: 6 }}
                >
                  <Text style={{
                    color: resendIn > 0 ? "rgba(255,255,255,0.4)" : PRIMARY,
                    fontSize: 13, fontFamily: "Inter_600SemiBold",
                  }}>
                    {resendIn > 0 ? `إعادة الإرسال خلال ${resendIn} ثانية` : "إعادة إرسال الرمز"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === "forgot-phone" && (
              <>
                <Text style={styles.otpHelpText}>
                  أدخل رقم هاتفك المسجّل وسنرسل لك رمز تحقق لإعادة تعيين كلمة المرور.
                </Text>
                <AuthField
                  icon="phone"
                  placeholder={t("auth.fieldPhone")}
                  value={resetPhone}
                  onChange={(v) => setResetPhone(v.replace(/\D+/g, ""))}
                  keyboardType="phone-pad"
                />
              </>
            )}

            {step === "forgot-newpass" && (
              <>
                <Text style={styles.otpHelpText}>اختر كلمة مرور جديدة لحسابك.</Text>
                <AuthField icon="lock" placeholder={t("auth.fieldPasswordMin")} value={newPass} onChange={setNewPass} secure />
              </>
            )}

            {err ? <Text style={styles.errorText}>{err}</Text> : null}

            <TouchableOpacity
              onPress={
                step === "login"           ? submitLogin
              : step === "register-form"   ? submitRegister
              : step === "forgot-phone"    ? submitForgotPhone
              : step === "forgot-otp"      ? submitForgotOtp
              :                              submitForgotNewPass
              }
              style={[styles.authPrimaryBtn, busy && { opacity: 0.6 }]}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Text style={styles.authPrimaryText}>
                {busy ? t("auth.busy")
                  : step === "login"         ? t("auth.btnLogin")
                  : step === "register-form" ? t("auth.btnRegister")
                  : step === "forgot-phone"  ? "إرسال رمز التحقق"
                  : step === "forgot-otp"    ? "تحقق من الرمز"
                  :                            "حفظ كلمة المرور الجديدة"}
              </Text>
              {!busy && <Feather name="arrow-left" size={18} color="#FFF" />}
            </TouchableOpacity>

            {(step === "login" || step === "register-form") && (
              <TouchableOpacity
                onPress={() => {
                  setStep(step === "login" ? "register-form" : "login");
                  setErr("");
                }}
                style={{ paddingVertical: 8, alignItems: "center" }}
              >
                <Text style={styles.authSwitchText}>
                  {step === "login" ? t("auth.noAccount") : t("auth.haveAccount")}
                  <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>
                    {step === "login" ? t("auth.signupNow") : t("auth.loginNow")}
                  </Text>
                </Text>
              </TouchableOpacity>
            )}
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
        style={[styles.input, { paddingHorizontal: 10, textAlign: "right", writingDirection: "rtl" }]}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure && !show}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.30)"
        selectionColor={PRIMARY}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
        numberOfLines={1}
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
  backBtn: {
    position: "absolute", top: 12, right: 12, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap:  {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, overflow: "hidden",
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
  otpHelpText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)", textAlign: "center",
    lineHeight: 20, marginVertical: 4,
  },
  otpRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  otpSendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 10, minWidth: 78,
    shadowColor: PRIMARY, shadowOpacity: 0.35,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  otpSendText: { color: "#FFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  otpHintInline: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)", textAlign: "right",
    marginTop: -4,
  },

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
