import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Cafe } from "@/data/mockData";

const { height: SCREEN_H } = Dimensions.get("window");
const SHEET_H = SCREEN_H * 0.58;

const BG      = "#0F0A2E";
const CARD    = "rgba(255,255,255,0.07)";
const BORDER  = "rgba(255,255,255,0.10)";
const PRIMARY = "#C67C4E";

interface Props {
  cafe: Cafe | null;
  onClose: () => void;
}

export function CafeSheet({ cafe, onClose }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SHEET_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (cafe) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [cafe]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: SHEET_H, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    close();
    setTimeout(() => router.push(path as any), 300);
  };

  if (!cafe) return null;

  const ACTIONS = [
    {
      label:   "اطلب الان",
      icon:    "shopping-cart",
      emoji:   "🛒",
      color:   PRIMARY,
      textColor: "#FFF",
      onPress: () => go(`/cafe/${cafe.id}`),
    },
    {
      label:   "شات Copointo",
      icon:    "message-circle",
      emoji:   "🤖",
      color:   "rgba(255,255,255,0.08)",
      textColor: "#FFF",
      onPress: () => go(`/cafe/${cafe.id}/chat`),
    },
    {
      label:   "احجز طاولة",
      icon:    "calendar",
      emoji:   "📅",
      color:   "rgba(255,255,255,0.08)",
      textColor: "#FFF",
      onPress: () => go(`/cafe/${cafe.id}/book`),
    },
  ];

  return (
    <Modal visible={!!cafe} transparent animationType="none" onRequestClose={close}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={close}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 12, transform: [{ translateY: slideY }] },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Cover image */}
        <View style={styles.imageWrap}>
          <Image source={cafe.image} style={styles.coverImg} resizeMode="cover" />
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: cafe.isOpen ? "#2E7D32" : "#555" }]}>
            <View style={[styles.statusDot, { backgroundColor: cafe.isOpen ? "#81C784" : "#AAA" }]} />
            <Text style={styles.statusText}>{cafe.isOpen ? "مفتوح" : "مغلق"}</Text>
          </View>
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.logoCircle}>
            <Text style={{ fontSize: 26 }}>{cafe.logo}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cafeName}>{cafe.name}</Text>
            <Text style={styles.cafeCategory}>{cafe.category}</Text>
          </View>
        </View>

        {/* Meta chips */}
        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Feather name="star" size={12} color="#F9C74F" />
            <Text style={styles.chipText}>{cafe.rating} ({cafe.reviewCount})</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.50)" />
            <Text style={styles.chipText}>{cafe.distance}</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="clock" size={12} color="rgba(255,255,255,0.50)" />
            <Text style={styles.chipText}>{cafe.isOpen ? "7ص – 11م" : "يفتح 7ص"}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={[styles.actionBtn, { backgroundColor: a.color }]}
              onPress={a.onPress}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 20 }}>{a.emoji}</Text>
              <Text style={[styles.actionLabel, { color: a.textColor }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#13102B",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: BORDER,
    borderBottomWidth: 0,
  },
  handle: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 14,
  },
  imageWrap: { borderRadius: 18, overflow: "hidden", marginBottom: 14 },
  coverImg: { width: "100%", height: 140 },
  statusBadge: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  logoCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  cafeName:     { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  cafeCategory: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  metaRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  actions: { gap: 10 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20,
    borderWidth: 1, borderColor: BORDER,
  },
  actionLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
