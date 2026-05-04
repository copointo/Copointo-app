import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAFES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { apiFetch, apiPost } from "@/constants/api";
import { loadSavedOrderInfo, saveOrderInfo } from "@/lib/savedOrderInfo";

interface PriceTier { hours: number; price: number; }
interface Table {
  id: string; cafeId: string; number: number; capacity: number; available: boolean;
  hourlyPricing?: PriceTier[];
}

const TIME_SLOTS = [
  "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM",
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM",
  "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM",
];

export default function BookTableScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];

  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [guests, setGuests] = useState(1);
  const [tables, setTables]   = useState<Table[]>([]);
  const [loadingT, setLoadingT] = useState(true);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedTier, setSelectedTier] = useState<PriceTier | null>(null);
  const [name,  setName]  = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Approval-tracking after a successful submit.
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<"pending" | "confirmed" | "cancelled" | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    let cancelled = false;
    setLoadingT(true);
    apiFetch<{ tables: Table[] }>(`/cafe/${id}/tables`)
      .then((d) => { if (!cancelled) setTables(d.tables.filter(t => t.available !== false)); })
      .catch(() => { if (!cancelled) setTables([]); })
      .finally(() => { if (!cancelled) setLoadingT(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Prefill from previously saved info (after the user's first order/booking)
  useEffect(() => {
    let cancelled = false;
    loadSavedOrderInfo().then((s) => {
      if (cancelled) return;
      if (s.bookName)  setName(s.bookName);
      else if (s.dineName) setName(s.dineName);
      if (s.bookPhone) setPhone(s.bookPhone);
      else if (s.dinePhone) setPhone(s.dinePhone);
    });
    return () => { cancelled = true; };
  }, []);

  // Whenever the table changes, clamp guests to its capacity and reset tier.
  useEffect(() => {
    if (!selectedTable) return;
    setGuests(g => Math.min(g, selectedTable.capacity));
    setSelectedTier(null);
  }, [selectedTable]);

  // Once a booking has been submitted, poll its status every 5 s so the
  // customer sees the "✅ approved" confirmation as soon as the cafe admin
  // taps "تأكيد". Uses useFocusEffect so the timer is paused (and cleared)
  // whenever the user navigates away or the screen blurs — no background
  // network chatter when this screen isn't visible.
  useFocusEffect(
    useCallback(() => {
      if (!bookingId || bookingStatus !== "pending") return;
      let cancelled = false;
      const tick = async () => {
        try {
          const r = await apiFetch<{ bookings: any[] }>(`/cafe/${id}/bookings`);
          if (cancelled) return;
          const b = r.bookings?.find((x: any) => String(x.id) === String(bookingId));
          if (b && b.status !== "pending") setBookingStatus(b.status);
        } catch { /* keep polling */ }
      };
      tick();
      const handle = setInterval(tick, 5000);
      return () => { cancelled = true; clearInterval(handle); };
    }, [bookingId, bookingStatus, id]),
  );

  const tiers: PriceTier[] = Array.isArray(selectedTable?.hourlyPricing) ? selectedTable!.hourlyPricing! : [];
  const finalPrice = selectedTier ? Number(selectedTier.price) : null;

  const handleBook = async () => {
    if (!selectedTable) {
      Alert.alert("تنبيه", "يرجى اختيار طاولة");
      return;
    }
    if (tiers.length === 0) {
      Alert.alert("تنبيه", "هذه الطاولة بدون أسعار توقيت — راسل الكوفي");
      return;
    }
    if (!selectedTier) {
      Alert.alert("تنبيه", "اختر مدة الحجز (الساعات)");
      return;
    }
    if (!selectedTime) {
      Alert.alert("تنبيه", "يرجى اختيار الوقت");
      return;
    }
    if (guests < 1 || guests > selectedTable.capacity) {
      Alert.alert("تنبيه", `الطاولة ${selectedTable.number} تتسع لـ ${selectedTable.capacity} أشخاص فقط`);
      return;
    }
    if (!name.trim() || !phone.trim()) {
      Alert.alert("تنبيه", "يرجى إدخال الاسم ورقم الهاتف");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiPost<{ booking: any }>(`/cafe/${id}/bookings`, {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        tableId: selectedTable.id,
        tableNumber: selectedTable.number,
        date: new Date().toISOString().substring(0, 10),
        time: selectedTime,
        guests,
        hours: selectedTier.hours,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      saveOrderInfo({ bookName:  name.trim(), bookPhone: phone.trim() });
      setBookingId(String(r.booking?.id ?? ""));
      setBookingStatus("pending");
    } catch (e: any) {
      Alert.alert("تعذّر الحجز", e?.message ?? "حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Result screen (after submit) ───────────────────────────
  if (bookingStatus) {
    const isConfirmed = bookingStatus === "confirmed";
    const isCancelled = bookingStatus === "cancelled";
    const stateColor  = isConfirmed ? colors.success
                      : isCancelled ? "#E55353"
                      : colors.primary;
    const icon        = isConfirmed ? "check-circle"
                      : isCancelled ? "x-circle"
                      : "clock";
    const title       = isConfirmed ? "✅ تم تأكيد حجزك"
                      : isCancelled ? "❌ تم إلغاء طلب الحجز"
                      : "⏳ في انتظار موافقة الكوفي";
    const sub         = isConfirmed ? "نراك قريباً في "
                      : isCancelled ? "للأسف لم يتمّ تأكيد طلبك في "
                      : "أرسلنا طلبك إلى ";
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.backBtn, { top: topPadding + 8 }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: stateColor + "20" }]}>
            <Feather name={icon as any} size={64} color={stateColor} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground, textAlign: "center" }]}>
            {title}
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
            {sub}{cafe.name}
          </Text>
          <View style={[styles.bookingDetails, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <Feather name="grid" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                طاولة {selectedTable?.number} • {selectedTable?.capacity} أشخاص
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="clock" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                {selectedTime} • {selectedTier?.hours} ساعة
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="users" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                {guests} {guests === 1 ? "شخص" : "أشخاص"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="dollar-sign" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground, fontWeight: "700" }]}>
                {Number(finalPrice ?? 0).toFixed(3)} ر.ع.
              </Text>
            </View>
          </View>
          {bookingStatus === "pending" && (
            <View style={{
              backgroundColor: colors.primary + "15",
              borderColor:     colors.primary + "40",
              borderWidth: 1, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 12,
              flexDirection: "row", alignItems: "center", gap: 10,
            }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 13, flex: 1 }}>
                ستصلك رسالة تأكيد فور موافقة الكوفي على حجزك
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
              تم
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            حجز طاولة
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {cafe.name}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPadding + 80 }]}
      >
        {/* ── Tables ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            🪑  اختر الطاولة
          </Text>
          {loadingT ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : tables.length === 0 ? (
            <View style={[styles.emptyTables, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 32 }}>🪑</Text>
              <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: "center", marginTop: 6 }}>
                لم يضف الكوفي أي طاولات بعد
              </Text>
            </View>
          ) : (
            <View style={styles.timesGrid}>
              {tables.map((t) => {
                const active = selectedTable?.id === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.tableCard,
                      {
                        backgroundColor: active ? colors.primary : colors.card,
                        borderColor:     active ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => { Haptics.selectionAsync(); setSelectedTable(t); }}
                  >
                    <Text style={[styles.tableNum, { color: active ? colors.primaryForeground : colors.primary }]}>
                      {t.number}
                    </Text>
                    <Text style={[styles.tableCap, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      👥 حتى {t.capacity}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Hourly pricing tiers ── */}
        {selectedTable && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              ⏱️  مدة الحجز / السعر
            </Text>
            {tiers.length === 0 ? (
              <View style={[styles.emptyTables, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ fontSize: 12, color: "#E55353", textAlign: "center" }}>
                  هذه الطاولة بدون أسعار توقيت — تواصل مع الكوفي
                </Text>
              </View>
            ) : (
              <View style={styles.timesGrid}>
                {tiers.map((tier) => {
                  const active = selectedTier?.hours === tier.hours;
                  return (
                    <TouchableOpacity
                      key={`${tier.hours}-${tier.price}`}
                      style={[
                        styles.tierCard,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor:     active ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => { Haptics.selectionAsync(); setSelectedTier(tier); }}
                    >
                      <Text style={[styles.tierHours, { color: active ? colors.primaryForeground : colors.foreground }]}>
                        {tier.hours} ساعة
                      </Text>
                      <Text style={[styles.tierPrice, { color: active ? colors.primaryForeground : colors.primary }]}>
                        {Number(tier.price).toFixed(3)} ر.ع
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── Guests (capped to capacity) ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            عدد الأشخاص {selectedTable ? `(الحد الأقصى ${selectedTable.capacity})` : ""}
          </Text>
          <View style={[styles.guestsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.guestBtn, { backgroundColor: colors.secondary }]}
              onPress={() => setGuests(Math.max(1, guests - 1))}
            >
              <Feather name="minus" size={18} color={colors.secondaryForeground} />
            </TouchableOpacity>
            <View style={styles.guestCount}>
              <Text style={[styles.guestNum, { color: colors.foreground }]}>{guests}</Text>
              <Text style={[styles.guestLabel, { color: colors.mutedForeground }]}>
                {guests === 1 ? "شخص" : "أشخاص"}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.guestBtn,
                {
                  backgroundColor: selectedTable && guests >= selectedTable.capacity
                    ? colors.muted : colors.primary,
                  opacity: selectedTable && guests >= selectedTable.capacity ? 0.5 : 1,
                },
              ]}
              disabled={!!selectedTable && guests >= selectedTable.capacity}
              onPress={() => {
                const cap = selectedTable?.capacity ?? 12;
                setGuests(g => Math.min(cap, g + 1));
              }}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
          {selectedTable && guests >= selectedTable.capacity && (
            <Text style={{ fontSize: 11, color: "#E55353", marginTop: 6, textAlign: "center" }}>
              وصلت إلى السعة القصوى لهذه الطاولة
            </Text>
          )}
        </View>

        {/* ── Customer info ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            👤  بياناتك
          </Text>
          <View style={{ gap: 10 }}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="الاسم الكامل"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="رقم الهاتف"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            وقت الحجز
          </Text>
          <View style={styles.timesGrid}>
            {TIME_SLOTS.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeSlot,
                  {
                    backgroundColor:
                      selectedTime === time ? colors.primary : colors.card,
                    borderColor:
                      selectedTime === time ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedTime(time);
                }}
              >
                <Text
                  style={[
                    styles.timeText,
                    {
                      color:
                        selectedTime === time
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Final price preview ── */}
        {finalPrice !== null && (
          <View style={[styles.section, { marginBottom: 12 }]}>
            <View style={{
              backgroundColor: colors.primary + "15",
              borderColor: colors.primary + "50",
              borderWidth: 1,
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>
                💰 سعر الحجز النهائي
              </Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.primary }}>
                {finalPrice.toFixed(3)} ر.ع
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadding + 8 }]}>
        <TouchableOpacity
          style={[
            styles.bookBtn,
            {
              backgroundColor: (selectedTime && selectedTable && selectedTier && !submitting) ? colors.primary : colors.muted,
            },
          ]}
          onPress={handleBook}
          disabled={!selectedTime || !selectedTable || !selectedTier || submitting}
        >
          <Feather
            name="calendar"
            size={20}
            color={(selectedTime && selectedTable && selectedTier) ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.bookBtnText,
              {
                color: (selectedTime && selectedTable && selectedTier) ? colors.primaryForeground : colors.mutedForeground,
              },
            ]}
          >
            {submitting
              ? "جاري الحجز..."
              : finalPrice !== null
                ? `طلب الحجز • ${finalPrice.toFixed(3)} ر.ع`
                : "اختر الطاولة والمدة"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  scroll: { paddingHorizontal: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 14 },
  guestsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 16,
    justifyContent: "center",
  },
  guestBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  guestCount: { alignItems: "center", minWidth: 60 },
  guestNum: { fontSize: 36, fontFamily: "Inter_700Bold" },
  guestLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  timesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  timeSlot: {
    width: "30%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  timeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tableCard: {
    width: "30%", paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    alignItems: "center", gap: 4,
  },
  tableNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tableCap: { fontSize: 11, fontFamily: "Inter_500Medium" },
  tierCard: {
    width: "30%", paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    alignItems: "center", gap: 4,
  },
  tierHours: { fontSize: 14, fontFamily: "Inter_700Bold" },
  tierPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  emptyTables: {
    paddingVertical: 28, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1, alignItems: "center",
  },
  input: {
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_500Medium",
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 18,
    gap: 10,
  },
  bookBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  successSubtitle: { fontSize: 15, fontFamily: "Inter_400Regular" },
  bookingDetails: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    marginTop: 8,
  },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  doneBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
