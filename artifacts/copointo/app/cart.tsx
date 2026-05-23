import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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
import { useApp } from "@/context/AppContext";
import { apiFetch, apiPost } from "@/constants/api";
import { loadSavedOrderInfo, saveOrderInfo } from "@/lib/savedOrderInfo";

interface HeldFreeCoffee {
  id: string;
  code: string;
  earnedAtLevel: number;
  earnedAt: string;
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
}

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const SUCCESS = "#2E7D32";

type OrderType = "dine" | "car" | null;
type Step      = "cart" | "type" | "form" | "done";

// ─── Field Row ────────────────────────────────────────────────
function Field({
  label, icon, value, onChange, placeholder, keyboardType, maxLength,
}: {
  label: string; icon: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  keyboardType?: any; maxLength?: number;
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={fStyles.label}>{icon}  {label}</Text>
      <TextInput
        style={fStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.28)"
        keyboardType={keyboardType ?? "default"}
        maxLength={maxLength}
        selectionColor={PRIMARY}
      />
    </View>
  );
}

const fStyles = StyleSheet.create({
  wrap:  { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  input: {
    backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: "Inter_500Medium", color: "#FFF",
  },
});

// ─── Cart Item Row ─────────────────────────────────────────────
function CartItemRow({ item, onMinus, onPlus, onRemove }: any) {
  const variantBits: string[] = [];
  if (item.selectedBean) variantBits.push(`☕ ${item.selectedBean}`);
  if (item.selectedSize) variantBits.push(`📏 ${item.selectedSize}`);
  const hasDiscount = item.originalPrice && item.originalPrice > item.price;
  const bonusQty = (item.promoBuyQty && item.promoGetQty)
    ? Math.floor(item.quantity / item.promoBuyQty) * item.promoGetQty
    : 0;
  return (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        {variantBits.length > 0 && (
          <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: PRIMARY, marginTop: 2 }}>
            {variantBits.join("  •  ")}
          </Text>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {hasDiscount && (
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textDecorationLine: "line-through", fontFamily: "Inter_500Medium" }}>
              {Number(item.originalPrice ?? 0).toFixed(3)}
            </Text>
          )}
          <Text style={styles.itemPrice}>{Number(item.price ?? 0).toFixed(3)} OMR × {item.quantity}</Text>
          {hasDiscount && (
            <View style={{ backgroundColor: "rgba(46,125,50,0.18)", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 9, color: SUCCESS, fontFamily: "Inter_700Bold" }}>
                -{Math.round(((Number(item.originalPrice ?? 0) - Number(item.price ?? 0)) / Math.max(1e-9, Number(item.originalPrice ?? 0))) * 100)}%
              </Text>
            </View>
          )}
        </View>
        {bonusQty > 0 && (
          <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY, marginTop: 3 }}>
            🎁 +{bonusQty} مجاني  •  الإجمالي {item.quantity + bonusQty} كوب
          </Text>
        )}
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={onMinus}>
          <Feather name="minus" size={13} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: PRIMARY }]} onPress={onPlus}>
          <Feather name="plus" size={13} color="#FFF" />
        </TouchableOpacity>
      </View>
      <Text style={styles.itemTotal}>{(item.price * item.quantity).toFixed(3)}</Text>
      <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
        <Feather name="trash-2" size={15} color="#E8B86D" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, cart, cartTotal, cartCount, updateQuantity, removeFromCart, clearCart, addOrder, setActiveOrder } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [step,      setStep]      = useState<Step>("cart");
  const [orderType, setOrderType] = useState<OrderType>(null);
  const [typeModal, setTypeModal] = useState(false);

  // Dine-in form
  const [dineName,   setDineName]   = useState("");
  const [dineNameEn, setDineNameEn] = useState("");
  const [dinePhone,  setDinePhone]  = useState("");
  const [dineTable, setDineTable] = useState("");

  // Car form
  const [carName,      setCarName]      = useState("");
  const [carNameEn,    setCarNameEn]    = useState("");
  const [carPhone,     setCarPhone]     = useState("");
  const [carPlateNum,  setCarPlateNum]  = useState("");
  const [carPlateChar, setCarPlateChar] = useState("");

  // Optional free-text notes — bean type, extra heat, customizations, etc.
  const [notes, setNotes] = useState("");

  // ─── Free-coffee redemption ─────────────────────────────────
  // Free coffees the signed-in user holds that were earned at THIS cafe (and
  // are still unredeemed). The customer may apply 1+ of them to qualifying
  // drinks (price ≤ 2 OMR, category ≠ طعام/حلى) at checkout.
  const cartCafeId = cart[0]?.cafeId ?? null;
  const [heldFreeCoffees, setHeldFreeCoffees] = useState<HeldFreeCoffee[]>([]);
  // Indices into the per-cup `drinkRows` list (see below) that the user has
  // chosen to redeem a free coffee against.
  const [pickedRowIdx, setPickedRowIdx] = useState<number[]>([]);
  const [freeModal, setFreeModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const phone = user?.phone?.trim();
    if (!phone || !cartCafeId) { setHeldFreeCoffees([]); return; }
    apiFetch<{ coffees: HeldFreeCoffee[] }>(`/free-coffees?phone=${encodeURIComponent(phone)}`)
      .then(r => {
        if (cancelled) return;
        // STRICT cafe scope: only show free coffees whose earnedAtCafeId
        // matches THIS cafe. Legacy codes with null earnedAtCafeId are not
        // surfaced (they cannot be redeemed anywhere under the new rule).
        const eligible = (r.coffees ?? []).filter(
          c => !c.redeemedAt && c.earnedAtCafeId === cartCafeId,
        );
        setHeldFreeCoffees(eligible);
      })
      .catch(() => { if (!cancelled) setHeldFreeCoffees([]); });
    return () => { cancelled = true; };
  }, [user?.phone, cartCafeId]);

  // Reset picks if cart contents change (item removed, qty changed, etc).
  useEffect(() => { setPickedRowIdx([]); }, [cart]);

  // Per-cup expansion of qualifying drinks: each row = one cup that a free
  // coffee can be applied to. Mirrors the rule used by the admin's old
  // free-coffee modal so the price/category logic stays consistent.
  const drinkRows = React.useMemo(() => {
    const rows: { idx: number; itemId: string; name: string; price: number }[] = [];
    cart.forEach(it => {
      const cat = String(it.category ?? "");
      if (cat === "طعام" || cat === "حلى") return;
      if (it.price > 2) return;
      for (let k = 0; k < it.quantity; k++) {
        rows.push({ idx: rows.length, itemId: it.id, name: it.name, price: it.price });
      }
    });
    return rows;
  }, [cart]);

  const maxPicks = Math.min(heldFreeCoffees.length, drinkRows.length);
  const validPicks = pickedRowIdx.filter(i => i < drinkRows.length).slice(0, maxPicks);
  const freeCoffeeDiscount = +validPicks
    .reduce((s, i) => s + (drinkRows[i]?.price ?? 0), 0)
    .toFixed(3);

  // Prefill from previously saved info (after the user's first order)
  useEffect(() => {
    let cancelled = false;
    loadSavedOrderInfo().then((s) => {
      if (cancelled) return;
      if (s.dineName)     setDineName(s.dineName);
      if (s.dineNameEn)   setDineNameEn(s.dineNameEn);
      if (s.dinePhone)    setDinePhone(s.dinePhone);
      if (s.dineTable)    setDineTable(s.dineTable);
      if (s.carName)      setCarName(s.carName);
      if (s.carNameEn)    setCarNameEn(s.carNameEn);
      if (s.carPhone)     setCarPhone(s.carPhone);
      if (s.carPlateNum)  setCarPlateNum(s.carPlateNum);
      if (s.carPlateChar) setCarPlateChar(s.carPlateChar);
    });
    return () => { cancelled = true; };
  }, []);

  const orderSummary = cart.map(i => `${i.name} ×${i.quantity}`).join("، ");

  const [submitting, setSubmitting] = useState(false);

  // Discount code (optional)
  const [discountCode,    setDiscountCode]    = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountErr,     setDiscountErr]     = useState("");
  const [discountChecking,setDiscountChecking]= useState(false);

  const discountAmount = +(cartTotal * discountPercent / 100).toFixed(3);
  const finalTotal     = Math.max(0, +(cartTotal - discountAmount - freeCoffeeDiscount).toFixed(3));

  // Total savings from per-product discounts (originalPrice → price). This is
  // already baked into `cartTotal` (since `price` is the discounted one), but
  // we surface it as an "وفّرت" line so the customer sees the value of the
  // cafe's in-product promos before any code/free-coffee is applied.
  const productSavings = +cart.reduce((s, i) => {
    if (i.originalPrice && i.originalPrice > i.price) {
      return s + (i.originalPrice - i.price) * i.quantity;
    }
    return s;
  }, 0).toFixed(3);

  // Total bonus drinks the customer gets from "buy X get Y" promos.
  const totalBonusQty = cart.reduce((s, i) => {
    if (i.promoBuyQty && i.promoGetQty) {
      return s + Math.floor(i.quantity / i.promoBuyQty) * i.promoGetQty;
    }
    return s;
  }, 0);

  const applyCode = async () => {
    setDiscountErr("");
    const trimmed = discountCode.trim();
    if (!/^\d+$/.test(trimmed)) { setDiscountErr("الكود يجب أن يكون أرقام فقط"); return; }
    setDiscountChecking(true);
    try {
      const cafeId = cart[0].cafeId;
      const r = await apiPost<{ valid: boolean; percent: number }>(
        `/cafe/${cafeId}/discount-codes/validate`,
        { code: trimmed },
      );
      if (r.valid) {
        setDiscountPercent(r.percent);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setDiscountPercent(0);
        setDiscountErr("كود التخفيض غير صالح أو منتهي");
      }
    } catch (e: any) {
      setDiscountPercent(0);
      const msg = e?.message ?? "";
      try { setDiscountErr(JSON.parse(msg).error || "كود التخفيض غير صالح"); }
      catch { setDiscountErr("كود التخفيض غير صالح"); }
    } finally { setDiscountChecking(false); }
  };

  const clearDiscount = () => { setDiscountCode(""); setDiscountPercent(0); setDiscountErr(""); };

  const submitOrder = async () => {
    const isDine = orderType === "dine";
    if (isDine) {
      if (!dineName.trim() || !dinePhone.trim() || !dineTable.trim()) {
        Alert.alert("تنبيه", "يرجى تعبئة جميع الحقول"); return;
      }
    } else {
      if (!carName.trim() || !carPhone.trim() || !carPlateNum.trim() || !carPlateChar.trim()) {
        Alert.alert("تنبيه", "يرجى تعبئة جميع الحقول"); return;
      }
    }
    setSubmitting(true);
    try {
      const cafeId   = cart[0].cafeId;
      const cafeName = cart[0].cafeName;
      const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
      // Drink-only count for game/level progress. حلى و طعام لا تزيد المستوى
      // ولا عدد الكوفي — يجب أن يطابق السيرفر (awardOrderProgress).
      const drinkQty = cart.reduce(
        (s, i) => s + (i.category === "مشروب ساخن" || i.category === "مشروبات باردة" ? i.quantity : 0),
        0,
      );
      const prepMin  = totalQty * 3; // 3 minutes per item
      const customerName   = isDine ? dineName.trim() : carName.trim();
      const customerNameEn = isDine ? dineNameEn.trim() : carNameEn.trim();
      const customerPhone  = isDine ? dinePhone.trim() : carPhone.trim();
      const payload: any = {
        customerName,
        ...(customerNameEn ? { customerNameEn } : {}),
        customerPhone,
        items: cart.map(i => {
          const bonus = (i.promoBuyQty && i.promoGetQty)
            ? Math.floor(i.quantity / i.promoBuyQty) * i.promoGetQty
            : 0;
          return {
            name: i.name, qty: i.quantity, price: i.price,
            ...(i.category ? { category: i.category } : {}),
            ...(i.selectedBean ? { selectedBean: i.selectedBean } : {}),
            ...(i.selectedSize ? { selectedSize: i.selectedSize } : {}),
            ...(typeof i.sizeExtraPrice === "number" ? { sizeExtraPrice: i.sizeExtraPrice } : {}),
            ...(i.originalPrice && i.originalPrice > i.price ? { originalPrice: i.originalPrice } : {}),
            ...(i.promoBuyQty && i.promoGetQty
              ? { promoBuyQty: i.promoBuyQty, promoGetQty: i.promoGetQty, bonusQty: bonus }
              : {}),
          };
        }),
        total: cartTotal,
        type: isDine ? "dine" : "car",
        source: "direct",
        prepMinutes: prepMin,
      };
      if (discountPercent > 0 && discountCode.trim()) {
        payload.discountCode = discountCode.trim();
      }
      if (notes.trim()) {
        payload.notes = notes.trim();
      }
      // Build free-coffee redemptions: one entry per picked drink-cup, paired
      // with one held free-coffee code (oldest first so older codes are used
      // before newer ones).
      if (validPicks.length > 0 && heldFreeCoffees.length > 0) {
        const codesAsc = [...heldFreeCoffees]
          .sort((a, b) => a.earnedAt.localeCompare(b.earnedAt))
          .slice(0, validPicks.length);
        payload.freeCoffeeRedemptions = validPicks.map((rowIdx, i) => ({
          code:      codesAsc[i].code,
          itemName:  drinkRows[rowIdx].name,
          itemPrice: drinkRows[rowIdx].price,
        }));
      }
      if (isDine) {
        payload.tableNumber = dineTable.trim();
      } else {
        payload.plateNumber = carPlateNum.trim();
        payload.plateSymbol = carPlateChar.trim();
      }
      const res = await apiPost<{ order: { id: string; total: number } }>(`/cafe/${cafeId}/orders`, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Persist the customer info so future orders are pre-filled
      if (isDine) {
        saveOrderInfo({
          dineName:   dineName.trim(),
          dineNameEn: dineNameEn.trim(),
          dinePhone:  dinePhone.trim(),
          dineTable:  dineTable.trim(),
        });
      } else {
        saveOrderInfo({
          carName:      carName.trim(),
          carNameEn:    carNameEn.trim(),
          carPhone:     carPhone.trim(),
          carPlateNum:  carPlateNum.trim(),
          carPlateChar: carPlateChar.trim(),
        });
      }
      addOrder({
        id: res.order.id,
        cafeId,
        cafeName,
        items: cart,
        total: res.order.total ?? finalTotal,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setActiveOrder({
        orderId: res.order.id,
        cafeId,
        cafeName,
        prepMinutes: prepMin,
        drinkQty,
        startedAt: Date.now(),
      });
      clearCart();
      router.replace({
        pathname: "/order-timer",
        params: {
          orderId: res.order.id,
          cafeId,
          cafeName,
          minutes: String(prepMin),
          drinks: String(drinkQty),
        },
      });
    } catch (e: any) {
      Alert.alert("تعذّر إرسال الطلب", e?.message ?? "حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Empty cart ──
  if (cart.length === 0 && step !== "done") {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>السلة</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 64 }}>🛒</Text>
          <Text style={styles.emptyTitle}>السلة فارغة</Text>
          <Text style={styles.emptyText}>أضف طلبات من قائمة الكوفي</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.back()}>
            <Text style={styles.browseBtnText}>تصفح الكافيهات</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Success ──
  if (step === "done") {
    return (
      <View style={[styles.container, { paddingTop: topPad, justifyContent: "center", alignItems: "center", gap: 20, paddingHorizontal: 32 }]}>
        <View style={styles.successCircle}>
          <Text style={{ fontSize: 48 }}>✅</Text>
        </View>
        <Text style={styles.successTitle}>تم إرسال طلبك!</Text>
        <Text style={styles.successSub}>
          {orderType === "dine"
            ? `سيصلك طلبك على الطاولة رقم ${dineTable} قريباً`
            : "سنحضر طلبك إلى سيارتك قريباً"}
        </Text>
        <TouchableOpacity
          style={[styles.browseBtn, { marginTop: 12 }]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.browseBtnText}>العودة للرئيسية</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Form ──
  if (step === "form") {
    const isDine = orderType === "dine";
    return (
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: topPad }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep("type")}>
            <Feather name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isDine ? "طلب داخل الكوفي" : "طلب في السيارة"}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.formContent, { paddingBottom: botPad + 30 }]}
        >
          {/* Icon banner */}
          <LinearGradient
            colors={isDine ? ["#C67C4E", "#8B4513"] : ["#1A3A6B", "#0D1F3C"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.formBanner}
          >
            <Text style={{ fontSize: 42 }}>{isDine ? "🪑" : "🚗"}</Text>
            <View>
              <Text style={styles.bannerTitle}>{isDine ? "طلب داخل الكوفي" : "طلب في السيارة"}</Text>
              <Text style={styles.bannerSub}>{isDine ? "سنحضر طلبك لطاولتك" : "ابق في سيارتك وانتظر"}</Text>
            </View>
          </LinearGradient>

          {/* Fields */}
          <View style={styles.fields}>
            <Field
              label="الاسم الكامل" icon="👤"
              value={isDine ? dineName : carName}
              onChange={isDine ? setDineName : setCarName}
              placeholder="أدخل اسمك الكامل"
            />
            <Field
              label="Full Name (English)" icon="🔤"
              value={isDine ? dineNameEn : carNameEn}
              onChange={isDine ? setDineNameEn : setCarNameEn}
              placeholder="Enter your name in English"
            />
            <Field
              label="رقم الهاتف" icon="📞"
              value={isDine ? dinePhone : carPhone}
              onChange={isDine ? setDinePhone : setCarPhone}
              placeholder="9XXXXXXXX"
              keyboardType="phone-pad"
              maxLength={12}
            />
            {isDine ? (
              <Field
                label="رقم الطاولة" icon="🪑"
                value={dineTable}
                onChange={setDineTable}
                placeholder="مثال: 12"
                keyboardType="number-pad"
                maxLength={3}
              />
            ) : (
              /* License plate: number + arabic chars */
              <View style={styles.plateWrap}>
                <Text style={styles.plateLabel}>🚗  رقم لوحة السيارة</Text>
                <View style={styles.plateRow}>
                  {/* Number part */}
                  <View style={[styles.plateBox, { flex: 1.2 }]}>
                    <Text style={styles.plateBoxLabel}>الأرقام</Text>
                    <TextInput
                      style={styles.plateInput}
                      value={carPlateNum}
                      onChangeText={setCarPlateNum}
                      placeholder="12345"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      keyboardType="number-pad"
                      maxLength={5}
                      selectionColor={PRIMARY}
                    />
                  </View>
                  {/* Divider */}
                  <View style={styles.plateDivider} />
                  {/* Char part */}
                  <View style={[styles.plateBox, { flex: 1 }]}>
                    <Text style={styles.plateBoxLabel}>الحروف</Text>
                    <TextInput
                      style={[styles.plateInput, { fontSize: 20 }]}
                      value={carPlateChar}
                      onChangeText={setCarPlateChar}
                      placeholder="ب ق ر"
                      placeholderTextColor="rgba(255,255,255,0.28)"
                      maxLength={5}
                      selectionColor={PRIMARY}
                    />
                  </View>
                  {/* Oman flag */}
                  <View style={styles.plateFlag}>
                    <Text style={{ fontSize: 22 }}>🇴🇲</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Notes (optional) — bean type, extra heat, customizations */}
            <View style={styles.notesWrap}>
              <Text style={fStyles.label}>📝  ملاحظات إضافية (اختياري)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="مثال: نوع البن، زيادة سخونة، بدون سكر…"
                placeholderTextColor="rgba(255,255,255,0.28)"
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
                selectionColor={PRIMARY}
              />
              <Text style={styles.notesHint}>{notes.length}/300</Text>
            </View>

            {/* Discount code (optional) */}
            <View style={styles.discountWrap}>
              <Text style={fStyles.label}>🏷️  كود التخفيض (اختياري)</Text>
              <View style={styles.discountRow}>
                <TextInput
                  style={[fStyles.input, { flex: 1, textAlign: "center", letterSpacing: 3 }]}
                  value={discountCode}
                  onChangeText={t => { setDiscountCode(t.replace(/\D/g, "")); if (discountPercent>0) setDiscountPercent(0); setDiscountErr(""); }}
                  placeholder="أدخل الكود"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  keyboardType="number-pad"
                  maxLength={20}
                  selectionColor={PRIMARY}
                  editable={discountPercent === 0}
                />
                {discountPercent === 0 ? (
                  <TouchableOpacity
                    style={[styles.discountBtn, (!discountCode.trim() || discountChecking) && { opacity: 0.5 }]}
                    onPress={applyCode}
                    disabled={!discountCode.trim() || discountChecking}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.discountBtnText}>
                      {discountChecking ? "..." : "تطبيق"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.discountBtn, { backgroundColor: "rgba(239,83,80,0.15)", borderColor: "rgba(239,83,80,0.4)" }]}
                    onPress={clearDiscount}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.discountBtnText, { color: "#EF5350" }]}>إزالة</Text>
                  </TouchableOpacity>
                )}
              </View>
              {discountPercent > 0 && (
                <View style={styles.discountApplied}>
                  <Feather name="check-circle" size={14} color={SUCCESS} />
                  <Text style={styles.discountAppliedText}>
                    تم تطبيق خصم {discountPercent}%  •  وفّرت {discountAmount.toFixed(3)} OMR
                  </Text>
                </View>
              )}
              {discountErr !== "" && (
                <Text style={styles.discountErrText}>{discountErr}</Text>
              )}
            </View>

            {/* Order summary */}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryBoxTitle}>📋  تفاصيل الطلب</Text>
              {cart.map(i => {
                const bonus = (i.promoBuyQty && i.promoGetQty)
                  ? Math.floor(i.quantity / i.promoBuyQty) * i.promoGetQty
                  : 0;
                const hasDisc = i.originalPrice && i.originalPrice > i.price;
                return (
                  <View key={i.id} style={[styles.summaryRow, { flexWrap: "wrap" }]}>
                    <Text style={styles.summaryItem}>
                      {i.name}
                      {bonus > 0 ? `  🎁 +${bonus} مجاني` : ""}
                    </Text>
                    <Text style={styles.summaryQty}>×{i.quantity}{bonus > 0 ? ` (+${bonus})` : ""}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      {hasDisc && (
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textDecorationLine: "line-through", fontFamily: "Inter_500Medium" }}>
                          {(i.originalPrice! * i.quantity).toFixed(3)}
                        </Text>
                      )}
                      <Text style={styles.summaryPrice}>{(i.price * i.quantity).toFixed(3)} OMR</Text>
                    </View>
                  </View>
                );
              })}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>المجموع الفرعي</Text>
                <Text style={styles.summaryPrice}>{cartTotal.toFixed(3)} OMR</Text>
              </View>
              {productSavings > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItem, { color: SUCCESS }]}>وفّرت من تخفيضات الكوفي</Text>
                  <Text style={[styles.summaryPrice, { color: SUCCESS }]}>− {productSavings.toFixed(3)} OMR</Text>
                </View>
              )}
              {totalBonusQty > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItem, { color: PRIMARY }]}>🎁 مشروبات مجانية (عرض اشترِ X احصل على Y)</Text>
                  <Text style={[styles.summaryPrice, { color: PRIMARY }]}>+{totalBonusQty} مجاناً</Text>
                </View>
              )}
              {discountPercent > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItem, { color: SUCCESS }]}>خصم ({discountPercent}%)</Text>
                  <Text style={[styles.summaryPrice, { color: SUCCESS }]}>− {discountAmount.toFixed(3)} OMR</Text>
                </View>
              )}
              {validPicks.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItem, { color: PRIMARY }]}>
                    🎁 كوفي مجاني ({validPicks.length})
                  </Text>
                  <Text style={[styles.summaryPrice, { color: PRIMARY }]}>− {freeCoffeeDiscount.toFixed(3)} OMR</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryItem, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>الإجمالي</Text>
                <Text style={[styles.summaryPrice, { color: PRIMARY, fontFamily: "Inter_700Bold", fontSize: 15 }]}>
                  {finalTotal.toFixed(3)} OMR
                </Text>
              </View>
            </View>

            {/* Free-coffee redemption (only when user actually has any from this cafe) */}
            {heldFreeCoffees.length > 0 && drinkRows.length > 0 && (
              <TouchableOpacity
                style={styles.freeCoffeeBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFreeModal(true); }}
                activeOpacity={0.85}
              >
                <Text style={styles.freeCoffeeBtnIcon}>🎁</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.freeCoffeeBtnTitle}>
                    {validPicks.length > 0
                      ? `تم تطبيق ${validPicks.length} كوفي مجاني`
                      : `لديك ${heldFreeCoffees.length} كوفي مجاني — استخدمه الآن`}
                  </Text>
                  <Text style={styles.freeCoffeeBtnSub}>
                    {validPicks.length > 0
                      ? `وفّرت ${freeCoffeeDiscount.toFixed(3)} OMR — اضغط للتعديل`
                      : "ينطبق على المشروبات ≤ 2 ر.ع. (بدون أطعمة أو حلى)"}
                  </Text>
                </View>
                <Feather name="chevron-left" size={18} color={PRIMARY} />
              </TouchableOpacity>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={submitOrder} activeOpacity={0.88} disabled={submitting}>
            <LinearGradient
              colors={submitting ? ["#555", "#333"] : [PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.submitGrad}
            >
              <Text style={[styles.submitText, { color: "#000" }]}>
                {submitting ? "جاري الإرسال..." : `الانتهاء من الطلب  •  ${finalTotal.toFixed(3)} OMR`}
              </Text>
              {!submitting && <Feather name="check-circle" size={18} color="#000" />}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>

        {/* Free-coffee picker modal */}
        <Modal visible={freeModal} transparent animationType="slide" onRequestClose={() => setFreeModal(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFreeModal(false)} />
          <View style={[styles.freeSheet, { paddingBottom: botPad + 16 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>🎁  استخدام كوفي مجاني</Text>
            <Text style={styles.sheetSub}>
              لديك {heldFreeCoffees.length} كوفي مجاني من{" "}
              {heldFreeCoffees[0]?.earnedAtCafeName ?? cart[0]?.cafeName ?? "هذا الكوفي"}
              {"  •  "}اختر حتى {maxPicks} مشروب
            </Text>
            <View style={styles.freeRules}>
              <Text style={styles.freeRulesText}>
                • مشروبات فقط — لا أطعمة أو حلى{"\n"}
                • سعر المشروب ≤ 2 ر.ع.{"\n"}
                • كل كوفي مجاني يُستخدم مرة واحدة
              </Text>
            </View>

            {drinkRows.length === 0 ? (
              <View style={styles.freeEmpty}>
                <Text style={styles.freeEmptyIcon}>☕</Text>
                <Text style={styles.freeEmptyText}>
                  لا يوجد في سلتك مشروب مؤهل لاستخدام الكوفي المجاني
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {drinkRows.map(row => {
                  const idxInPicks = pickedRowIdx.indexOf(row.idx);
                  const picked = idxInPicks >= 0;
                  const atCap = !picked && pickedRowIdx.length >= maxPicks;
                  return (
                    <TouchableOpacity
                      key={row.idx}
                      style={[
                        styles.freeRow,
                        picked && styles.freeRowPicked,
                        atCap   && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        if (atCap) return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPickedRowIdx(prev =>
                          picked ? prev.filter(i => i !== row.idx) : [...prev, row.idx],
                        );
                      }}
                      activeOpacity={0.85}
                      disabled={atCap}
                    >
                      <View style={[styles.freeCheck, picked && { backgroundColor: PRIMARY, borderColor: PRIMARY }]}>
                        {picked && <Feather name="check" size={14} color="#000" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.freeRowName}>{row.name}</Text>
                        <Text style={styles.freeRowPrice}>{row.price.toFixed(3)} OMR</Text>
                      </View>
                      {picked && <Text style={styles.freeRowFree}>مجاني</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.freeSheetBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
                onPress={() => { setPickedRowIdx([]); setFreeModal(false); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.freeSheetBtnText, { color: "#FFF" }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.freeSheetBtn, { backgroundColor: PRIMARY }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFreeModal(false); }}
                activeOpacity={0.9}
              >
                <Text style={[styles.freeSheetBtnText, { color: "#000" }]}>
                  {validPicks.length > 0
                    ? `تأكيد  •  وفّر ${freeCoffeeDiscount.toFixed(3)} OMR`
                    : "تم"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    );
  }

  // ── Cart ──
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>السلة ({cartCount})</Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={styles.clearText}>مسح</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad + 110 }}
      >
        {/* Cafe label */}
        <View style={styles.cafeLabel}>
          <Text style={{ fontSize: 18 }}>☕</Text>
          <Text style={styles.cafeLabelText}>{cart[0]?.cafeName}</Text>
        </View>

        {/* Items */}
        {cart.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            onMinus={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.id, item.quantity - 1); }}
            onPlus={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateQuantity(item.id, item.quantity + 1); }}
            onRemove={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); removeFromCart(item.id); }}
          />
        ))}

        {/* Summary */}
        <View style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المجموع</Text>
            <Text style={styles.totalValue}>{cartTotal.toFixed(3)} OMR</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: botPad + 12 }]}>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTypeModal(true); }}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={["#C67C4E", "#8B4513"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.checkoutGrad}
          >
            <Text style={styles.checkoutText}>اطلب الان  •  {cartTotal.toFixed(3)} OMR</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Order Type Modal */}
      <Modal visible={typeModal} transparent animationType="slide" onRequestClose={() => setTypeModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setTypeModal(false)} />
        <View style={[styles.typeSheet, { paddingBottom: botPad + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>كيف تريد طلبك؟</Text>
          <Text style={styles.sheetSub}>اختر طريقة الاستلام</Text>

          <View style={styles.typeCards}>
            {/* Dine In */}
            <TouchableOpacity
              style={styles.typeCardWrap}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setOrderType("dine");
                setTypeModal(false);
                setStep("form");
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#C67C4E", "#8B4513"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.typeCard}
              >
                <Text style={styles.typeIcon}>🪑</Text>
                <Text style={styles.typeLabel}>داخل الكوفي</Text>
                <Text style={styles.typeSub}>استلام على الطاولة</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Car */}
            <TouchableOpacity
              style={styles.typeCardWrap}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setOrderType("car");
                setTypeModal(false);
                setStep("form");
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#1A3A6B", "#0D1F3C"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.typeCard}
              >
                <Text style={styles.typeIcon}>🚗</Text>
                <Text style={styles.typeLabel}>في السيارة</Text>
                <Text style={styles.typeSub}>ابق بسيارتك وانتظر</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  clearText:   { fontSize: 14, fontFamily: "Inter_500Medium", color: "#EF5350" },

  // Empty
  emptyWrap:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 40 },
  emptyTitle:    { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptyText:     { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", textAlign: "center" },
  browseBtn:     { backgroundColor: PRIMARY, borderRadius: 16, paddingHorizontal: 28, paddingVertical: 14 },
  browseBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Cafe label
  cafeLabel:     { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 12, marginBottom: 14, marginTop: 12 },
  cafeLabelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Cart item
  cartItem:  { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 14, marginBottom: 10 },
  itemInfo:  { flex: 1 },
  itemName:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF", marginBottom: 3 },
  itemPrice: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  qtyRow:    { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn:    { width: 28, height: 28, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  qtyText:   { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", minWidth: 20, textAlign: "center" },
  itemTotal: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", minWidth: 50, textAlign: "right" },

  // Discount code
  notesWrap:           { gap: 6, marginTop: 4 },
  notesInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.25)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 78,
    textAlign: "right",
  },
  notesHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.4)", textAlign: "left" },
  discountWrap:        { gap: 6, marginTop: 4 },
  discountRow:         { flexDirection: "row", gap: 8, alignItems: "stretch" },
  discountBtn:         { paddingHorizontal: 18, justifyContent: "center", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.12)", minWidth: 80 },
  discountBtnText:     { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },
  discountApplied:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(46,125,50,0.12)", borderWidth: 1, borderColor: "rgba(46,125,50,0.4)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  discountAppliedText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: SUCCESS },
  discountErrText:     { fontSize: 12, fontFamily: "Inter_500Medium", color: "#EF5350", marginTop: 4, textAlign: "center" },

  // Free-coffee picker
  freeCoffeeBtn:      { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.10)" },
  freeCoffeeBtnIcon:  { fontSize: 24 },
  freeCoffeeBtnTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY, marginBottom: 2 },
  freeCoffeeBtnSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  freeSheet: {
    backgroundColor: "#13102B",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: BORDER, borderBottomWidth: 0,
    position: "absolute", bottom: 0, left: 0, right: 0,
  },
  freeRules:       { backgroundColor: "rgba(232,184,109,0.08)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(232,184,109,0.30)", padding: 12, marginBottom: 14 },
  freeRulesText:   { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)", lineHeight: 22 },
  freeEmpty:       { alignItems: "center", paddingVertical: 30, gap: 8 },
  freeEmptyIcon:   { fontSize: 42 },
  freeEmptyText:   { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.55)", textAlign: "center", paddingHorizontal: 20 },
  freeRow:         { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, marginBottom: 8 },
  freeRowPicked:   { borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.10)" },
  freeCheck:       { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.30)", alignItems: "center", justifyContent: "center" },
  freeRowName:     { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  freeRowPrice:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  freeRowFree:     { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(232,184,109,0.20)" },
  freeSheetBtn:    { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  freeSheetBtnText:{ fontSize: 14, fontFamily: "Inter_700Bold" },

  // Total card
  totalCard:  { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, marginTop: 8 },
  totalRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  totalValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Footer
  footer:        { paddingHorizontal: 16, paddingTop: 12 },
  checkoutBtn:   { borderRadius: 18, overflow: "hidden" },
  checkoutGrad:  { height: 58, alignItems: "center", justifyContent: "center" },
  checkoutText:  { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Type modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  typeSheet: {
    backgroundColor: "#13102B",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: BORDER, borderBottomWidth: 0,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.20)", marginBottom: 20 },
  sheetTitle:  { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 4 },
  sheetSub:    { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", marginBottom: 24 },
  typeCards:   { flexDirection: "row", gap: 14 },
  typeCardWrap: { flex: 1, borderRadius: 20, overflow: "hidden" },
  typeCard:    { padding: 20, minHeight: 140, justifyContent: "flex-end", gap: 6 },
  typeIcon:    { fontSize: 38, marginBottom: 8 },
  typeLabel:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  typeSub:     { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },

  // Form
  formContent: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  formBanner:  { borderRadius: 20, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 4 },
  bannerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  bannerSub:   { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)" },
  fields:      { gap: 14 },

  // Plate
  plateWrap:      { gap: 6 },
  plateLabel:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },
  plateRow:       { flexDirection: "row", alignItems: "center", backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BORDER, overflow: "hidden" },
  plateBox:       { padding: 14, gap: 4 },
  plateBoxLabel:  { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.40)" },
  plateInput:     { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", padding: 0 },
  plateDivider:   { width: 1, height: 50, backgroundColor: BORDER },
  plateFlag:      { paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },

  // Order summary box
  summaryBox:     { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 10 },
  summaryBoxTitle:{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  summaryRow:     { flexDirection: "row", alignItems: "center", gap: 8 },
  summaryItem:    { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.75)" },
  summaryQty:     { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.45)" },
  summaryPrice:   { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  summaryDivider: { height: 1, backgroundColor: BORDER },

  // Submit
  submitBtn:   { borderRadius: 18, overflow: "hidden", marginTop: 6 },
  submitGrad:  { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  submitText:  { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Success
  successCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(46,125,50,0.15)", alignItems: "center", justifyContent: "center" },
  successTitle:  { fontSize: 26, fontFamily: "Inter_700Bold", color: "#FFF" },
  successSub:    { fontSize: 15, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },
});
