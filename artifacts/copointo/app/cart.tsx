import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, cartTotal, cartCount, updateQuantity, removeFromCart, clearCart, addOrder } = useApp();

  const topPadding = Platform.OS === "web" ? 67 : insets.top;
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  const handleCheckout = () => {
    if (cart.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addOrder({
      id: Date.now().toString(),
      cafeId: cart[0].cafeId,
      cafeName: cart[0].cafeName,
      items: cart,
      total: cartTotal,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    clearCart();
    Alert.alert(
      "Order Placed!",
      "Your order has been sent to the cafe. You'll get a notification when it's ready.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  };

  if (cart.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Cart</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.empty}>
          <Text style={{ fontSize: 64 }}>🛒</Text>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Add items from a cafe to get started
          </Text>
          <TouchableOpacity
            style={[styles.browseBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.browseBtnText, { color: colors.primaryForeground }]}>
              Browse Cafes
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
        <Text style={[styles.title, { color: colors.foreground }]}>
          Cart ({cartCount})
        </Text>
        <TouchableOpacity onPress={clearCart}>
          <Text style={[styles.clearBtn, { color: colors.destructive }]}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPadding + 100 }}
      >
        <View style={[styles.cafeLabel, { backgroundColor: colors.secondary }]}>
          <Text style={{ fontSize: 16 }}>☕</Text>
          <Text style={[styles.cafeLabelText, { color: colors.secondaryForeground }]}>
            {cart[0].cafeName}
          </Text>
        </View>

        {cart.map((item) => (
          <View
            key={item.id}
            style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.itemPrice, { color: colors.primary }]}>
                {item.price.toFixed(3)} OMR each
              </Text>
            </View>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateQuantity(item.id, item.quantity - 1);
                }}
              >
                <Feather name="minus" size={14} color={colors.secondaryForeground} />
              </TouchableOpacity>
              <Text style={[styles.qty, { color: colors.foreground }]}>{item.quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  updateQuantity(item.id, item.quantity + 1);
                }}
              >
                <Feather name="plus" size={14} color={colors.primaryForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.itemTotal, { color: colors.foreground }]}>
              {(item.price * item.quantity).toFixed(3)}
            </Text>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                removeFromCart(item.id);
              }}
            >
              <Feather name="trash-2" size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Subtotal</Text>
            <Text style={[styles.summaryValue, { color: colors.foreground }]}>
              {cartTotal.toFixed(3)} OMR
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Delivery</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>Free</Text>
          </View>
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {cartTotal.toFixed(3)} OMR
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomPadding + 12 }]}>
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
          onPress={handleCheckout}
        >
          <Text style={[styles.checkoutText, { color: colors.primaryForeground }]}>
            Place Order • {cartTotal.toFixed(3)} OMR
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  clearBtn: { fontSize: 14, fontFamily: "Inter_500Medium" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  browseBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  browseBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  cafeLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 14,
    marginTop: 8,
  },
  cafeLabelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  itemPrice: { fontSize: 13, fontFamily: "Inter_400Regular" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  qty: { fontSize: 16, fontFamily: "Inter_700Bold", minWidth: 20, textAlign: "center" },
  itemTotal: { fontSize: 15, fontFamily: "Inter_700Bold", minWidth: 55, textAlign: "right" },
  removeBtn: { padding: 4 },
  summary: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  totalValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  checkoutBtn: {
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  checkoutText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
