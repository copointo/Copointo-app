import { Feather, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BuyCoinsPanel } from "./buy-coins";
import { useCoins } from "../hooks/useCoins";
import { BADGES } from "../data/badges";
import { useBadges } from "../hooks/useBadges";
import { BACKGROUNDS } from "../data/backgrounds";
import { useBackgrounds } from "../hooks/useBackgrounds";
import UsernameBackground from "../components/UsernameBackground";
import FadeInItem from "../components/FadeInItem";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

type Section = "coins" | "items" | null;
type ShopCat =
  | "frames"
  | "badges"
  | "background"
  | "username"
  | "text"
  | "gifts"
  | "characters";

interface CatDef {
  id: ShopCat;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  iconLib?: "feather" | "fa5" | "mci";
  faIcon?: string;
  mciIcon?: string;
  hint: string;
}

const CATEGORIES: CatDef[] = [
  { id: "characters", label: "الشخصيات",        icon: "smile", iconLib: "fa5", faIcon: "user-astronaut", hint: "شخصيات داخل اللعبة" },
  { id: "gifts",      label: "الهدايا",         icon: "gift",           hint: "أرسل هدايا لأصدقائك" },
  { id: "frames",     label: "الإطارات",        icon: "circle", iconLib: "mci", mciIcon: "image-frame", hint: "إطارات حول صورتك" },
  { id: "badges",     label: "الأوسمة",         icon: "shield",         hint: "أوسمة بجانب اسمك" },
  { id: "background", label: "خلفية المستخدم",  icon: "image", iconLib: "mci", mciIcon: "card-account-details-outline", hint: "خلفية ملفك الشخصي" },
  { id: "username",   label: "ثيم اسم المستخدم", icon: "user",          hint: "ألوان وزخرفة الاسم" },
  { id: "text",       label: "نص ملون",          icon: "type",          hint: "خطوط وأنماط الكتابة" },
];

const PRICE_BY_TIER = [50, 100, 200, 350, 500, 700, 1000, 1500, 2200, 3000];

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selected, setSelected] = useState<Section>("coins");
  const [activeCat, setActiveCat] = useState<ShopCat | null>(null);
  const { balance } = useCoins();

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace("/(tabs)/game")}
        >
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>المتجر</Text>
        <View style={styles.balancePanel}>
          <Image source={COPOINTO_COIN} style={styles.balanceCoin} />
          <Text style={styles.balanceText}>{balance.toLocaleString("en-US")}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          {/* Buy Coins card */}
          <TouchableOpacity
            style={[styles.tile, selected === "coins" && styles.tileSelected]}
            activeOpacity={0.85}
            onPress={() => setSelected(s => s === "coins" ? null : "coins")}
          >
            <View style={styles.tileIconWrap}>
              <Image source={COPOINTO_COIN} style={styles.tileCoin} />
            </View>
            <Text style={styles.tileTitle}>شراء عملات Copointo</Text>
            <Text style={styles.tileSub}>مزايا داخل التطبيق</Text>
          </TouchableOpacity>

          {/* Item Shop card */}
          <TouchableOpacity
            style={[styles.tile, selected === "items" && styles.tileSelected]}
            activeOpacity={0.85}
            onPress={() => setSelected(s => s === "items" ? null : "items")}
          >
            <View style={[styles.tileIconWrap, styles.tileIconBg]}>
              <Feather name="shopping-bag" size={36} color={PRIMARY} />
            </View>
            <Text style={styles.tileTitle}>Item Shop</Text>
            <Text style={styles.tileSub}>تصفّح العناصر والمزايا</Text>
          </TouchableOpacity>
        </View>

        {selected === "coins" && (
          <View style={styles.panelWrap}>
            <BuyCoinsPanel />
          </View>
        )}

        {selected === "items" && (
          <View style={styles.panelWrap}>
            {/* Category icon row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {CATEGORIES.map(c => {
                const isActive = activeCat === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catIconBtn, isActive && styles.catIconBtnActive]}
                    activeOpacity={0.85}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveCat(prev => prev === c.id ? null : c.id);
                    }}
                  >
                    {c.iconLib === "fa5" && c.faIcon ? (
                      <FontAwesome5 name={c.faIcon as any} size={18} color={isActive ? "#000" : PRIMARY} solid />
                    ) : c.iconLib === "mci" && c.mciIcon ? (
                      <MaterialCommunityIcons name={c.mciIcon as any} size={22} color={isActive ? "#000" : PRIMARY} />
                    ) : (
                      <Feather name={c.icon} size={20} color={isActive ? "#000" : PRIMARY} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeCat && (
              <>
                <Text style={styles.catTitle}>
                  {CATEGORIES.find(c => c.id === activeCat)?.label}
                </Text>
                <View style={styles.catPanel}>
                  <CategoryPanel cat={activeCat} />
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CategoryPanel({ cat }: { cat: ShopCat }) {
  const { owned: ownedBadges } = useBadges();
  const { owned: ownedBackgrounds } = useBackgrounds();

  if (cat === "background") {
    return (
      <View style={styles.itemsGrid} key="backgrounds">
        {BACKGROUNDS.map((bg, i) => {
          const owned = ownedBackgrounds.includes(bg.id);
          return (
            <FadeInItem key={bg.id} index={i} style={styles.itemCard}>
              <UsernameBackground bg={bg} borderRadius={10} paddingHorizontal={10} paddingVertical={8} style={{ alignSelf: "stretch", alignItems: "center" }}>
                <Text style={styles.bgPreviewText}>@username</Text>
              </UsernameBackground>
              <Text style={styles.itemName} numberOfLines={1}>{bg.name}</Text>
              <PriceTag price={PRICE_BY_TIER[i % PRICE_BY_TIER.length] ?? 100} owned={owned} />
            </FadeInItem>
          );
        })}
      </View>
    );
  }

  if (cat === "badges") {
    return (
      <View style={styles.itemsGrid} key="badges">
        {BADGES.map((b, i) => {
          const owned = ownedBadges.includes(b.id);
          return (
            <FadeInItem key={b.id} index={i} style={styles.itemCard}>
              <Image source={b.source} style={styles.itemImg} />
              <Text style={styles.itemName} numberOfLines={1}>{b.name}</Text>
              <PriceTag price={PRICE_BY_TIER[i] ?? 100} owned={owned} />
            </FadeInItem>
          );
        })}
      </View>
    );
  }

  return (
    <FadeInItem key={cat} style={styles.comingSoon}>
      <Feather name="clock" size={28} color={PRIMARY} />
      <Text style={styles.comingSoonTitle}>قريباً</Text>
      <Text style={styles.comingSoonSub}>هذا القسم تحت الإعداد، ترقّبه قريباً</Text>
    </FadeInItem>
  );
}

function PriceTag({ price, owned }: { price: number; owned: boolean }) {
  if (owned) {
    return (
      <View style={[styles.priceTag, styles.priceTagOwned]}>
        <Feather name="check" size={11} color="#000" />
        <Text style={styles.priceTagOwnedText}>مملوك</Text>
      </View>
    );
  }
  return (
    <View style={styles.priceTag}>
      <Image source={COPOINTO_COIN} style={{ width: 12, height: 12, resizeMode: "contain" }} />
      <Text style={styles.priceTagText}>{price.toLocaleString("en-US")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
    transform: [{ scaleX: -1 }],
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF" },
  balancePanel: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: PRIMARY,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14,
    minWidth: 72, justifyContent: "center",
  },
  balanceCoin: { width: 18, height: 18, resizeMode: "contain" },
  balanceText: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },

  scroll: { padding: 20, gap: 14, paddingBottom: 60 },

  row: { flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center",
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 4,
    minHeight: 170,
  },
  tileSelected: {
    borderColor: PRIMARY, borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowOpacity: 0.6,
  },
  tileIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    marginBottom: 10,
  },
  tileIconBg: {
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
  },
  tileCoin: { width: 72, height: 72, resizeMode: "contain" },
  tileTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center", marginBottom: 4 },
  tileSub:   { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 16 },

  panelWrap: { marginTop: 4, gap: 14 },

  // ── Item-shop categories ──
  catRow: {
    flexDirection: "row", gap: 8, paddingVertical: 4,
  },
  catIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  catIconBtnActive: {
    backgroundColor: PRIMARY, borderColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
  },
  catTitle: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY,
    textAlign: "right", marginTop: 4,
  },

  catPanel: {
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: BORDER,
  },

  // ── Items grid ──
  itemsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between",
  },
  itemCard: {
    width: "31.5%",
    backgroundColor: "#000",
    borderRadius: 12, padding: 8,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", gap: 6,
  },
  itemImg: { width: 64, height: 64, resizeMode: "contain" },
  itemName: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  bgPreviewText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF" },
  priceTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  priceTagText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  priceTagOwned: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  priceTagOwnedText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },

  // ── Coming soon ──
  comingSoon: { alignItems: "center", gap: 6, paddingVertical: 24 },
  comingSoonTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  comingSoonSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center" },
});
