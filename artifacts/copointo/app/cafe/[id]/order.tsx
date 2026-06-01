import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { CAFES } from "@/data/mockData";
import { apiFetch } from "@/constants/api";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.25)";
const PRIMARY = "#E8B86D";
const CREAM   = "#F5E6CC";

interface MenuItem {
  id: string;
  cafeId: string;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
  createdAt: string;
  image?: string | null;
  originalPrice?: number | null;
  promoBuyQty?: number | null;
  promoGetQty?: number | null;
  stockQty?: number | null;
  initialStockQty?: number | null;
  beans?: string[];
  beansRequired?: boolean;
  sizes?: { label: string; extraPrice: number }[];
  sizesRequired?: boolean;
}

const ALL_KEY = "الكل";
const CATEGORIES: { key: string; icon: string }[] = [
  { key: ALL_KEY,         icon: "⭐" },
  { key: "مشروبات باردة", icon: "🥤" },
  { key: "مشروب ساخن",   icon: "☕" },
  { key: "حلى",          icon: "🍰" },
  { key: "طعام",         icon: "🍽️" },
];

const CATEGORY_ICONS: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.key]: c.icon }),
  {} as Record<string, string>,
);

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, cartCount, cartTotal, addToCart, cart, updateQuantity, activeOrder } = useApp();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const mockCafe = CAFES.find((c) => c.id === id);

  const [items, setItems]     = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cafeName, setCafeName] = useState<string>(mockCafe?.name ?? "");
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORIES[0].key);
  // Quick product search. When the box has text it matches the product name
  // (and description as a fallback) across ALL categories, so the customer can
  // find a drink instantly without hunting through tabs.
  const [search, setSearch] = useState("");

  const cafe = mockCafe ?? CAFES[0];
  const displayName = cafeName || cafe.name;

  useEffect(() => {
    let cancelled = false;
    // Monotonic request id: only the latest response is allowed to
    // call setItems. This prevents out-of-order poll responses from
    // overwriting newer data with stale results.
    let lastReqId = 0;
    let inFlight = false;

    const fetchMenu = (showSpinner: boolean) => {
      if (inFlight && !showSpinner) return; // skip overlapping poll ticks
      inFlight = true;
      const myReqId = ++lastReqId;
      if (showSpinner) setLoading(true);
      apiFetch<{ items: MenuItem[] }>(`/cafe/${id}/menu`)
        .then((data) => {
          if (cancelled || myReqId !== lastReqId) return;
          const available = data.items
            .filter((i) => i.available !== false)
            .map((i) => ({
              ...i,
              price: Number(i.price ?? 0),
              originalPrice:
                i.originalPrice != null && i.originalPrice !== ("" as any) && Number.isFinite(Number(i.originalPrice))
                  ? Number(i.originalPrice)
                  : null,
            }));
          setItems(available);
        })
        .catch(() => { if (!cancelled && showSpinner) setItems([]); })
        .finally(() => {
          inFlight = false;
          if (!cancelled && showSpinner) setLoading(false);
        });
    };

    fetchMenu(true);
    // Auto-refresh every 6s so newly-added menu items from the cafe
    // dashboard appear without forcing the user to reopen the screen.
    const t = setInterval(() => fetchMenu(false), 6000);

    // Fetch real cafe name from API (so admin-created cafes show their actual name)
    apiFetch<{ cafe: { name: string } }>(`/cafes/${id}${user ? `?userId=${encodeURIComponent(user.id)}` : ""}`)
      .then((data) => { if (!cancelled && data?.cafe?.name) setCafeName(data.cafe.name); })
      .catch(() => { /* keep mock fallback */ });

    return () => { cancelled = true; clearInterval(t); };
  }, [id]);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      // Search overrides the category filter so any matching product surfaces.
      return items.filter((i) => {
        const name = String(i.name ?? "").toLowerCase();
        const desc = String(i.description ?? "").toLowerCase();
        return name.includes(q) || desc.includes(q);
      });
    }
    return activeCategory === ALL_KEY
      ? items
      : items.filter((i) => i.category === activeCategory);
  }, [items, activeCategory, search]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.85}>
        <Feather name="arrow-left" size={20} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>{displayName}</Text>
        <Text style={styles.headerSub}>قائمة الكوفي</Text>
      </View>
    </View>
  );

  const [variantItem, setVariantItem] = useState<MenuItem | null>(null);
  const [pickedBean, setPickedBean] = useState<string>("");
  const [pickedSize, setPickedSize] = useState<{ label: string; extraPrice: number } | null>(null);

  const hasBeans = (item: MenuItem) => Array.isArray(item.beans) && item.beans.length > 0;
  const hasSizes = (item: MenuItem) => Array.isArray(item.sizes) && item.sizes.length > 0;

  const addItemToCart = (
    item: MenuItem,
    bean: string,
    size: { label: string; extraPrice: number } | null,
  ) => {
    const finalPrice = +(item.price + (size?.extraPrice ?? 0)).toFixed(3);
    const variantKey = `${bean || ""}::${size?.label || ""}`;
    const cartId = (bean || size) ? `${item.id}::${variantKey}` : item.id;
    addToCart({
      id: cartId,
      menuItemId: item.id,
      name: item.name,
      price: finalPrice,
      cafeId: id,
      cafeName: displayName,
      category: item.category,
      ...(bean ? { selectedBean: bean } : {}),
      ...(size ? { selectedSize: size.label, sizeExtraPrice: size.extraPrice } : {}),
      ...(item.originalPrice && item.originalPrice > item.price
        ? { originalPrice: +(item.originalPrice + (size?.extraPrice ?? 0)).toFixed(3) }
        : {}),
      ...(item.promoBuyQty && item.promoGetQty
        ? { promoBuyQty: item.promoBuyQty, promoGetQty: item.promoGetQty }
        : {}),
    });
  };

  const handleAdd = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasBeans(item) || hasSizes(item)) {
      setPickedBean("");
      setPickedSize(hasSizes(item) ? (item.sizes![0] ?? null) : null);
      setVariantItem(item);
      return;
    }
    addItemToCart(item, "", null);
  };

  const confirmVariant = () => {
    if (!variantItem) return;
    if (variantItem.beansRequired && hasBeans(variantItem) && !pickedBean) return;
    if (variantItem.sizesRequired && hasSizes(variantItem) && !pickedSize) return;
    addItemToCart(variantItem, pickedBean, pickedSize);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVariantItem(null);
    setPickedBean("");
    setPickedSize(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        {renderHeader()}
        <View style={styles.center}>
          <ActivityIndicator color={PRIMARY} size="large" />
          <Text style={styles.muted}>جاري تحميل القائمة...</Text>
        </View>
      </View>
    );
  }

  const showActiveOrderBanner = !!activeOrder && activeOrder.cafeId === id;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {renderHeader()}

      {showActiveOrderBanner && (
        <ActiveOrderBanner
          minutes={activeOrder!.prepMinutes}
          startedAt={activeOrder!.startedAt}
          drinks={activeOrder!.drinkQty}
          onPress={() => router.push({
            pathname: "/order-timer",
            params: {
              orderId:  activeOrder!.orderId,
              cafeId:   activeOrder!.cafeId,
              cafeName: activeOrder!.cafeName,
              minutes:  String(activeOrder!.prepMinutes),
              drinks:   String(activeOrder!.drinkQty),
            },
          })}
        />
      )}

      {/* Quick product search — pinned above the tabs so finding a drink is
          instant. Typing overrides the active category and matches across all. */}
      <View style={styles.searchBar}>
        <View style={styles.searchBox}>
          <Feather name="search" size={16} color={PRIMARY} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن منتج…"
            placeholderTextColor="rgba(245,230,204,0.4)"
            returnKeyType="search"
            textAlign="right"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="مسح البحث"
            >
              <Feather name="x" size={16} color="rgba(245,230,204,0.55)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category tabs (hidden while searching) — fixed-height bar pinned above
          the scrollable items list so it never gets covered no matter how many
          products are loaded. */}
      {search.trim().length === 0 && (
        <View style={styles.tabsBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {CATEGORIES.map((c) => (
              <CategoryTab
                key={c.key}
                label={c.key}
                icon={c.icon}
                active={activeCategory === c.key}
                onPress={() => { Haptics.selectionAsync(); setActiveCategory(c.key); }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Items list — flex:1 constrains it to the remaining space below the
          categories bar so its own internal scroll stays within bounds. */}
      <ScrollView
        style={styles.itemsScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + (cartCount > 0 ? 110 : 30) }]}
      >
        {visibleItems.length === 0 && (
          <View style={[styles.center, { paddingTop: 60 }]}>
            <Text style={{ fontSize: 48 }}>{search.trim() ? "🔍" : (CATEGORY_ICONS[activeCategory] ?? "🍽️")}</Text>
            <Text style={styles.emptyTitle}>
              {search.trim() ? "لا توجد نتائج مطابقة" : "لا توجد منتجات في هذا التصنيف"}
            </Text>
            <Text style={styles.muted}>{search.trim() ? "جرّب كلمة بحث أخرى" : "جرّب تصنيفاً آخر"}</Text>
          </View>
        )}
        <View style={styles.grid}>
          {visibleItems.map((item) => {
            // Sum quantity across every variant of this menu item (composite ids).
            const qty = cart.reduce(
              (s, c) => s + ((c.menuItemId ?? c.id) === item.id ? c.quantity : 0),
              0,
            );
            const tracked   = item.stockQty != null;
            const remaining = tracked ? Math.max(0, (item.stockQty as number) - qty) : Infinity;
            const depleted  = tracked && (item.stockQty as number) <= 0;
            const lowStock  = tracked && !depleted && (item.stockQty as number) > 0
              && (item.stockQty as number) <= Math.max(1, Math.ceil(((item.initialStockQty ?? item.stockQty) as number) * 0.25));
            const hasVariants = hasBeans(item) || hasSizes(item);
            return (
              <ProductTile
                key={item.id}
                item={item}
                qty={qty}
                depleted={depleted}
                lowStock={lowStock}
                tracked={tracked}
                remaining={remaining}
                hasVariants={hasVariants}
                onAdd={() => handleAdd(item)}
                onMinus={() => { Haptics.selectionAsync(); updateQuantity(item.id, qty - 1); }}
              />
            );
          })}
        </View>
      </ScrollView>

      {/* Variant picker (bean / size) */}
      <Modal
        visible={!!variantItem}
        transparent
        animationType="fade"
        onRequestClose={() => setVariantItem(null)}
      >
        <View style={styles.variantBackdrop}>
          <View style={styles.variantSheet}>
            <Text style={styles.variantTitle}>{variantItem?.name}</Text>
            <Text style={styles.variantSub}>اختر تفاصيل طلبك</Text>

            {variantItem && hasBeans(variantItem) && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.variantLabel}>
                  ☕ نوع البن {variantItem.beansRequired ? <Text style={{ color: "#EF5350" }}>*</Text> : <Text style={styles.variantOpt}>(اختياري)</Text>}
                </Text>
                <View style={styles.chipWrap}>
                  {!variantItem.beansRequired && (
                    <TouchableOpacity
                      style={[styles.chip, !pickedBean && styles.chipActive]}
                      onPress={() => setPickedBean("")}
                    >
                      <Text style={[styles.chipText, !pickedBean && styles.chipTextActive]}>بدون تحديد</Text>
                    </TouchableOpacity>
                  )}
                  {variantItem.beans!.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[styles.chip, pickedBean === b && styles.chipActive]}
                      onPress={() => setPickedBean(b)}
                    >
                      <Text style={[styles.chipText, pickedBean === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {variantItem && hasSizes(variantItem) && (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.variantLabel}>
                  📏 الحجم {variantItem.sizesRequired ? <Text style={{ color: "#EF5350" }}>*</Text> : <Text style={styles.variantOpt}>(اختياري)</Text>}
                </Text>
                <View style={styles.chipWrap}>
                  {!variantItem.sizesRequired && (
                    <TouchableOpacity
                      style={[styles.chip, !pickedSize && styles.chipActive]}
                      onPress={() => setPickedSize(null)}
                    >
                      <Text style={[styles.chipText, !pickedSize && styles.chipTextActive]}>الحجم الأساسي</Text>
                    </TouchableOpacity>
                  )}
                  {variantItem.sizes!.map((s) => (
                    <TouchableOpacity
                      key={s.label}
                      style={[styles.chip, pickedSize?.label === s.label && styles.chipActive]}
                      onPress={() => setPickedSize(s)}
                    >
                      <Text style={[styles.chipText, pickedSize?.label === s.label && styles.chipTextActive]}>
                        {s.label}{s.extraPrice > 0 ? `  +${s.extraPrice.toFixed(3)}` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {variantItem && (
              <Text style={styles.variantTotal}>
                الإجمالي: {((variantItem.price + (pickedSize?.extraPrice ?? 0))).toFixed(3)} OMR
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={styles.variantCancel}
                onPress={() => setVariantItem(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.variantCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.variantConfirm,
                  ((variantItem?.beansRequired && hasBeans(variantItem) && !pickedBean) ||
                   (variantItem?.sizesRequired && hasSizes(variantItem) && !pickedSize)) && { opacity: 0.5 },
                ]}
                onPress={confirmVariant}
                disabled={
                  !!variantItem &&
                  ((!!variantItem.beansRequired && hasBeans(variantItem) && !pickedBean) ||
                   (!!variantItem.sizesRequired && hasSizes(variantItem) && !pickedSize))
                }
                activeOpacity={0.85}
              >
                <Text style={styles.variantConfirmText}>إضافة للسلة</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart bar */}
      {cartCount > 0 && (
        <View style={[styles.cartBarWrap, { paddingBottom: botPad + 12 }]}>
          <TouchableOpacity
            style={styles.cartBar}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/cart"); }}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={[PRIMARY, "#C9985A"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cartBarGrad}
            >
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{cartCount}</Text>
              </View>
              <Text style={styles.cartBarText}>متابعة الطلب</Text>
              <Text style={styles.cartBarPrice}>{cartTotal.toFixed(3)} OMR</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Persistent active-order banner (shown on top of menu) ──────
function ActiveOrderBanner({
  minutes, startedAt, drinks, onPress,
}: { minutes: number; startedAt: number; drinks: number; onPress: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalMs   = Math.max(60_000, minutes * 60 * 1000);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainMs  = Math.max(0, totalMs - elapsedMs);
  const pct       = Math.max(0, Math.min(100, (1 - elapsedMs / totalMs) * 100));
  const mm = Math.floor(remainMs / 60000);
  const ss = Math.floor((remainMs % 60000) / 1000);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.activeBannerWrap}>
      <LinearGradient
        colors={["rgba(232,184,109,0.18)", "rgba(232,184,109,0.05)"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.activeBanner}
      >
        <View style={styles.activeBannerIcon}>
          <Feather name="clock" size={16} color={PRIMARY} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.activeBannerTitle}>طلبك قيد التحضير</Text>
          <Text style={styles.activeBannerSub}>
            {drinks} مشروب • متبقي {String(mm).padStart(2,"0")}:{String(ss).padStart(2,"0")}
          </Text>
          <View style={styles.activeBannerBar}>
            <View style={[styles.activeBannerBarFill, { width: `${pct}%` }]} />
          </View>
        </View>
        <Feather name="chevron-left" size={18} color={PRIMARY} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ── Product tile: square card with image background + shimmer sweep ──
function ProductTile({
  item, qty, depleted, lowStock, tracked, remaining, hasVariants, onAdd, onMinus,
}: {
  item: MenuItem;
  qty: number;
  depleted: boolean;
  lowStock: boolean;
  tracked: boolean;
  remaining: number;
  hasVariants: boolean;
  onAdd: () => void;
  onMinus: () => void;
}) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (width === 0) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [width, progress]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-80, width + 40]) },
      { skewX: "-22deg" },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.6, 1], [0, 0.55, 0.55, 0]),
  }));

  const hasDiscount = !!(item.originalPrice && item.originalPrice > item.price);
  const hasBundle   = !!(item.promoBuyQty && item.promoGetQty);

  return (
    <View
      style={[styles.tile, depleted && { opacity: 0.55 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {/* Background image (or fallback gradient + emoji) */}
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.tileBg} />
      ) : (
        <LinearGradient
          colors={["rgba(232,184,109,0.22)", "rgba(232,184,109,0.05)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.tileBg, { alignItems: "center", justifyContent: "center" }]}
        >
          <Text style={{ fontSize: 56 }}>{CATEGORY_ICONS[item.category] ?? "🍽️"}</Text>
        </LinearGradient>
      )}

      {/* Dark gradient overlay for text legibility */}
      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Shimmer sweep */}
      {width > 0 && (
        <Animated.View pointerEvents="none" style={[styles.tileShine, shineStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,232,180,0.45)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}

      {/* Top badges row */}
      <View style={styles.tileTopRow} pointerEvents="none">
        {hasDiscount && (
          <View style={styles.tileDiscountChip}>
            <Text style={styles.tileDiscountText}>
              -{Math.round(((item.originalPrice! - item.price) / item.originalPrice!) * 100)}%
            </Text>
          </View>
        )}
        {hasBundle && (
          <View style={styles.tileBundleChip}>
            <Text style={styles.tileBundleText}>🎁 {item.promoBuyQty}+{item.promoGetQty}</Text>
          </View>
        )}
      </View>

      {/* Bottom info: name, price, add control */}
      <View style={styles.tileInfo} pointerEvents="box-none">
        <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
        <View style={styles.tilePriceRow}>
          <View style={{ flex: 1 }}>
            {hasDiscount && (
              <Text style={styles.tileOldPrice}>{item.originalPrice!.toFixed(3)}</Text>
            )}
            <Text style={styles.tilePrice}>{item.price.toFixed(3)} OMR</Text>
          </View>

          {depleted ? (
            <View style={[styles.tileAddBtn, { backgroundColor: "rgba(120,30,30,0.85)" }]}>
              <Feather name="x" size={18} color={CREAM} />
            </View>
          ) : qty > 0 ? (
            <View style={styles.tileQtyRow}>
              {hasVariants ? (
                <View style={[styles.tileQtyBtn, { opacity: 0 }]} />
              ) : (
                <TouchableOpacity style={styles.tileQtyBtn} onPress={onMinus}>
                  <Feather name="minus" size={14} color="#FFF" />
                </TouchableOpacity>
              )}
              <Text style={styles.tileQtyText}>{qty}</Text>
              <TouchableOpacity
                style={[styles.tileQtyBtn, { backgroundColor: PRIMARY, opacity: remaining <= 0 ? 0.4 : 1 }]}
                onPress={() => { if (remaining > 0) onAdd(); }}
                disabled={remaining <= 0}
              >
                <Feather name="plus" size={14} color="#000" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={onAdd} activeOpacity={0.85} style={styles.tileAddBtnWrap}>
              <LinearGradient
                colors={[PRIMARY, "#C9985A"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.tileAddBtn}
              >
                <Feather name="plus" size={18} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {tracked && (
          <Text style={[
            styles.tileStockLine,
            depleted ? styles.stockTextOut : lowStock ? styles.stockTextLow : styles.stockTextOk,
          ]}>
            {depleted
              ? "نَفِد المنتج"
              : lowStock
                ? `متبقّي ${item.stockQty}`
                : `متوفر: ${item.stockQty}`}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Animated category tab with diagonal shimmer sweep ──────────
function CategoryTab({
  label, icon, active, onPress,
}: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!active || width === 0) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [active, width, progress]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-50, width + 20]) },
      { skewX: "-20deg" },
    ],
    opacity: interpolate(progress.value, [0, 0.15, 0.85, 1], [0, 0.85, 0.85, 0]),
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && width > 0 && (
        <Animated.View pointerEvents="none" style={[styles.tabShine, shineStyle]}>
          <LinearGradient
            colors={["transparent", "rgba(255,232,180,0.55)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  variantBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-end",
  },
  variantSheet: {
    backgroundColor: "#0A0606",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
  },
  variantTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
  },
  variantSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 4,
  },
  variantLabel: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    marginBottom: 8,
  },
  variantOpt: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(232,184,109,0.05)",
  },
  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: CREAM,
  },
  chipTextActive: {
    color: "#000",
  },
  variantTotal: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
    marginTop: 18,
  },
  variantCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  variantCancelText: {
    color: CREAM,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  variantConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
  },
  variantConfirmText: {
    color: "#000",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  headerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.6)", marginTop: 2 },

  // States
  center:     { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: CREAM, marginTop: 8 },
  muted:      { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(245,230,204,0.45)", textAlign: "center" },

  // Active order banner
  activeBannerWrap: { paddingHorizontal: 14, paddingTop: 8 },
  activeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: PRIMARY,
  },
  activeBannerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(232,184,109,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  activeBannerTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  activeBannerSub:   { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(245,230,204,0.7)", marginTop: 1 },
  activeBannerBar: {
    height: 3, marginTop: 6, borderRadius: 2,
    backgroundColor: "rgba(232,184,109,0.15)", overflow: "hidden",
  },
  activeBannerBarFill: { height: "100%", backgroundColor: PRIMARY },

  // Tabs
  searchBar: { paddingHorizontal: 14, paddingTop: 12 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  searchIcon: { marginLeft: 2 },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: "Inter_400Regular",
    color: CREAM, paddingVertical: 0,
  },
  tabsBar: { flexShrink: 0, flexGrow: 0 },
  tabs: { paddingHorizontal: 14, paddingVertical: 14, gap: 10 },
  itemsScroll: { flex: 1 },
  tab: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 18, paddingVertical: 0,
    height: 44, minWidth: 110,
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
    overflow: "hidden",
  },
  tabActive: { backgroundColor: "rgba(232,184,109,0.14)", borderColor: PRIMARY },
  tabIcon:         { fontSize: 16 },
  tabLabel:        { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(245,230,204,0.75)", lineHeight: 18, includeFontPadding: false },
  tabLabelActive:  { color: PRIMARY },
  tabShine: {
    position: "absolute",
    top: 0, bottom: 0,
    width: 28,
    transform: [{ skewX: "-20deg" }],
  },

  // List
  list: { paddingHorizontal: 12, paddingTop: 6 },

  // Grid of square product tiles
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  tile: {
    width: "48.5%",
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    overflow: "hidden",
    position: "relative",
  },
  tileBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  tileShine: {
    position: "absolute",
    top: 0, bottom: 0,
    width: 60,
  },
  tileTopRow: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    gap: 6,
  },
  tileDiscountChip: {
    backgroundColor: "rgba(239,68,68,0.92)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  tileDiscountText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFF" },
  tileBundleChip: {
    backgroundColor: "rgba(232,184,109,0.92)",
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  tileBundleText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  tileInfo: {
    position: "absolute",
    left: 10, right: 10, bottom: 10,
    gap: 4,
  },
  tileName: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  tilePriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  tilePrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 3,
  },
  tileOldPrice: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(245,230,204,0.65)",
    textDecorationLine: "line-through",
  },
  tileAddBtnWrap: { borderRadius: 12, overflow: "hidden" },
  tileAddBtn: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileQtyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileQtyBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  tileQtyText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", minWidth: 16, textAlign: "center" },
  tileStockLine: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

  stockTextOk:   { color: "#86EFAC" },
  stockTextLow:  { color: "#FDE68A" },
  stockTextOut:  { color: "#FCA5A5" },

  // Cart bar
  cartBarWrap:  { position: "absolute", left: 16, right: 16, bottom: 0 },
  cartBar:      { borderRadius: 18, overflow: "hidden" },
  cartBarGrad:  {
    height: 60, paddingHorizontal: 18,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  cartCountBadge: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cartCountText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  cartBarText:   { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  cartBarPrice:  { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
});
