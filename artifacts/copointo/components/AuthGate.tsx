import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { AuthModal } from "@/components/AuthModal";

const BG      = "#000000";
const PRIMARY = "#E8B86D";

/**
 * Global authentication gate. Wraps the entire app inside `_layout.tsx` so
 * EVERY entry point — including QR-code deep-links to `/cafe/[id]` — first
 * requires the user to log in or register. Once `user` becomes non-null the
 * gate renders its children normally; expo-router preserves the original URL
 * so the user lands on their intended destination immediately after login.
 *
 * The guard waits on `hydrated` to avoid flashing the login screen for
 * already-signed-in users while AsyncStorage is still loading.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, hydrated } = useApp();
  const { t } = useT();

  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.splash}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Image
              source={require("../assets/images/copointo-logo.png")}
              style={{ width: 76, height: 76, resizeMode: "contain" }}
            />
          </View>
          <Text style={styles.brandName}>{t("auth.brandName")}</Text>
          <Text style={styles.brandSub}>{t("auth.brandSub")}</Text>
          <View style={styles.lockHint}>
            <Feather name="lock" size={14} color={PRIMARY} />
            <Text style={styles.lockHintText}>{t("auth.lockHint")}</Text>
          </View>
        </View>
        {/* Always-on, non-dismissible auth modal so the gate cannot be
            bypassed (no close button, back-press is a no-op). */}
        <AuthModal visible={true} onClose={() => {}} dismissible={false} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, backgroundColor: BG,
    alignItems: "center", justifyContent: "center",
    padding: 24,
  },
  brand: { alignItems: "center", gap: 8 },
  logo: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: `${PRIMARY}25`,
    borderWidth: 1.5, borderColor: `${PRIMARY}55`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  brandName: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#FFF" },
  brandSub:  {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", textAlign: "center",
  },
  lockHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 14, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, backgroundColor: `${PRIMARY}18`,
    borderWidth: 1, borderColor: `${PRIMARY}50`,
  },
  lockHintText: {
    fontSize: 12, fontFamily: "Inter_600SemiBold", color: PRIMARY,
  },
});
