import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
import { apiPost } from "@/constants/api";

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
  return (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemPrice}>{item.price.toFixed(3)} OMR × {item.quantity}</Text>
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
        <Feather name="trash-2" size={15} color="#EF5350" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, cartTotal, cartCount, updateQuantity, removeFromCart, clearCart, addOrder, setActiveOrder } = useApp();
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

  const orderSummary = cart.map(i => `${i.name} ×${i.quantity}`).join("، ");

  const [submitting, setSubmitting] = useState(false);

  // Discount code (optional)
  const [discountCode,    setDiscountCode]    = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountErr,     setDiscountErr]     = useState("");
  const [discountChecking,setDiscountChecking]= useState(false);

  const discountAmount = +(cartTotal * discountPercent / 100).toFixed(3);
  const finalTotal     = +(cartTotal - discountAmount).toFixed(3);

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
      const prepMin  = totalQty * 3; // 3 minutes per item
      const customerName   = isDine ? dineName.trim() : carName.trim();
      const customerNameEn = isDine ? dineNameEn.trim() : carNameEn.trim();
      const customerPhone  = isDine ? dinePhone.trim() : carPhone.trim();
      const payload: any = {
        customerName,
        ...(customerNameEn ? { customerNameEn } : {}),
        customerPhone,
        items: cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price })),
        total: cartTotal,
        type: isDine ? "dine" : "car",
        source: "direct",
        prepMinutes: prepMin,
      };
      if (discountPercent > 0 && discountCode.trim()) {
        payload.discountCode = discountCode.trim();
      }
      if (isDine) {
        payload.tableNumber = dineTable.trim();
      } else {
        payload.plateNumber = carPlateNum.trim();
        payload.plateSymbol = carPlateChar.trim();
      }
      const res = await apiPost<{ order: { id: string; total: number } }>(`/cafe/${cafeId}/orders`, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        drinkQty: totalQty,
        startedAt: Date.now(),
      });
      clearCart();
      router.replace({
        pathname: "/order-timer",
        params: {
          orderId: res.order.id,
          cafeId,
          minutes: String(prepMin),
          drinks: String(totalQty),
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
            <Text style={styles.browseBtnText}>تصفح الكوفيهات</Text>
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
              {cart.map(i => (
                <View key={i.id} style={styles.summaryRow}>
                  <Text style={styles.summaryItem}>{i.name}</Text>
                  <Text style={styles.summaryQty}>×{i.quantity}</Text>
                  <Text style={styles.summaryPrice}>{(i.price * i.quantity).toFixed(3)} OMR</Text>
                </View>
              ))}
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryItem}>المجموع الفرعي</Text>
                <Text style={styles.summaryPrice}>{cartTotal.toFixed(3)} OMR</Text>
              </View>
              {discountPercent > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryItem, { color: SUCCESS }]}>خصم ({discountPercent}%)</Text>
                  <Text style={[styles.summaryPrice, { color: SUCCESS }]}>− {discountAmount.toFixed(3)} OMR</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryItem, { color: "#FFF", fontFamily: "Inter_700Bold" }]}>الإجمالي</Text>
                <Text style={[styles.summaryPrice, { color: PRIMARY, fontFamily: "Inter_700Bold", fontSize: 15 }]}>
                  {finalTotal.toFixed(3)} OMR
                </Text>
              </View>
            </View>
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
  discountWrap:        { gap: 6, marginTop: 4 },
  discountRow:         { flexDirection: "row", gap: 8, alignItems: "stretch" },
  discountBtn:         { paddingHorizontal: 18, justifyContent: "center", alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.12)", minWidth: 80 },
  discountBtnText:     { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },
  discountApplied:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(46,125,50,0.12)", borderWidth: 1, borderColor: "rgba(46,125,50,0.4)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4 },
  discountAppliedText: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold", color: SUCCESS },
  discountErrText:     { fontSize: 12, fontFamily: "Inter_500Medium", color: "#EF5350", marginTop: 4, textAlign: "center" },

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
