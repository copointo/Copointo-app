import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

export default function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أغراضي</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="package" size={42} color={PRIMARY} />
        </View>
        <Text style={styles.title}>أغراضي</Text>
        <Text style={styles.sub}>قريباً — هنا ستظهر كل العناصر التي اشتريتها أو ربحتها داخل اللعبة.</Text>
      </View>
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
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: `${PRIMARY}15`, borderWidth: 2, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  sub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 20,
    paddingHorizontal: 16,
  },
});
