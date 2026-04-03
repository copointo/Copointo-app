import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAFES } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

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
  const [guests, setGuests] = useState(2);
  const [isBooked, setIsBooked] = useState(false);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleBook = () => {
    if (!selectedTime) {
      Alert.alert("Select Time", "Please select a time slot.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsBooked(true);
  };

  if (isBooked) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.backBtn, { top: topPadding + 8 }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + "20" }]}>
            <Feather name="check-circle" size={64} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>
            Table Booked!
          </Text>
          <Text style={[styles.successSubtitle, { color: colors.mutedForeground }]}>
            {cafe.name}
          </Text>
          <View style={[styles.bookingDetails, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.detailRow}>
              <Feather name="clock" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                {selectedTime}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="users" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                {guests} {guests === 1 ? "guest" : "guests"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={16} color={colors.primary} />
              <Text style={[styles.detailText, { color: colors.foreground }]}>
                {cafe.address}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>
              Done
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
            Book a Table
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
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Number of Guests
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
              <Text style={[styles.guestLabel, { color: colors.mutedForeground }]}>guests</Text>
            </View>
            <TouchableOpacity
              style={[styles.guestBtn, { backgroundColor: colors.primary }]}
              onPress={() => setGuests(Math.min(12, guests + 1))}
            >
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Select Time
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
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadding + 8 }]}>
        <TouchableOpacity
          style={[
            styles.bookBtn,
            {
              backgroundColor: selectedTime ? colors.primary : colors.muted,
            },
          ]}
          onPress={handleBook}
          disabled={!selectedTime}
        >
          <Feather
            name="calendar"
            size={20}
            color={selectedTime ? colors.primaryForeground : colors.mutedForeground}
          />
          <Text
            style={[
              styles.bookBtnText,
              {
                color: selectedTime ? colors.primaryForeground : colors.mutedForeground,
              },
            ]}
          >
            Confirm Booking {selectedTime ? `• ${selectedTime}` : ""}
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
  successTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  successSubtitle: { fontSize: 16, fontFamily: "Inter_400Regular" },
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
