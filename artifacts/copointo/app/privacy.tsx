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
import { useT } from "@/context/LanguageContext";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";

interface SectionDef {
  icon: keyof typeof Feather.glyphMap;
  titleKey: string;
  bodyKey?: string;
  bulletKeys?: string[];
  extraTitleKey?: string;
  extraBulletKeys?: string[];
}

const SECTIONS: SectionDef[] = [
  {
    icon: "lock",
    titleKey: "privacy.s1.title",
    bulletKeys: ["privacy.s1.b1", "privacy.s1.b2", "privacy.s1.b3", "privacy.s1.b4"],
  },
  {
    icon: "video",
    titleKey: "privacy.s2.title",
    bodyKey: "privacy.s2.body",
    bulletKeys: ["privacy.s2.b1", "privacy.s2.b2", "privacy.s2.b3", "privacy.s2.b4"],
    extraTitleKey: "privacy.s2.extraTitle",
    extraBulletKeys: ["privacy.s2.e1", "privacy.s2.e2", "privacy.s2.e3"],
  },
  {
    icon: "flag",
    titleKey: "privacy.s3.title",
    bodyKey: "privacy.s3.body",
    bulletKeys: ["privacy.s3.b1", "privacy.s3.b2", "privacy.s3.b3", "privacy.s3.b4"],
    extraBulletKeys: ["privacy.s3.e1"],
  },
  { icon: "star",          titleKey: "privacy.s4.title", bodyKey: "privacy.s4.body" },
  { icon: "map-pin",       titleKey: "privacy.s5.title", bodyKey: "privacy.s5.body" },
  { icon: "play",          titleKey: "privacy.s6.title", bodyKey: "privacy.s6.body" },
  {
    icon: "alert-octagon",
    titleKey: "privacy.s7.title",
    bodyKey: "privacy.s7.body",
    bulletKeys: ["privacy.s7.b1", "privacy.s7.b2", "privacy.s7.b3", "privacy.s7.b4"],
    extraBulletKeys: ["privacy.s7.e1"],
  },
  { icon: "shield",        titleKey: "privacy.s8.title", bodyKey: "privacy.s8.body" },
  { icon: "refresh-cw",    titleKey: "privacy.s9.title", bodyKey: "privacy.s9.body" },
];

const SUPPORT_PHONE = "76611997";
const SUPPORT_EMAIL = "copointo@gmail.com";

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { t } = useT();

  const openWhatsApp = () => {
    const intl = "968" + SUPPORT_PHONE.replace(/^\+?968/, "").replace(/^0+/, "");
    Linking.openURL(`https://wa.me/${intl}`).catch(() => {});
  };
  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("privacy.headerTitle")}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Feather name="shield" size={28} color={PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>{t("privacy.heroTitle")}</Text>
          <Text style={styles.heroSub}>{t("privacy.heroSub")}</Text>
        </View>

        {SECTIONS.map((s, i) => (
          <View key={i} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconWrap}>
                <Feather name={s.icon} size={16} color={PRIMARY} />
              </View>
              <Text style={styles.sectionTitle}>{t(s.titleKey)}</Text>
            </View>

            {s.bodyKey && <Text style={styles.bodyText}>{t(s.bodyKey)}</Text>}

            {s.bulletKeys && s.bulletKeys.length > 0 && (
              <View style={styles.bulletList}>
                {s.bulletKeys.map((k, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{t(k)}</Text>
                  </View>
                ))}
              </View>
            )}

            {s.extraTitleKey && <Text style={[styles.bodyText, { marginTop: 6 }]}>{t(s.extraTitleKey)}</Text>}
            {s.extraBulletKeys && s.extraBulletKeys.length > 0 && (
              <View style={styles.bulletList}>
                {s.extraBulletKeys.map((k, j) => (
                  <View key={j} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{t(k)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>{t("privacy.contactTitle")}</Text>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.85} onPress={openWhatsApp}>
            <View style={[styles.contactIconWrap, { backgroundColor: "#25D36622", borderColor: "#25D36655" }]}>
              <Feather name="message-circle" size={16} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>{t("privacy.contactWhatsapp")}</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{SUPPORT_PHONE}</Text>
            </View>
            <Feather name="external-link" size={16} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactRow} activeOpacity={0.85} onPress={openEmail}>
            <View style={[styles.contactIconWrap, { backgroundColor: `${PRIMARY}22`, borderColor: `${PRIMARY}55` }]}>
              <Feather name="mail" size={16} color={PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>{t("privacy.contactEmail")}</Text>
              <Text style={styles.contactValue} numberOfLines={1}>{SUPPORT_EMAIL}</Text>
            </View>
            <Feather name="external-link" size={16} color="rgba(255,255,255,0.45)" />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>{t("privacy.footer")}</Text>
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
