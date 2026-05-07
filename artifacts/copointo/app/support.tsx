import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { apiPost } from "@/constants/api";
import { useApp } from "@/context/AppContext";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";
const WHATSAPP = "#25D366";

const SUPPORT_PHONE = "76611997"; // Oman support number

export default function SupportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useApp();

  // Report-problem modal
  const [open, setOpen] = useState(false);
  const [name, setName]               = useState("");
  const [phone, setPhone]             = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending]         = useState(false);

  const openReport = () => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setDescription("");
    setOpen(true);
  };

  const submit = async () => {
    const n = name.trim();
    const p = phone.trim();
    const d = description.trim();
    if (!n || !p || !d) {
      Alert.alert("بيانات ناقصة", "الرجاء تعبئة الاسم ورقم الهاتف ووصف المشكلة.");
      return;
    }
    setSending(true);
    try {
      await apiPost("/reports", {
        kind: "problem",
        name: n, phone: p, description: d,
        reporterUserId: user?.id,
      });
      setOpen(false);
      Alert.alert("تم الإرسال", "تم استلام بلاغك وسيتم مراجعته قريباً. شكراً لك.");
    } catch {
      Alert.alert("تعذر الإرسال", "حدث خطأ أثناء إرسال البلاغ. حاول لاحقاً.");
    } finally {
      setSending(false);
    }
  };

  const openWhatsApp = async () => {
    // International format: drop leading 0, prepend Oman country code 968
    const intl = "968" + SUPPORT_PHONE.replace(/^\+?968/, "").replace(/^0+/, "");
    const url  = `https://wa.me/${intl}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("تعذر فتح واتساب", `الرجاء التواصل على الرقم: ${SUPPORT_PHONE}`);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الدعم</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name="headphones" size={28} color={PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>كيف يمكننا مساعدتك؟</Text>
          <Text style={styles.heroSub}>
            تواصل معنا عبر واتساب أو أرسل بلاغاً عن مشكلة وسنقوم بمراجعته في أقرب وقت
          </Text>
        </View>

        {/* WhatsApp card — direct contact */}
        <TouchableOpacity style={styles.waCard} activeOpacity={0.9} onPress={openWhatsApp}>
          <View style={styles.waIconWrap}>
            <Feather name="message-circle" size={22} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.waTitle}>التواصل عبر واتساب</Text>
            <Text style={styles.waPhone} numberOfLines={1}>
              <Text style={{ fontFamily: "Inter_700Bold" }}>{SUPPORT_PHONE}</Text>
            </Text>
            <Text style={styles.waSub}>تواصل مباشر مع فريق كوبوينتو</Text>
          </View>
          <Feather name="external-link" size={18} color="rgba(255,255,255,0.55)" />
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>أو</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Report problem button (above logout style — appears prominent here) */}
        <TouchableOpacity style={styles.reportBtn} activeOpacity={0.85} onPress={openReport}>
          <Feather name="alert-triangle" size={18} color={DANGER} />
          <Text style={styles.reportBtnText}>إبلاغ عن مشكلة</Text>
        </TouchableOpacity>
        <Text style={styles.reportHint}>
          أرسل وصفاً مفصّلاً للمشكلة وسيتم تحويله إلى الإدارة فوراً
        </Text>
      </ScrollView>

      {/* Report modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Feather name="alert-triangle" size={20} color={DANGER} />
              </View>
              <Text style={styles.modalTitle}>إبلاغ عن مشكلة</Text>
              <Text style={styles.modalSub}>أخبرنا ماذا حدث وسنتواصل معك</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>الاسم</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="اسمك الكامل"
                placeholderTextColor="rgba(255,255,255,0.30)"
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>رقم الهاتف</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="9XXXXXXX"
                placeholderTextColor="rgba(255,255,255,0.30)"
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>وصف المشكلة</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح ما الذي حصل بالضبط…"
                placeholderTextColor="rgba(255,255,255,0.30)"
                multiline
                textAlignVertical="top"
                textAlign="right"
                maxLength={2000}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, sending && { opacity: 0.6 }]}
              activeOpacity={0.85}
              disabled={sending}
              onPress={submit}
            >
              {sending
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.submitText}>إرسال البلاغ</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  scrollContent: { padding: 20, gap: 18, paddingBottom: 60 },

  // Hero
  hero: { alignItems: "center", gap: 8, marginTop: 6, marginBottom: 4 },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${PRIMARY}15`, borderWidth: 2, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  heroTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  heroSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.60)", textAlign: "center",
    paddingHorizontal: 12, lineHeight: 20,
  },

  // WhatsApp card
  waCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: `${WHATSAPP}12`,
    borderWidth: 1, borderColor: `${WHATSAPP}55`,
    padding: 16, borderRadius: 18,
  },
  waIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: WHATSAPP,
    alignItems: "center", justifyContent: "center",
  },
  waTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  waPhone: { fontSize: 17, fontFamily: "Inter_700Bold", color: WHATSAPP, marginBottom: 2 },
  waSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)" },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.45)" },

  // Report button
  reportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    paddingVertical: 16, borderRadius: 16,
  },
  reportBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: DANGER },
  reportHint: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: -8,
  },

  // Modal
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalCard: {
    width: "100%", maxWidth: 440, backgroundColor: "#0F0606",
    borderRadius: 24, padding: 22, gap: 14,
    borderWidth: 1, borderColor: BORDER, position: "relative",
  },
  closeBtn: {
    position: "absolute", top: 10, left: 10, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  modalHeader: { alignItems: "center", gap: 6, marginBottom: 4 },
  modalIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    alignItems: "center", justifyContent: "center",
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  modalSub:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)" },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_500Medium", color: "#FFF",
  },
  textarea: { minHeight: 110, paddingTop: 12 },
  submitBtn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 4,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

  // (kept for older usages elsewhere, harmless)
  card: { backgroundColor: CARD },
});
