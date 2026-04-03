import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Product } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";

const CATEGORY_ICONS: Record<string, string> = {
  hot: "☕",
  cold: "🧊",
  dessert: "🍰",
};

interface ProductCardProps {
  product: Product;
  cafeName: string;
}

export function ProductCard({ product, cafeName }: ProductCardProps) {
  const colors = useColors();
  const { addToCart, cart } = useApp();

  const cartItem = cart.find((i) => i.id === product.id);
  const inCart = !!cartItem;

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      cafeId: product.cafeId,
      cafeName,
    });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{CATEGORY_ICONS[product.category]}</Text>
        {product.isPopular && (
          <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.popularText, { color: colors.primaryForeground }]}>Popular</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
          {product.description}
        </Text>
        <View style={styles.bottom}>
          <Text style={[styles.price, { color: colors.primary }]}>
            {product.price.toFixed(3)} OMR
          </Text>
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: inCart ? colors.secondary : colors.primary,
              },
            ]}
            onPress={handleAdd}
            activeOpacity={0.8}
          >
            {inCart ? (
              <View style={styles.addBtnContent}>
                <Feather name="check" size={14} color={colors.primary} />
                <Text style={[styles.addBtnText, { color: colors.primary }]}>
                  {cartItem!.quantity}
                </Text>
              </View>
            ) : (
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    padding: 12,
    gap: 12,
    alignItems: "center",
  },
  iconBox: {
    width: 68,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#FFF8F0",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  icon: {
    fontSize: 32,
  },
  popularBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  popularText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 8,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
});
