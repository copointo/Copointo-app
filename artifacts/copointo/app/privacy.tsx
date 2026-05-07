import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";

interface Section {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
  bullets?: string[];
  extraTitle?: string;
  extraBullets?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: "lock",
    title: "خصوصية الرسائل",
    bullets: [
      "الرسائل الخاصة بين المستخدمين تعتبر خاصة وسرية.",
      "لا تقوم إدارة Copointo بقراءة الرسائل أو التجسس عليها.",
      "يتم استخدام أنظمة حماية للمساعدة في الحفاظ على أمان المحادثات.",
      "قد يتم مراجعة الرسائل فقط في حال وجود بلاغ رسمي أو مخالفة واضحة تهدد أمان المستخدمين أو تخالف القوانين.",
    ],
  },
  {
    icon: "video",
    title: "المحتوى والريلز",
    body: "يستطيع المستخدمون نشر الريلز والمحتوى داخل المنصة، ويُمنع نشر:",
    bullets: [
      "المحتوى المسيء أو غير الأخلاقي",
      "خطاب الكراهية أو التنمر",
      "المحتوى المخالف للقوانين",
      "المحتوى الذي ينتهك حقوق الآخرين",
    ],
    extraTitle: "ويحق لإدارة Copointo:",
    extraBullets: [
      "حذف الريلز المخالفة",
      "تقييد الوصول للمحتوى",
      "حظر الحسابات المخالفة مؤقتًا أو دائمًا",
    ],
  },
  {
    icon: "flag",
    title: "نظام البلاغات",
    body: "يوفر Copointo زر \"إبلاغ\" للإبلاغ عن:",
    bullets: [
      "المحتوى المسيء",
      "الحسابات الوهمية",
      "التحرش أو الإزعاج",
      "السبام أو الاحتيال",
    ],
    extraBullets: ["وسيتم مراجعة البلاغات واتخاذ الإجراء المناسب بأسرع وقت ممكن."],
  },
  {
    icon: "star",
    title: "التقييمات والتعليقات",
    body: "يمكن للمستخدمين إضافة تقييمات وتعليقات للكوفيهات والخدمات، ويجب أن تكون التقييمات حقيقية ومحترمة وغير مضللة.",
  },
  {
    icon: "map-pin",
    title: "خرائط Google والموقع",
    body: "قد يستخدم Copointo خدمات خرائط Google لعرض الكوفيهات والمواقع القريبة وتحسين تجربة المستخدم.",
  },
  {
    icon: "play",
    title: "لعبة Copointo",
    body: "قد تتضمن المنصة لعبة أو أنشطة ترفيهية داخل التطبيق، ويتم استخدامها وفق قوانين المنصة وسياسة الاستخدام.",
  },
  {
    icon: "alert-octagon",
    title: "العقوبات والحظر",
    body: "يحق لإدارة Copointo اتخاذ الإجراءات التالية عند مخالفة القوانين:",
    bullets: [
      "حذف المحتوى",
      "تقييد الحساب",
      "الحظر المؤقت",
      "الحظر الدائم",
    ],
    extraBullets: ["وذلك للحفاظ على بيئة آمنة ومحترمة لجميع المستخدمين."],
  },
  {
    icon: "shield",
    title: "حماية البيانات",
    body: "نستخدم تقنيات وإجراءات أمنية للمساعدة في حماية بيانات المستخدمين ومنع الوصول غير المصرح به.",
  },
  {
    icon: "refresh-cw",
    title: "التعديلات",
    body: "قد يتم تحديث سياسة الخصوصية من وقت لآخر، واستمرار استخدام Copointo يعني الموافقة على أي تحديثات مستقبلية.",
  },
];

const SUPPORT_PHONE = "76611997";
const SUPPORT_EMAIL = "copointo@gmail.com";

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const openWhatsApp = () => {
    const intl = "968" + SUPPORT_PHONE.replace(/^\+?968/, "").replace(/^0+/, "");
    Linking.openURL(`https://wa.me/${intl}`).catch(() => {});
  };
  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الخصوصية والحوكمة</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name="shield" size={28} color={PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>سياسة الخصوصية والحوكمة</Text>
          <Text style={styles.heroSub}>
            في Copointo نحترم خصوصية جميع المستخدمين ونلتزم بحماية البيانات والمحتوى داخل المنصة.
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Feather name={s.icon} size={16} color={PRIMARY} />
              </View>
              <Text style={styles.sectionTitle}>{s.title}</Text>
            </View>

            {s.body && <Text style={styles.bodyText}>{s.body}</Text>}

            {s.bullets && s.bullets.length > 0 && (
              <View style={styles.bulletList}>
                {s.bullets.map((b, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}

            {s.extraTitle && <Text style={[styles.bodyText, { marginTop: 6 }]}>{s.extraTitle}</Text>}
            {s.extraBullets && s.extraBullets.length > 0 && (
              <View style={styles.bulletList}>
                {s.extraBullets.map((b, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Contact card */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>للتواصل والدعم</Text>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.85} onPress={openWhatsApp}>
            <View style={[styles.contactIconWrap, { backgroundColor: "#25D36622", borderColor: "#25D36655" }]}>
              <Feather name="message-circle" size={16} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>واتساب</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{SUPPORT_PHONE}</Text>
            </View>
            <Feather name="external-link" size={16} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.85} onPress={openEmail}>
            <View style={[styles.contactIconWrap, { backgroundColor: `${PRIMARY}22`, borderColor: `${PRIMARY}55` }]}>
              <Feather name="mail" size={16} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>الإيميل</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{SUPPORT_EMAIL}</Text>
            </View>
            <Feather name="external-link" size={16} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© Copointo — جميع الحقوق محفوظة</Text>
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

  scrollContent: { padding: 20, gap: 14, paddingBottom: 60 },

  hero: { alignItems: "center", gap: 8, marginTop: 4, marginBottom: 6 },
  heroIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${PRIMARY}15`, borderWidth: 2, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  heroTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  heroSub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    paddingHorizontal: 8, lineHeight: 21,
  },

  section: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 8,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${PRIMARY}15`, borderWidth: 1, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", flex: 1, textAlign: "right" },
  bodyText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.78)", lineHeight: 22, textAlign: "right",
  },
  bulletList: { gap: 6, marginTop: 2 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: PRIMARY, marginTop: 9,
  },
  bulletText: {
    flex: 1, fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)", lineHeight: 22, textAlign: "right",
  },

  contactCard: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 10, marginTop: 6,
  },
  contactTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, textAlign: "right" },
  contactRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    padding: 12,
  },
  contactIconWrap: {
    width: 36, height: 36, borderRadius: 12,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  contactLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  contactValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },

  footer: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 10,
  },
});
