import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
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
import { apiFetch, apiPost } from "@/constants/api";
import { useApp } from "@/context/AppContext";

interface ApiCafe {
  id: string; name: string; logo: string; image: string; lat?: number; lng?: number;
  openTime: string; closeTime: string; rating: number; ratingCount?: number;
  tags: string[]; address: string;
  /** Exact Google Maps URL pasted by the super-admin in the cafe edit form. */
  website?: string;
}
function isOpen(o: string, c: string) {
  const now = new Date(); const m = now.getHours()*60+now.getMinutes();
  const p = (t:string)=>{const[h,mm]=t.split(":").map(Number);return h*60+(mm||0);};
  const op=p(o),cl=p(c); return cl<=op?(m>=op||m<cl):(m>=op&&m<cl);
}
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const d = (x: number) => x * Math.PI / 180;
  const dLat = d(lat2 - lat1), dLon = d(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(d(lat1)) * Math.cos(d(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";

export default function CafeLandingScreen() {
  const { id }  = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useApp();
  const [cafe, setCafe] = useState<ApiCafe | null>(null);
  const [loading, setLoading] = useState(true);
  // Rating panel state
  const [myStars, setMyStars] = useState(0);          // current user's rating (0 = not rated yet)
  const [submitting, setSubmitting] = useState(false);

  // Cafe-report modal state. Pre-fills name + phone from the logged-in user
  // (still editable). Posts to /api/reports with kind="cafe" and the cafe id
  // so the super-admin can see the full cafe details next to the report.
  const [reportOpen, setReportOpen]       = useState(false);
  const [reportName, setReportName]       = useState("");
  const [reportPhone, setReportPhone]     = useState("");
  const [reportDesc, setReportDesc]       = useState("");
  const [reportSending, setReportSending] = useState(false);
  const openReport = () => {
    setReportName(user?.name ?? "");
    setReportPhone(user?.phone ?? "");
    setReportDesc("");
    setReportOpen(true);
  };

  // ── Gift voucher (اهدي من تحب) ───────────────────────────────────
  // Multi-step modal: amount → sender → recipient → fromMode → fake pay → done.
  type GiftStep = "amount" | "sender" | "recipient" | "from" | "pay" | "done";
  const [giftOpen, setGiftOpen]               = useState(false);
  const [giftStep, setGiftStep]               = useState<GiftStep>("amount");
  const [giftAmount, setGiftAmount]           = useState("");
  const [giftSenderName, setGiftSenderName]   = useState("");
  const [giftSenderPhone, setGiftSenderPhone] = useState("");
  const [giftRecName, setGiftRecName]         = useState("");
  const [giftRecPhone, setGiftRecPhone]       = useState("");
  const [giftFromMode, setGiftFromMode]       = useState<"anonymous"|"friend"|"named"|null>(null);
  const [giftFromDisplay, setGiftFromDisplay] = useState("");
  const [giftSending, setGiftSending]         = useState(false);

  const openGift = () => {
    setGiftStep("amount");
    setGiftAmount("");
    setGiftSenderName(user?.name ?? "");
    setGiftSenderPhone(user?.phone ?? "");
    setGiftRecName("");
    setGiftRecPhone("");
    setGiftFromMode(null);
    setGiftFromDisplay(user?.name ?? "");
    setGiftSending(false);
    setGiftOpen(true);
  };
  const closeGift = () => setGiftOpen(false);

  const submitGift = async () => {
    if (giftSending) return;
    const amount = Number(giftAmount);
    if (!Number.isFinite(amount) || amount < 2) {
      Alert.alert("القيمة غير صالحة", "أقل قيمة للقسيمة 2 ر.ع");
      setGiftStep("amount");
      return;
    }
    if (!giftSenderName.trim() || !giftSenderPhone.trim()) {
      Alert.alert("بيانات المُرسِل ناقصة"); setGiftStep("sender"); return;
    }
    if (!giftRecName.trim() || !giftRecPhone.trim()) {
      Alert.alert("بيانات المُرسَل إليه ناقصة"); setGiftStep("recipient"); return;
    }
    if (!giftFromMode) { setGiftStep("from"); return; }

    try {
      setGiftSending(true);
      await apiPost(`/cafe/${id}/gift-vouchers`, {
        amount,
        senderName:     giftSenderName.trim(),
        senderPhone:    giftSenderPhone.trim(),
        recipientName:  giftRecName.trim(),
        recipientPhone: giftRecPhone.trim(),
        fromMode:       giftFromMode,
        fromDisplay:    giftFromMode === "named" ? (giftFromDisplay.trim() || giftSenderName.trim()) : undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGiftStep("done");
    } catch {
      Alert.alert("تعذّر إتمام الطلب", "حاول مرة أخرى لاحقاً");
    } finally {
      setGiftSending(false);
    }
  };
  const submitReport = async () => {
    const name = reportName.trim();
    const phone = reportPhone.trim();
    const description = reportDesc.trim();
    if (!name || !phone || !description) {
      Alert.alert("بيانات ناقصة", "الرجاء تعبئة الاسم ورقم الهاتف ووصف المشكلة.");
      return;
    }
    setReportSending(true);
    try {
      await apiPost("/reports", {
        kind: "cafe",
        cafeId: id,
        name, phone, description,
        reporterUserId: user?.id,
      });
      setReportOpen(false);
      Alert.alert("تم الإرسال", "تم استلام بلاغك وسيتم مراجعته قريباً. شكراً لك.");
    } catch {
      Alert.alert("تعذر الإرسال", "حدث خطأ أثناء إرسال البلاغ. حاول لاحقاً.");
    } finally {
      setReportSending(false);
    }
  };

  // User location states
  const [userLoc,        setUserLoc]        = useState<{ lat: number; lng: number } | null>(null);
  const [locPrompt,      setLocPrompt]      = useState(false);   // show custom prompt
  const [locLoading,     setLocLoading]     = useState(false);   // fetching coords

  // Prompt slide-up animation
  const promptAnim = useRef(new Animated.Value(0)).current;
  const showPrompt = () => {
    setLocPrompt(true);
    Animated.spring(promptAnim, { toValue: 1, useNativeDriver: false, tension: 60, friction: 10 }).start();
  };
  const hidePrompt = () => {
    Animated.timing(promptAnim, { toValue: 0, duration: 220, useNativeDriver: false, easing: Easing.out(Easing.ease) }).start(() => setLocPrompt(false));
  };
  const promptTranslate = promptAnim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });

  const requestLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { hidePrompt(); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch { /* unavailable */ }
    finally { setLocLoading(false); hidePrompt(); }
  };

  // On mount: check permission status, show prompt if undetermined
  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        // Already granted — silently get location
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch { /* ignore */ }
      } else if (status === "undetermined") {
        // Show our custom prompt after a short delay
        setTimeout(showPrompt, 600);
      }
      // If denied: nothing shown
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shimmer animation — must be before any conditional return
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
        Animated.delay(1800),
        Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, [shimmer]);
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-160, 520] });

  useEffect(() => {
    // Fetch the single cafe (returns live average rating + ratingCount).
    apiFetch<{ cafe: ApiCafe }>(`/cafes/${id}`)
      .then(d => { if (d.cafe) setCafe(d.cafe); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // Track this view (best-effort; ignore errors)
    if (id) apiPost(`/cafe/${id}/track-view`, { source: "cafe-detail" }).catch(() => {});
  }, [id]);

  // Load the current user's previous rating (so the panel shows it pre-selected).
  useEffect(() => {
    if (!id || !user?.id) { setMyStars(0); return; }
    apiFetch<{ stars: number }>(`/cafes/${id}/my-rating?userId=${encodeURIComponent(user.id)}`)
      .then(d => setMyStars(d.stars ?? 0))
      .catch(() => {});
  }, [id, user?.id]);

  // Upsert the user's rating. Optimistically updates the local stars count;
  // refreshes the cafe stats from the server response.
  const submitRating = async (stars: number) => {
    if (!user?.id) return;
    if (submitting) return;
    if (stars < 1 || stars > 5) return;
    setSubmitting(true);
    const prev = myStars;
    setMyStars(stars);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const res = await apiPost<{ ok: boolean; rating: number; ratingCount: number }>(
        `/cafes/${id}/rate`, { userId: user.id, stars }
      );
      if (res?.ok && cafe) {
        setCafe({ ...cafe, rating: res.rating, ratingCount: res.ratingCount });
      }
    } catch {
      // Roll back on failure
      setMyStars(prev);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: BG, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }
  if (!cafe) {
    return (
      <View style={[styles.container, { backgroundColor: BG, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: "#fff", fontSize: 16 }}>الكوفي غير موجود</Text>
      </View>
    );
  }

  const cafeOpen     = isOpen(cafe.openTime, cafe.closeTime);
  const cafeCategory = cafe.tags?.[0] ?? "Coffee";
  const cafeImage    = cafe.image ? { uri: cafe.image } : require("@/assets/images/icon.png");
  const isLogoUrl    = !!(cafe.logo && (cafe.logo.startsWith("http") || cafe.logo.startsWith("data:") || cafe.logo.startsWith("blob:")));

  const go = (path: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(path as any);
  };

  const ACTIONS = [
    {
      mciIcon: "coffee-maker" as const,
      label:   "اطلب قهوة",
      sub:     "تصفح القائمة واطلب مشروبك المفضل",
      bg:      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&h=500&fit=crop&q=90",
      deep:    "#0D0704",
      onPress: () => go(`/cafe/${id}/order`),
    },
    {
      mciIcon: "table-furniture" as const,
      label:   "احجز طاولة",
      sub:     "احجز مقعدك واستمتع بتجربتك",
      bg:      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500&h=500&fit=crop&q=90",
      deep:    "#080503",
      onPress: () => go(`/cafe/${id}/book`),
    },
    {
      mciIcon: "message-text" as const,
      label:   `شات ${cafe.name}`,
      sub:     "احصل على توصية ذكية تناسبك",
      bg:      "",
      solidColors: ["#0A0606", "#050303", "#000000"] as const,
      deep:    "#000000",
      onPress: () => go(`/cafe/${id}/chat`),
    },
  ];

  return (
    <View style={styles.container}>

      {/* ── Location Permission Prompt ── */}
      <Modal transparent visible={locPrompt} animationType="none" statusBarTranslucent>
        <View style={styles.promptBackdrop}>
          <Animated.View style={[styles.promptSheet, { transform: [{ translateY: promptTranslate }] }]}>
            {/* Header pill */}
            <View style={styles.promptPill} />
            {/* Icon */}
            <View style={styles.promptIconWrap}>
              <LinearGradient colors={["#C67C4E", "#8B4513"]} style={styles.promptIconBg}>
                <Feather name="navigation" size={28} color="#FFF" />
              </LinearGradient>
            </View>
            <Text style={styles.promptTitle}>اعرف مسافتك عن الكوفي</Text>
            <Text style={styles.promptBody}>
              نحتاج إذنك للوصول إلى موقعك الحالي لحساب المسافة بينك وبين الكوفي
            </Text>
            <TouchableOpacity
              style={styles.promptAllowBtn}
              onPress={requestLocation}
              activeOpacity={0.85}
              disabled={locLoading}
            >
              {locLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Feather name="map-pin" size={16} color="#FFF" />
                    <Text style={styles.promptAllowText}>السماح بالموقع</Text>
                  </>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptLaterBtn} onPress={hidePrompt} activeOpacity={0.7}>
              <Text style={styles.promptLaterText}>لاحقاً</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Hero Image ── */}
      <View style={styles.heroWrap}>
        <Image source={cafeImage} style={styles.heroImg} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(15,10,46,0.85)", BG]}
          style={styles.gradient}
        />

        {/* Back button — falls back to home when there is no history
            (e.g. cold-start via QR/barcode deep link into /cafe/[id]). */}
        <TouchableOpacity
          style={[styles.backBtn, { top: topPad + 8 }]}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/" as any);
          }}
          activeOpacity={0.85}
        >
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>

        {/* Cafe identity on image */}
        <View style={styles.heroInfo}>
          <View style={styles.logoCircle}>
            {isLogoUrl
              ? <Image source={{ uri: cafe.logo }} style={{ width: 50, height: 50, borderRadius: 25 }} />
              : <Text style={{ fontSize: 30 }}>{cafe.logo || "☕"}</Text>}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{cafe.name}</Text>
            <Text style={styles.heroCategory}>{cafeCategory}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cafeOpen ? "#1B5E20" : "#424242" }]}>
            <View style={[styles.statusDot, { backgroundColor: cafeOpen ? "#66BB6A" : "#9E9E9E" }]} />
            <Text style={styles.statusText}>{cafeOpen ? "مفتوح" : "مغلق"}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: BG }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ── Meta chips ── */}
        <View style={styles.metaRow}>
          <View style={styles.chip}>
            <Feather name="star" size={13} color="#E8B86D" />
            <Text style={styles.chipText}>
              {(cafe.ratingCount ?? 0) > 0
                ? `${cafe.rating.toFixed(1)} (${cafe.ratingCount})`
                : "بدون تقييم"}
            </Text>
          </View>
          <View style={styles.chip}>
            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.address}</Text>
          </View>
          <View style={styles.chip}>
            <Feather name="clock" size={13} color="rgba(255,255,255,0.55)" />
            <Text style={styles.chipText}>{cafe.openTime} – {cafe.closeTime}</Text>
          </View>
        </View>

        {/* ── Location & Distance ── */}
        {(() => {
          const dist = (userLoc && cafe.lat && cafe.lng)
            ? haversineKm(userLoc.lat, userLoc.lng, cafe.lat, cafe.lng)
            : null;
          // Sub-km → exact metres; otherwise km with 2 decimals so we don't
          // round 1.24 km down to 1.2 km. The user wants precise numbers.
          // < 30 m → "0 م" (you're effectively at the cafe — GPS jitter
          // alone can produce 5–25 m noise indoors, so we clamp).
          const distStr = dist === null ? null
            : dist * 1000 < 30 ? `0 م`
            : dist < 1 ? `${Math.round(dist * 1000)} م`
            : `${dist.toFixed(2)} كم`;
          const openMaps = () => {
            // Use the EXACT link the super-admin pasted in the cafe edit form
            // (cafe.website) so the customer lands on the same place the
            // owner pinned — including any custom place-id or share URL.
            // Fall back to lat/lng or address only when no link was saved.
            const adminUrl = (cafe.website ?? "").trim();
            if (adminUrl) {
              Linking.openURL(adminUrl);
              return;
            }
            const q = cafe.lat && cafe.lng
              ? `${cafe.lat},${cafe.lng}`
              : encodeURIComponent(cafe.address);
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
          };
          return (
            <View style={styles.locationCard}>
              {/* Left: address + distance */}
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.locationRow}>
                  <Feather name="map-pin" size={14} color={PRIMARY} />
                  <Text style={styles.locationAddress} numberOfLines={2}>{cafe.address}</Text>
                </View>
                {distStr !== null && (
                  <View style={styles.locationRow}>
                    <Feather name="navigation" size={13} color="#E8B86D" />
                    <Text style={styles.distInlineText}>
                      يبعد عنك <Text style={styles.distInlineValue}>{distStr}</Text>
                    </Text>
                  </View>
                )}
              </View>
              {/* Right: map button */}
              <TouchableOpacity style={styles.mapsBtn} onPress={openMaps} activeOpacity={0.8}>
                <Feather name="map" size={15} color="#FFF" />
                <Text style={styles.mapsBtnText}>الخريطة</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Tags ── */}
        <View style={styles.tagsRow}>
          {cafe.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Action buttons ── */}
        <Text style={styles.sectionLabel}>ماذا تريد؟</Text>

        {/* Top row: 2 square cards */}
        <View style={styles.actionsTopRow}>
          {ACTIONS.slice(0, 2).map((a) => (
            <TouchableOpacity
              key={a.label}
              onPress={a.onPress}
              activeOpacity={0.82}
              style={styles.actionSquareWrap}
            >
              {/* 3D depth layer */}
              <View style={[styles.actionDepth, { backgroundColor: a.deep }]} />
              {/* Main card with photo background */}
              <ImageBackground
                source={{ uri: a.bg }}
                style={styles.actionSquare}
                imageStyle={styles.actionBgImage}
              >
                {/* Dark overlay for readability */}
                <View style={styles.actionOverlay} />
                {/* Shimmer sweep */}
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "25deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.22)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionSquareLabel}>{a.label}</Text>

                {/* Cart/history overlay button — opens past 30-day purchase
                    history + current cart for this cafe. Stops propagation
                    so the parent action card does not fire. */}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.selectionAsync();
                    router.push(`/cafe/${id}/history` as any);
                  }}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}
                  style={styles.cartBadge}
                >
                  <Feather name="shopping-bag" size={16} color="#FFF" />
                </TouchableOpacity>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom: full-width card */}
        {ACTIONS[2] && (
          <TouchableOpacity
            onPress={ACTIONS[2].onPress}
            activeOpacity={0.82}
            style={styles.actionWideWrap}
          >
            {/* 3D depth layer */}
            <View style={[styles.actionWideDepth, { backgroundColor: ACTIONS[2].deep }]} />
            {ACTIONS[2].solidColors ? (
              <LinearGradient
                colors={ACTIONS[2].solidColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionWide}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(232,184,109,0)", "rgba(232,184,109,0.25)", "rgba(232,184,109,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionWideLabel}>{ACTIONS[2].label}</Text>
              </LinearGradient>
            ) : (
              <ImageBackground
                source={{ uri: ACTIONS[2].bg }}
                style={styles.actionWide}
                imageStyle={styles.actionBgImage}
              >
                <View style={styles.actionOverlay} />
                <Animated.View
                  pointerEvents="none"
                  style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
                >
                  <LinearGradient
                    colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0)"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                  />
                </Animated.View>
                <Text style={styles.actionWideLabel}>{ACTIONS[2].label}</Text>
              </ImageBackground>
            )}
          </TouchableOpacity>
        )}

        {/* ── Gift voucher wide card (اهدي من تحب) ── */}
        <TouchableOpacity
          onPress={openGift}
          activeOpacity={0.85}
          style={[styles.actionWideWrap, { marginTop: 14 }]}
        >
          <View style={[styles.actionWideDepth, { backgroundColor: "#3a1f08" }]} />
          <LinearGradient
            colors={["#E8B86D", "#C67C4E", "#8B4513"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.actionWide, { paddingVertical: 22 }]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.shimmerStrip, { transform: [{ translateX: shimmerX }, { rotate: "20deg" }] }]}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.30)", "rgba(255,255,255,0)"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ flex: 1 }}
              />
            </Animated.View>
            <View style={styles.giftBtnRow}>
              <Feather name="gift" size={26} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={styles.giftBtnTitle}>اهدي من تحب</Text>
                <Text style={styles.giftBtnSub}>قسيمة شرائية لصديق أو من تحب</Text>
              </View>
              <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.85)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Rating panel (optional) ── */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingHeaderRow}>
            <Feather name="star" size={16} color={PRIMARY} />
            <Text style={styles.ratingTitle}>قيّم هذا الكوفي</Text>
          </View>
          <Text style={styles.ratingSub}>
            {(cafe.ratingCount ?? 0) > 0
              ? `متوسط التقييم ${cafe.rating.toFixed(1)} من ${cafe.ratingCount} مستخدم`
              : "كن أوّل من يقيّم هذا الكوفي"}
          </Text>

          {/* 5 tappable stars (RTL: reversed so star 1 is on the right) */}
          <View style={styles.starsRow}>
            {[5, 4, 3, 2, 1].map((n) => {
              const filled = myStars >= n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => submitRating(n)}
                  disabled={submitting || !user}
                  activeOpacity={0.7}
                  style={styles.starBtn}
                >
                  <MaterialCommunityIcons
                    name={filled ? "star" : "star-outline"}
                    size={36}
                    color={filled ? PRIMARY : "rgba(255,255,255,0.35)"}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.ratingHint}>
            {!user
              ? "سجّل دخولك لإضافة تقييم"
              : myStars > 0
                ? `تقييمك: ${myStars} من 5 — اضغط لتعديله`
                : "التقييم اختياري — اضغط على عدد النجوم"}
          </Text>
        </View>

        {/* ── Report cafe button ── */}
        <TouchableOpacity
          style={styles.reportBtn}
          activeOpacity={0.85}
          onPress={openReport}
        >
          <Feather name="flag" size={15} color="#E55353" />
          <Text style={styles.reportBtnText}>الإبلاغ عن هذا الكوفي</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Gift voucher modal ── */}
      <Modal visible={giftOpen} transparent animationType="fade" onRequestClose={closeGift}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.reportOverlay}>
          <View style={[styles.reportCard, { gap: 16 }]}>
            <TouchableOpacity style={styles.reportClose} onPress={closeGift}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>

            <View style={styles.reportHeader}>
              <View style={[styles.reportIconWrap, { backgroundColor: "rgba(232,184,109,0.18)", borderColor: "rgba(232,184,109,0.45)" }]}>
                <Feather name="gift" size={22} color={PRIMARY} />
              </View>
              <Text style={styles.reportTitle}>اهدي من تحب</Text>
              <Text style={styles.reportSub}>قسيمة شرائية في {cafe.name}</Text>
            </View>

            {/* Step indicator */}
            {giftStep !== "done" && (
              <View style={styles.giftSteps}>
                {(["amount","sender","recipient","from","pay"] as const).map((s, idx) => {
                  const order = ["amount","sender","recipient","from","pay"];
                  const cur = order.indexOf(giftStep);
                  const active = idx <= cur;
                  return <View key={s} style={[styles.giftStepDot, active && styles.giftStepDotOn]} />;
                })}
              </View>
            )}

            {giftStep === "amount" && (
              <>
                <View style={styles.reportField}>
                  <Text style={styles.reportLabel}>قيمة القسيمة (ر.ع) — أقل قيمة 2</Text>
                  <TextInput
                    style={[styles.reportInput, { fontSize: 22, textAlign: "center", fontFamily: "Inter_700Bold" }]}
                    value={giftAmount}
                    onChangeText={(t) => setGiftAmount(t.replace(/[^0-9.]/g, ""))}
                    placeholder="مثال: 5"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.giftQuickRow}>
                  {[2, 5, 10, 20].map((v) => (
                    <TouchableOpacity key={v} style={styles.giftQuickPill} onPress={() => setGiftAmount(String(v))}>
                      <Text style={styles.giftQuickText}>{v} ر.ع</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.giftPrimaryBtn}
                  onPress={() => {
                    const a = Number(giftAmount);
                    if (!Number.isFinite(a) || a < 2) {
                      Alert.alert("القيمة غير صالحة", "أقل قيمة للقسيمة 2 ر.ع");
                      return;
                    }
                    setGiftStep("sender");
                  }}
                >
                  <Text style={styles.giftPrimaryText}>التالي</Text>
                </TouchableOpacity>
              </>
            )}

            {giftStep === "sender" && (
              <>
                <View style={styles.reportField}>
                  <Text style={styles.reportLabel}>اسمك</Text>
                  <TextInput
                    style={styles.reportInput}
                    value={giftSenderName}
                    onChangeText={setGiftSenderName}
                    placeholder="اسمك الكامل"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    textAlign="right"
                  />
                </View>
                <View style={styles.reportField}>
                  <Text style={styles.reportLabel}>رقم هاتفك</Text>
                  <TextInput
                    style={styles.reportInput}
                    value={giftSenderPhone}
                    onChangeText={setGiftSenderPhone}
                    placeholder="9XXXXXXX"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    keyboardType="phone-pad"
                    textAlign="right"
                  />
                </View>
                <View style={styles.giftNavRow}>
                  <TouchableOpacity style={styles.giftSecondaryBtn} onPress={() => setGiftStep("amount")}>
                    <Text style={styles.giftSecondaryText}>السابق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.giftPrimaryBtn, { flex: 1 }]}
                    onPress={() => {
                      if (!giftSenderName.trim() || !giftSenderPhone.trim()) {
                        Alert.alert("بيانات ناقصة", "أدخل الاسم ورقم الهاتف");
                        return;
                      }
                      setGiftStep("recipient");
                    }}
                  >
                    <Text style={styles.giftPrimaryText}>التالي</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {giftStep === "recipient" && (
              <>
                <View style={styles.reportField}>
                  <Text style={styles.reportLabel}>اسم المُهدى إليه</Text>
                  <TextInput
                    style={styles.reportInput}
                    value={giftRecName}
                    onChangeText={setGiftRecName}
                    placeholder="اسم من تريد إهداءه"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    textAlign="right"
                  />
                </View>
                <View style={styles.reportField}>
                  <Text style={styles.reportLabel}>رقم هاتف المُهدى إليه</Text>
                  <TextInput
                    style={styles.reportInput}
                    value={giftRecPhone}
                    onChangeText={setGiftRecPhone}
                    placeholder="9XXXXXXX"
                    placeholderTextColor="rgba(255,255,255,0.30)"
                    keyboardType="phone-pad"
                    textAlign="right"
                  />
                </View>
                <View style={styles.giftNavRow}>
                  <TouchableOpacity style={styles.giftSecondaryBtn} onPress={() => setGiftStep("sender")}>
                    <Text style={styles.giftSecondaryText}>السابق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.giftPrimaryBtn, { flex: 1 }]}
                    onPress={() => {
                      if (!giftRecName.trim() || !giftRecPhone.trim()) {
                        Alert.alert("بيانات ناقصة", "أدخل اسم ورقم المُهدى إليه");
                        return;
                      }
                      setGiftStep("from");
                    }}
                  >
                    <Text style={styles.giftPrimaryText}>التالي</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {giftStep === "from" && (
              <>
                <Text style={[styles.reportLabel, { textAlign: "center" }]}>كيف تريد أن تظهر القسيمة للمستلم؟</Text>
                {([
                  { k: "anonymous" as const, t: "من طرف مجهول", s: "لن يعلم اسمك" },
                  { k: "friend"    as const, t: "من صديق/ة",    s: "يظهر فقط أنه من صديق" },
                  { k: "named"     as const, t: "باسم محدد",    s: "اكتب الاسم الذي يظهر للمستلم" },
                ]).map((opt) => {
                  const selected = giftFromMode === opt.k;
                  return (
                    <TouchableOpacity
                      key={opt.k}
                      onPress={() => setGiftFromMode(opt.k)}
                      activeOpacity={0.85}
                      style={[styles.giftFromOpt, selected && styles.giftFromOptOn]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.giftFromTitle, selected && { color: PRIMARY }]}>{opt.t}</Text>
                        <Text style={styles.giftFromSub}>{opt.s}</Text>
                      </View>
                      <Feather
                        name={selected ? "check-circle" : "circle"}
                        size={22}
                        color={selected ? PRIMARY : "rgba(255,255,255,0.35)"}
                      />
                    </TouchableOpacity>
                  );
                })}
                {giftFromMode === "named" && (
                  <View style={styles.reportField}>
                    <Text style={styles.reportLabel}>الاسم الذي يظهر للمستلم</Text>
                    <TextInput
                      style={styles.reportInput}
                      value={giftFromDisplay}
                      onChangeText={setGiftFromDisplay}
                      placeholder="مثال: أحمد"
                      placeholderTextColor="rgba(255,255,255,0.30)"
                      textAlign="right"
                    />
                  </View>
                )}
                <View style={styles.giftNavRow}>
                  <TouchableOpacity style={styles.giftSecondaryBtn} onPress={() => setGiftStep("recipient")}>
                    <Text style={styles.giftSecondaryText}>السابق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.giftPrimaryBtn, { flex: 1, opacity: giftFromMode ? 1 : 0.5 }]}
                    disabled={!giftFromMode}
                    onPress={() => setGiftStep("pay")}
                  >
                    <Text style={styles.giftPrimaryText}>التالي</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {giftStep === "pay" && (
              <>
                <View style={styles.giftSummary}>
                  <View style={styles.giftSumRow}>
                    <Text style={styles.giftSumLabel}>قيمة القسيمة</Text>
                    <Text style={styles.giftSumVal}>{Number(giftAmount).toFixed(3)} ر.ع</Text>
                  </View>
                  <View style={styles.giftSumRow}>
                    <Text style={styles.giftSumLabel}>المُرسَل إليه</Text>
                    <Text style={styles.giftSumVal}>{giftRecName}</Text>
                  </View>
                  <View style={styles.giftSumRow}>
                    <Text style={styles.giftSumLabel}>تظهر له بصيغة</Text>
                    <Text style={styles.giftSumVal}>
                      {giftFromMode === "anonymous" ? "من طرف مجهول"
                        : giftFromMode === "friend" ? "من صديق/ة"
                        : `باسم ${giftFromDisplay || giftSenderName}`}
                    </Text>
                  </View>
                </View>
                <Text style={styles.giftPayHint}>
                  💳 الدفع تجريبي حالياً — اضغط "ادفع الآن" لإتمام طلب القسيمة. سيتواصل معك الكوفي عبر واتساب لتأكيد التسليم.
                </Text>
                <View style={styles.giftNavRow}>
                  <TouchableOpacity style={styles.giftSecondaryBtn} onPress={() => setGiftStep("from")} disabled={giftSending}>
                    <Text style={styles.giftSecondaryText}>السابق</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.giftPrimaryBtn, { flex: 1 }, giftSending && { opacity: 0.6 }]}
                    onPress={submitGift}
                    disabled={giftSending}
                  >
                    {giftSending
                      ? <ActivityIndicator color="#000" />
                      : <Text style={styles.giftPrimaryText}>ادفع الآن {Number(giftAmount).toFixed(3)} ر.ع</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {giftStep === "done" && (
              <>
                <View style={{ alignItems: "center", paddingVertical: 10, gap: 10 }}>
                  <View style={[styles.reportIconWrap, { backgroundColor: "rgba(102,187,106,0.18)", borderColor: "rgba(102,187,106,0.45)" }]}>
                    <Feather name="check" size={26} color="#66BB6A" />
                  </View>
                  <Text style={[styles.reportTitle, { color: "#66BB6A" }]}>تم إرسال طلب القسيمة</Text>
                  <Text style={[styles.reportSub, { textAlign: "center", lineHeight: 20 }]}>
                    سيتواصل معك الكوفي عبر واتساب على الرقم الذي أدخلته،{"\n"}
                    وسنبلّغ {giftRecName} بالقسيمة فور تأكيدها.
                  </Text>
                </View>
                <TouchableOpacity style={styles.giftPrimaryBtn} onPress={closeGift}>
                  <Text style={styles.giftPrimaryText}>تم</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Report modal ── */}
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <TouchableOpacity style={styles.reportClose} onPress={() => setReportOpen(false)}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.reportHeader}>
              <View style={styles.reportIconWrap}>
                <Feather name="flag" size={20} color="#E55353" />
              </View>
              <Text style={styles.reportTitle}>الإبلاغ عن الكوفي</Text>
              <Text style={styles.reportSub}>{cafe.name}</Text>
            </View>

            <View style={styles.reportField}>
              <Text style={styles.reportLabel}>الاسم</Text>
              <TextInput
                style={styles.reportInput}
                value={reportName}
                onChangeText={setReportName}
                placeholder="اسمك الكامل"
                placeholderTextColor="rgba(255,255,255,0.30)"
                textAlign="right"
              />
            </View>

            <View style={styles.reportField}>
              <Text style={styles.reportLabel}>رقم الهاتف</Text>
              <TextInput
                style={styles.reportInput}
                value={reportPhone}
                onChangeText={setReportPhone}
                placeholder="9XXXXXXX"
                placeholderTextColor="rgba(255,255,255,0.30)"
                keyboardType="phone-pad"
                textAlign="right"
              />
            </View>

            <View style={styles.reportField}>
              <Text style={styles.reportLabel}>وصف المشكلة</Text>
              <TextInput
                style={[styles.reportInput, styles.reportTextarea]}
                value={reportDesc}
                onChangeText={setReportDesc}
                placeholder="اشرح ما الذي حصل بالضبط…"
                placeholderTextColor="rgba(255,255,255,0.30)"
                multiline
                textAlignVertical="top"
                textAlign="right"
                maxLength={2000}
              />
            </View>

            <TouchableOpacity
              style={[styles.reportSubmit, reportSending && { opacity: 0.6 }]}
              activeOpacity={0.85}
              disabled={reportSending}
              onPress={submitReport}
            >
              {reportSending
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.reportSubmitText}>إرسال البلاغ</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Hero
  heroWrap: { height: 300, position: "relative" },
  heroImg:  { width: "100%", height: "100%", resizeMode: "cover" },
  gradient: { position: "absolute", bottom: 0, left: 0, right: 0, height: 180 },
  backBtn:  {
    position: "absolute", left: 16,
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  heroInfo: {
    position: "absolute", bottom: 16, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  logoCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
  },
  heroName:     { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 2 },
  heroCategory: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot:  { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Content
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: CARD, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.80)" },
  // Location card
  locationCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  locationRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  locationAddress: { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.70)", flex: 1 },
  distInlineText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  distInlineValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#66BB6A" },
  mapsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  mapsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Rating panel
  ratingCard: {
    backgroundColor: CARD, borderRadius: 18,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 18, paddingVertical: 18,
    marginTop: 14, gap: 10, alignItems: "center",
  },
  ratingHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  ratingSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", textAlign: "center" },
  starsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 4,
  },
  starBtn: { padding: 4 },
  ratingHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)", textAlign: "center", marginTop: 2 },

  // Report cafe button + modal
  reportBtn: {
    marginTop: 6, marginBottom: 4,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "rgba(229,83,83,0.10)",
    borderWidth: 1, borderColor: "rgba(229,83,83,0.35)",
    paddingVertical: 12, borderRadius: 14,
  },
  reportBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E55353" },
  reportOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  reportCard: {
    width: "100%", maxWidth: 440, backgroundColor: "#0F0606",
    borderRadius: 24, padding: 22, gap: 14,
    borderWidth: 1, borderColor: BORDER, position: "relative",
  },
  reportClose: {
    position: "absolute", top: 10, left: 10, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  reportHeader: { alignItems: "center", gap: 6, marginBottom: 4 },
  reportIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(229,83,83,0.15)",
    borderWidth: 1, borderColor: "rgba(229,83,83,0.40)",
    alignItems: "center", justifyContent: "center",
  },
  reportTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  reportSub:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)" },
  reportField: { gap: 6 },
  reportLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  reportInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: "Inter_500Medium", color: "#FFF",
  },
  reportTextarea: { minHeight: 110, paddingTop: 12 },
  reportSubmit: {
    backgroundColor: "#E55353", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 4,
  },
  reportSubmitText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Location permission prompt (bottom sheet)
  promptBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  promptSheet: {
    backgroundColor: "#1A1040",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 28, paddingBottom: 36, paddingTop: 14,
    alignItems: "center",
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  promptPill: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.20)", marginBottom: 24,
  },
  promptIconWrap: { marginBottom: 18 },
  promptIconBg: {
    width: 72, height: 72, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  promptTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center", marginBottom: 10,
  },
  promptBody: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.60)", textAlign: "center",
    lineHeight: 22, marginBottom: 28,
  },
  promptAllowBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: PRIMARY, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 40,
    width: "100%", justifyContent: "center", marginBottom: 12,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  promptAllowText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  promptLaterBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  promptLaterText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
  tagsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: `${PRIMARY}22`, borderRadius: 20,
    borderWidth: 1, borderColor: `${PRIMARY}44`,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 12, fontFamily: "Inter_500Medium", color: PRIMARY },
  divider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.40)", marginBottom: 4 },

  // Actions — grid layout
  actionsTopRow: { flexDirection: "row", gap: 12 },

  // Square cards — 3D stack
  actionSquareWrap: { flex: 1, borderRadius: 22 },

  // Dark depth slab (the "bottom face" of the 3D button)
  actionDepth: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    transform: [{ translateY: 5 }],
  },

  actionSquare: {
    padding: 18, aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 22,
    overflow: "hidden",
    borderTopWidth: 1.5,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
  },

  // Background photo image style (for ImageBackground imageStyle prop)
  actionBgImage: { borderRadius: 22 },

  // Small cart/history overlay badge anchored to the top-left of each big
  // action card (RTL → top-left visually = "leading edge").
  cartBadge: {
    position: "absolute", top: 10, left: 10,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(232,184,109,0.95)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 6,
  },

  // Shimmer sweep strip
  shimmerStrip: {
    position: "absolute", top: -80, bottom: -80,
    width: 55,
    overflow: "visible",
  },

  // Dark overlay — high opacity so photo is subtle background
  actionOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.65)",
  },

  actionSquareLabel: {
    fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Wide card (احجز طاولة)
  actionWideWrap: { borderRadius: 22, marginTop: 14 },

  actionWideDepth: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 22,
    transform: [{ translateY: 5 }],
  },

  actionWide: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32, paddingHorizontal: 24,
    borderRadius: 22, overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.45)",
    shadowColor: "#E8B86D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  actionWideLabel: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: "#E8B86D",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  // Gift voucher card + modal
  giftBtnRow:   { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", paddingHorizontal: 4 },
  giftBtnTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF",
                  textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  giftBtnSub:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", marginTop: 2 },

  giftSteps:    { flexDirection: "row", justifyContent: "center", gap: 6 },
  giftStepDot:  { width: 22, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)" },
  giftStepDotOn:{ backgroundColor: PRIMARY },

  giftPrimaryBtn:  { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  giftPrimaryText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },
  giftSecondaryBtn:  { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 14,
                       backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: BORDER },
  giftSecondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.75)" },
  giftNavRow:        { flexDirection: "row", gap: 10, alignItems: "stretch" },

  giftQuickRow:  { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  giftQuickPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                   backgroundColor: "rgba(232,184,109,0.12)", borderWidth: 1, borderColor: "rgba(232,184,109,0.40)" },
  giftQuickText: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },

  giftFromOpt:   { flexDirection: "row", alignItems: "center", gap: 12,
                   padding: 14, borderRadius: 14,
                   backgroundColor: "rgba(255,255,255,0.04)",
                   borderWidth: 1, borderColor: BORDER },
  giftFromOptOn: { backgroundColor: "rgba(232,184,109,0.10)", borderColor: PRIMARY },
  giftFromTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  giftFromSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },

  giftSummary:  { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: BORDER,
                  borderRadius: 14, padding: 14, gap: 10 },
  giftSumRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  giftSumLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)" },
  giftSumVal:   { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF", flex: 1, textAlign: "left" },
  giftPayHint:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)",
                  textAlign: "center", lineHeight: 18 },
});
