import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.35)";

export type Country = {
  iso: string;
  flag: string;
  dial: string;
  nameAr: string;
  nameEn: string;
};

export const COUNTRIES: Country[] = [
  { iso: "OM", flag: "🇴🇲", dial: "+968", nameAr: "سلطنة عُمان", nameEn: "Oman" },
  { iso: "SA", flag: "🇸🇦", dial: "+966", nameAr: "السعودية", nameEn: "Saudi Arabia" },
  { iso: "AE", flag: "🇦🇪", dial: "+971", nameAr: "الإمارات", nameEn: "United Arab Emirates" },
  { iso: "KW", flag: "🇰🇼", dial: "+965", nameAr: "الكويت", nameEn: "Kuwait" },
  { iso: "QA", flag: "🇶🇦", dial: "+974", nameAr: "قطر", nameEn: "Qatar" },
  { iso: "BH", flag: "🇧🇭", dial: "+973", nameAr: "البحرين", nameEn: "Bahrain" },
  { iso: "YE", flag: "🇾🇪", dial: "+967", nameAr: "اليمن", nameEn: "Yemen" },
  { iso: "EG", flag: "🇪🇬", dial: "+20",  nameAr: "مصر", nameEn: "Egypt" },
  { iso: "JO", flag: "🇯🇴", dial: "+962", nameAr: "الأردن", nameEn: "Jordan" },
  { iso: "PS", flag: "🇵🇸", dial: "+970", nameAr: "فلسطين", nameEn: "Palestine" },
  { iso: "LB", flag: "🇱🇧", dial: "+961", nameAr: "لبنان", nameEn: "Lebanon" },
  { iso: "SY", flag: "🇸🇾", dial: "+963", nameAr: "سوريا", nameEn: "Syria" },
  { iso: "IQ", flag: "🇮🇶", dial: "+964", nameAr: "العراق", nameEn: "Iraq" },
  { iso: "SD", flag: "🇸🇩", dial: "+249", nameAr: "السودان", nameEn: "Sudan" },
  { iso: "LY", flag: "🇱🇾", dial: "+218", nameAr: "ليبيا", nameEn: "Libya" },
  { iso: "TN", flag: "🇹🇳", dial: "+216", nameAr: "تونس", nameEn: "Tunisia" },
  { iso: "DZ", flag: "🇩🇿", dial: "+213", nameAr: "الجزائر", nameEn: "Algeria" },
  { iso: "MA", flag: "🇲🇦", dial: "+212", nameAr: "المغرب", nameEn: "Morocco" },
  { iso: "MR", flag: "🇲🇷", dial: "+222", nameAr: "موريتانيا", nameEn: "Mauritania" },
  { iso: "SO", flag: "🇸🇴", dial: "+252", nameAr: "الصومال", nameEn: "Somalia" },
  { iso: "DJ", flag: "🇩🇯", dial: "+253", nameAr: "جيبوتي", nameEn: "Djibouti" },
  { iso: "KM", flag: "🇰🇲", dial: "+269", nameAr: "جزر القمر", nameEn: "Comoros" },
  { iso: "TR", flag: "🇹🇷", dial: "+90",  nameAr: "تركيا", nameEn: "Turkey" },
  { iso: "IR", flag: "🇮🇷", dial: "+98",  nameAr: "إيران", nameEn: "Iran" },
  { iso: "PK", flag: "🇵🇰", dial: "+92",  nameAr: "باكستان", nameEn: "Pakistan" },
  { iso: "IN", flag: "🇮🇳", dial: "+91",  nameAr: "الهند", nameEn: "India" },
  { iso: "BD", flag: "🇧🇩", dial: "+880", nameAr: "بنغلاديش", nameEn: "Bangladesh" },
  { iso: "ID", flag: "🇮🇩", dial: "+62",  nameAr: "إندونيسيا", nameEn: "Indonesia" },
  { iso: "MY", flag: "🇲🇾", dial: "+60",  nameAr: "ماليزيا", nameEn: "Malaysia" },
  { iso: "PH", flag: "🇵🇭", dial: "+63",  nameAr: "الفلبين", nameEn: "Philippines" },
  { iso: "TH", flag: "🇹🇭", dial: "+66",  nameAr: "تايلاند", nameEn: "Thailand" },
  { iso: "CN", flag: "🇨🇳", dial: "+86",  nameAr: "الصين", nameEn: "China" },
  { iso: "JP", flag: "🇯🇵", dial: "+81",  nameAr: "اليابان", nameEn: "Japan" },
  { iso: "KR", flag: "🇰🇷", dial: "+82",  nameAr: "كوريا الجنوبية", nameEn: "South Korea" },
  { iso: "GB", flag: "🇬🇧", dial: "+44",  nameAr: "بريطانيا", nameEn: "United Kingdom" },
  { iso: "DE", flag: "🇩🇪", dial: "+49",  nameAr: "ألمانيا", nameEn: "Germany" },
  { iso: "FR", flag: "🇫🇷", dial: "+33",  nameAr: "فرنسا", nameEn: "France" },
  { iso: "IT", flag: "🇮🇹", dial: "+39",  nameAr: "إيطاليا", nameEn: "Italy" },
  { iso: "ES", flag: "🇪🇸", dial: "+34",  nameAr: "إسبانيا", nameEn: "Spain" },
  { iso: "NL", flag: "🇳🇱", dial: "+31",  nameAr: "هولندا", nameEn: "Netherlands" },
  { iso: "SE", flag: "🇸🇪", dial: "+46",  nameAr: "السويد", nameEn: "Sweden" },
  { iso: "NO", flag: "🇳🇴", dial: "+47",  nameAr: "النرويج", nameEn: "Norway" },
  { iso: "RU", flag: "🇷🇺", dial: "+7",   nameAr: "روسيا", nameEn: "Russia" },
  { iso: "US", flag: "🇺🇸", dial: "+1",   nameAr: "الولايات المتحدة", nameEn: "United States" },
  { iso: "CA", flag: "🇨🇦", dial: "+1",   nameAr: "كندا", nameEn: "Canada" },
  { iso: "BR", flag: "🇧🇷", dial: "+55",  nameAr: "البرازيل", nameEn: "Brazil" },
  { iso: "MX", flag: "🇲🇽", dial: "+52",  nameAr: "المكسيك", nameEn: "Mexico" },
  { iso: "AU", flag: "🇦🇺", dial: "+61",  nameAr: "أستراليا", nameEn: "Australia" },
  { iso: "ZA", flag: "🇿🇦", dial: "+27",  nameAr: "جنوب أفريقيا", nameEn: "South Africa" },
  { iso: "NG", flag: "🇳🇬", dial: "+234", nameAr: "نيجيريا", nameEn: "Nigeria" },
  { iso: "KE", flag: "🇰🇪", dial: "+254", nameAr: "كينيا", nameEn: "Kenya" },
  { iso: "ET", flag: "🇪🇹", dial: "+251", nameAr: "إثيوبيا", nameEn: "Ethiopia" },
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0];

export function findCountryByDial(dial: string): Country | undefined {
  return COUNTRIES.find(c => c.dial === dial);
}

export function CountryCodePicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.nameAr.includes(s) ||
      c.nameEn.toLowerCase().includes(s) ||
      c.dial.includes(s) ||
      c.iso.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={styles.trigger}
      >
        <Text style={styles.flag}>{value.flag}</Text>
        <Text style={styles.dial}>{value.dial}</Text>
        <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.55)" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>اختر الدولة</Text>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Feather name="search" size={15} color="rgba(255,255,255,0.45)" />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="ابحث باسم الدولة أو الرمز"
                placeholderTextColor="rgba(255,255,255,0.30)"
                style={styles.searchInput}
                selectionColor={PRIMARY}
              />
            </View>

            <FlatList
              data={list}
              keyExtractor={c => c.iso}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const active = item.iso === value.iso;
                return (
                  <TouchableOpacity
                    onPress={() => { onChange(item); setOpen(false); setQ(""); }}
                    activeOpacity={0.8}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowName} numberOfLines={1}>{item.nameAr}</Text>
                    <Text style={styles.rowDial}>{item.dial}</Text>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>لا توجد نتائج</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    minWidth: 96,
  },
  flag: { fontSize: 18 },
  dial: { color: "#FFF", fontSize: 14, fontFamily: "Inter_700Bold" },

  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  sheet: {
    width: "100%", maxWidth: 420,
    backgroundColor: "#0F0606", borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 12,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { color: "#FFF", fontSize: 16, fontFamily: "Inter_700Bold" },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
  },
  searchInput: {
    flex: 1, color: "#FFF", fontSize: 14,
    fontFamily: "Inter_500Medium", paddingVertical: 10,
    textAlign: "right", writingDirection: "rtl",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10,
  },
  rowActive: { backgroundColor: "rgba(232,184,109,0.15)" },
  rowFlag: { fontSize: 22 },
  rowName: { flex: 1, color: "#FFF", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "right" },
  rowDial: { color: PRIMARY, fontSize: 13, fontFamily: "Inter_700Bold" },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 16, fontSize: 13 },
});
