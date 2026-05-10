import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useApp } from "@/context/AppContext";

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";

/**
 * Full-screen "you have been banned" gate. Mounted by `AuthGate` whenever
 * the server reports the current user is banned. The user cannot navigate
 * anywhere else in the app — the only allowed action is logging out so they
 * can sign in with a different account.
 */
export function BannedScreen({ reason }: { reason: string }) {
  const { logout } = useApp();
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/copointo-logo.png")}
            style={{ width: 64, height: 64, resizeMode: "contain" }}
          />
        </View>

        <View style={styles.iconWrap}>
          <Feather name="slash" size={56} color={DANGER} />
        </View>

        <Text style={styles.title}>تم حظرك من الموقع</Text>
        <Text style={styles.subtitle}>
          لا يمكنك استخدام كوبوينتو بهذا الحساب، ولن تتمكّن من إعادة التسجيل بنفس رقم الهاتف أو يوزر اللعبة.
        </Text>

        <View style={styles.reasonCard}>
          <View style={styles.reasonHeader}>
            <Feather name="alert-triangle" size={16} color={DANGER} />
            <Text style={styles.reasonLabel}>سبب الحظر</Text>
          </View>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>

        <View style={styles.helpCard}>
          <Feather name="info" size={14} color={PRIMARY} />
          <Text style={styles.helpText}>
            إذا كنت تعتقد أن الحظر بالخطأ، يمكنك التواصل مع إدارة كوبوينتو. يمكنك أيضاً تسجيل الخروج واستخدام حساب آخر برقم هاتف ويوزر مختلفين.
          </Text>
        </View>

        <TouchableOpacity
          onPress={logout}
          style={styles.logoutBtn}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={18} color="#FFF" />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1, alignItems: "center", justifyContent: "center",
    padding: 24, gap: 18,
  },
  logoWrap: {
    width: 84, height: 84, borderRadius: 24,
    backgroundColor: `${PRIMARY}25`,
    borderWidth: 1.5, borderColor: `${PRIMARY}55`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  iconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${DANGER}18`,
    borderWidth: 2, borderColor: `${DANGER}55`,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)", textAlign: "center",
    paddingHorizontal: 8, lineHeight: 22,
  },
  reasonCard: {
    width: "100%", maxWidth: 420,
    backgroundColor: `${DANGER}10`,
    borderWidth: 1, borderColor: `${DANGER}45`,
    borderRadius: 16, padding: 16, gap: 8,
  },
  reasonHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  reasonLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: DANGER,
  },
  reasonText: {
    fontSize: 15, fontFamily: "Inter_500Medium", color: "#FFF",
    lineHeight: 24, textAlign: "right",
  },
  helpCard: {
    width: "100%", maxWidth: 420,
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: `${PRIMARY}12`,
    borderWidth: 1, borderColor: `${PRIMARY}35`,
    borderRadius: 14, padding: 14,
  },
  helpText: {
    flex: 1, fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.70)", lineHeight: 20,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: DANGER, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
    marginTop: 6, minWidth: 220,
    shadowColor: DANGER, shadowOpacity: 0.45,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
});
