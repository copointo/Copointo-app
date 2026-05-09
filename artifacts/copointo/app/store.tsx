import { Feather, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BuyCoinsPanel } from "./buy-coins";
import { useCoins } from "../hooks/useCoins";
import { BADGES, BadgeDef } from "../data/badges";
import { useBadges } from "../hooks/useBadges";
import { BACKGROUNDS, BackgroundDef } from "../data/backgrounds";
import { useBackgrounds } from "../hooks/useBackgrounds";
import { FRAMES, FrameDef } from "../data/frames";
import { useFrames } from "../hooks/useFrames";
import UsernameBackground from "../components/UsernameBackground";
import AvatarWithFrame from "../components/AvatarWithFrame";
import FadeInItem from "../components/FadeInItem";
import { useApp } from "../context/AppContext";
import { getDefaultAvatarSource } from "../lib/defaultAvatar";
import { getRank } from "../data/mockData";

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
  { id: "frames",     label: "الإطارات",        icon: "circle", iconLib: "mci", mciIcon: "image-filter-frames", hint: "إطارات حول صورتك" },
  { id: "badges",     label: "الأوسمة",         icon: "shield",         hint: "أوسمة بجانب اسمك" },
  { id: "background", label: "خلفية المستخدم",  icon: "image", iconLib: "mci", mciIcon: "card-account-details-outline", hint: "خلفية ملفك الشخصي" },
  { id: "username",   label: "لون اسم المستخدم", icon: "user",          hint: "ألوان وزخرفة الاسم" },
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
                    {c.id === "frames" ? (
                      <WingedFrameIcon color={isActive ? "#000" : PRIMARY} />
                    ) : c.iconLib === "fa5" && c.faIcon ? (
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
  const { owned: ownedBadges, grantBadge, equipBadge } = useBadges();
  const { owned: ownedBackgrounds, grantBackground, equipBackground } = useBackgrounds();
  const { owned: ownedFrames, grantFrame, equipFrame } = useFrames();
  const { balance, addCoins } = useCoins();
  const { user } = useApp();
  const avatarUri = user?.avatar ?? null;
  const username = user?.gameUsername || user?.name || "guest";
  const avatarSource = avatarUri ? { uri: avatarUri } : getDefaultAvatarSource(user?.gender);
  const [previewBg, setPreviewBg] = useState<{ bg: BackgroundDef; price: number } | null>(null);
  const [previewFrame, setPreviewFrame] = useState<{ frame: FrameDef; price: number } | null>(null);
  const [previewBadge, setPreviewBadge] = useState<{ badge: BadgeDef; price: number } | null>(null);

  const previewOwned = previewBg ? ownedBackgrounds.includes(previewBg.bg.id) : false;
  const previewFrameOwned = previewFrame ? ownedFrames.includes(previewFrame.frame.id) : false;
  const previewBadgeOwned = previewBadge ? ownedBadges.includes(previewBadge.badge.id) : false;

  if (cat === "background") {
    return (
      <>
        <View style={styles.bgGrid} key="backgrounds">
          {BACKGROUNDS.map((bg, i) => {
            const owned = ownedBackgrounds.includes(bg.id);
            const price = i < 10 ? 350 : i < 15 ? 1000 : 2500;
            return (
              <FadeInItem key={bg.id} index={i} style={{ width: "48%" }}>
                <TouchableOpacity
                  style={styles.bgCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreviewBg({ bg, price });
                  }}
                >
                  {(() => {
                    const lvl = user?.level ?? 1;
                    const rk = getRank(lvl);
                    return (
                      <UsernameBackground bg={bg} borderRadius={12} paddingHorizontal={8} paddingVertical={10} style={styles.bgTallPreview}>
                        <View style={styles.bgCardLbRow}>
                          <AvatarWithFrame size={32} scale={1.55} frameId={undefined}>
                            <Image
                              source={avatarUri ? { uri: avatarUri } : getDefaultAvatarSource(user?.gender)}
                              style={styles.bgCardLbAvatarImg}
                            />
                          </AvatarWithFrame>
                          <View style={styles.bgCardLbInfo}>
                            <Text style={styles.bgCardLbName} numberOfLines={1}>
                              @{username}
                            </Text>
                            <Text style={styles.bgCardLbLevel} numberOfLines={1}>
                              Lv {lvl} · {rk.icon}
                            </Text>
                            <View style={styles.bgCardLbCoffeeChip}>
                              <Text style={styles.bgCardLbCoffeeText}>☕ {user?.totalOrders ?? 0}</Text>
                            </View>
                          </View>
                        </View>
                      </UsernameBackground>
                    );
                  })()}
                  <Text style={styles.bgName} numberOfLines={1}>{bg.name}</Text>
                  <PriceTag price={price} owned={owned} />
                </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>

        <PurchaseModal
          visible={!!previewBg}
          onClose={() => setPreviewBg(null)}
          title={previewBg?.bg.name ?? ""}
          subtitle="معاينة شكل الخلفية على بطاقتك"
          price={previewBg?.price ?? 0}
          owned={previewOwned}
          balance={balance}
          ownedLabel="تجهيز هذه الخلفية"
          onEquip={() => previewBg && equipBackground(previewBg.bg.id)}
          onBuy={async () => {
            if (!previewBg) return;
            await addCoins(-previewBg.price);
            await grantBackground(previewBg.bg.id);
            await equipBackground(previewBg.bg.id);
          }}
        >
          {previewBg && (() => {
            const lvl = user?.level ?? 1;
            const rk = getRank(lvl);
            return (
              <UsernameBackground
                bg={previewBg.bg}
                borderRadius={20}
                paddingHorizontal={18}
                paddingVertical={24}
                style={styles.previewTall}
              >
                <View style={styles.previewTallInner}>
                  <AvatarWithFrame size={84} scale={1.55} frameId={undefined}>
                    <Image source={avatarSource} style={styles.previewAvatarImg} />
                  </AvatarWithFrame>
                  <Text style={styles.previewName} numberOfLines={1}>
                    @{username} <Text style={{ color: "#E8B86D" }}>(أنت)</Text>
                  </Text>
                  <Text style={styles.previewLevel} numberOfLines={1}>
                    Level {lvl} · {rk.nameEn} {rk.icon}
                  </Text>
                  <View style={styles.previewCoffeeChip}>
                    <Text style={styles.previewCoffeeChipText}>☕ {user?.totalOrders ?? 0} كوفي</Text>
                  </View>
                </View>
              </UsernameBackground>
            );
          })()}
        </PurchaseModal>
      </>
    );
  }

  if (cat === "frames") {
    const shopFrames = FRAMES.filter(f => !f.levelReward);
    if (shopFrames.length === 0) {
      return (
        <FadeInItem key="frames-empty" style={styles.comingSoon}>
          <Feather name="award" size={28} color={PRIMARY} />
          <Text style={styles.comingSoonTitle}>قريباً</Text>
          <Text style={styles.comingSoonSub}>الإطارات الحالية مكافآت مستوى — تُفتح بترقية مستواك في اللعبة</Text>
        </FadeInItem>
      );
    }
    return (
      <>
        <View style={styles.bgGrid} key="frames">
          {shopFrames.map((f, i) => {
            const owned = ownedFrames.includes(f.id);
            const price = PRICE_BY_TIER[i] ?? 100;
            return (
              <FadeInItem key={f.id} index={i} style={{ width: "48%" }}>
                <TouchableOpacity
                  style={styles.bgCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreviewFrame({ frame: f, price });
                  }}
                >
                  <View style={styles.framePreviewWrap}>
                    <AvatarWithFrame size={64} frameId={f.id}>
                      <Image source={avatarSource} style={{ width: 64, height: 64, borderRadius: 32 }} />
                    </AvatarWithFrame>
                  </View>
                  <Text style={styles.bgName} numberOfLines={1}>{f.name}</Text>
                  <PriceTag price={price} owned={owned} />
                </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>

        <PurchaseModal
          visible={!!previewFrame}
          onClose={() => setPreviewFrame(null)}
          title={previewFrame?.frame.name ?? ""}
          subtitle="معاينة شكل الإطار حول صورتك"
          price={previewFrame?.price ?? 0}
          owned={previewFrameOwned}
          balance={balance}
          ownedLabel="تجهيز هذا الإطار"
          onEquip={() => previewFrame && equipFrame(previewFrame.frame.id)}
          onBuy={async () => {
            if (!previewFrame) return;
            await addCoins(-previewFrame.price);
            await grantFrame(previewFrame.frame.id);
            await equipFrame(previewFrame.frame.id);
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: 18 }}>
            <AvatarWithFrame size={120} frameId={previewFrame?.frame.id ?? null}>
              <Image source={avatarSource} style={{ width: 120, height: 120, borderRadius: 60 }} />
            </AvatarWithFrame>
            <Text style={[styles.modalUsername, { marginTop: 12 }]}>@{username}</Text>
          </View>
        </PurchaseModal>
      </>
    );
  }

  if (cat === "badges") {
    const shopBadges = BADGES.filter(b => !b.levelReward);
    if (shopBadges.length === 0) {
      return (
        <FadeInItem key="badges-empty" style={styles.comingSoon}>
          <Feather name="shield" size={28} color={PRIMARY} />
          <Text style={styles.comingSoonTitle}>قريباً</Text>
          <Text style={styles.comingSoonSub}>الأوسمة الحالية مكافآت مستوى — تُفتح بترقية مستواك في اللعبة</Text>
        </FadeInItem>
      );
    }
    return (
      <>
        <View style={styles.bgGrid} key="badges">
          {shopBadges.map((b, i) => {
            const owned = ownedBadges.includes(b.id);
            const price = PRICE_BY_TIER[i] ?? 100;
            return (
              <FadeInItem key={b.id} index={i} style={{ width: "48%" }}>
                <TouchableOpacity
                  style={styles.bgCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPreviewBadge({ badge: b, price });
                  }}
                >
                  <View style={styles.badgeImgWrap}>
                    <Image source={b.source} style={styles.badgeImgLg} />
                  </View>
                  <Text style={styles.bgName} numberOfLines={1}>{b.name}</Text>
                  <PriceTag price={price} owned={owned} />
                </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>

        <PurchaseModal
          visible={!!previewBadge}
          onClose={() => setPreviewBadge(null)}
          title={previewBadge?.badge.name ?? ""}
          subtitle="معاينة شكل الوسام"
          price={previewBadge?.price ?? 0}
          owned={previewBadgeOwned}
          balance={balance}
          ownedLabel="تجهيز هذا الوسام"
          onEquip={() => previewBadge && equipBadge(previewBadge.badge.id)}
          onBuy={async () => {
            if (!previewBadge) return;
            await addCoins(-previewBadge.price);
            await grantBadge(previewBadge.badge.id);
            await equipBadge(previewBadge.badge.id);
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            {previewBadge && (
              <Image source={previewBadge.badge.source} style={{ width: 140, height: 140, resizeMode: "contain" }} />
            )}
          </View>
        </PurchaseModal>
      </>
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

interface PurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  price: number;
  owned: boolean;
  balance: number;
  ownedLabel: string;
  onEquip: () => void;
  onBuy: () => Promise<void>;
  children: React.ReactNode;
}

function PurchaseModal({
  visible, onClose, title, subtitle, price, owned, balance, ownedLabel, onEquip, onBuy, children,
}: PurchaseModalProps) {
  const canAfford = balance >= price;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Feather name="x" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>{subtitle}</Text>

          {children}

          {owned ? (
            <TouchableOpacity
              style={styles.modalBuyOwned}
              activeOpacity={0.85}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onEquip();
                onClose();
              }}
            >
              <Feather name="check" size={16} color="#000" />
              <Text style={styles.modalBuyOwnedText}>{ownedLabel}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.modalBuyBtn, !canAfford && { opacity: 0.5 }]}
              activeOpacity={0.85}
              disabled={!canAfford}
              onPress={async () => {
                if (!canAfford) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                await onBuy();
                onClose();
              }}
            >
              <Image source={COPOINTO_COIN} style={{ width: 18, height: 18, resizeMode: "contain" }} />
              <Text style={styles.modalBuyText}>
                {canAfford ? `شراء بـ ${price} عملة` : `تحتاج ${price} عملة`}
              </Text>
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function WingedFrameIcon({ color, size = 22 }: { color: string; size?: number }) {
  const inner = Math.round(size * 0.45);
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 2, borderColor: color,
      alignItems: "center", justifyContent: "center",
    }}>
      <View style={{
        width: inner, height: inner, borderRadius: inner / 2,
        borderWidth: 1, borderColor: color,
      }} />
    </View>
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
  bgGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" },
  bgCard: {
    width: "100%",
    minWidth: 0,
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
    alignItems: "center", gap: 8,
  },
  bgName: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  bgPreviewText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF" },
  bgPreviewSubText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  bgMiniAvatar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  bgMiniAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lbRank: { fontSize: 20, fontFamily: "Inter_700Bold", width: 32, textAlign: "center" },
  lbAvatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "rgba(255,255,255,0.20)" },
  lbInfo: { flex: 1 },
  lbName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF", marginBottom: 3 },
  lbLevel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  lbCoffeeChip: {
    alignSelf: "flex-start", marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 8,
    backgroundColor: "rgba(79,195,247,0.18)",
    borderWidth: 1, borderColor: "rgba(79,195,247,0.45)",
  },
  lbCoffeeChipText: { fontSize: 10.5, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  bgTallPreview: { alignSelf: "stretch" },
  bgCardLbRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 6 },
  bgCardLbRank: { fontSize: 14, width: 18, textAlign: "center" },
  bgCardLbAvatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.20)" },
  bgCardLbInfo: { flex: 1, minWidth: 0 },
  bgCardLbName: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#FFF", marginBottom: 1 },
  bgCardLbLevel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.80)" },
  bgCardLbCoffeeChip: {
    alignSelf: "flex-start", marginTop: 3,
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6,
    backgroundColor: "rgba(79,195,247,0.20)",
    borderWidth: 1, borderColor: "rgba(79,195,247,0.50)",
  },
  bgCardLbCoffeeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  bgTallInner: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  bgTallAvatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.40)",
    overflow: "hidden",
  },
  bgTallAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  previewTall: {
    alignSelf: "stretch", marginTop: 14,
    aspectRatio: 16 / 9,
  },
  previewTallInner: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 10,
  },
  previewMedal: { fontSize: 28 },
  previewAvatarImg: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: "rgba(255,255,255,0.25)" },
  previewName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  previewLevel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  previewCoffeeChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: "rgba(79,195,247,0.20)",
    borderWidth: 1, borderColor: "rgba(79,195,247,0.55)",
  },
  previewCoffeeChipText: { fontSize: 11.5, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  framePreviewWrap: {
    width: "100%", alignItems: "center", justifyContent: "center",
    paddingVertical: 16,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalSheet: {
    width: "100%", maxWidth: 360,
    backgroundColor: "#0A0606",
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    gap: 4,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF", flex: 1 },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  modalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  modalAvatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.45)",
    overflow: "hidden",
  },
  modalAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  modalUsername: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  modalLevel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  modalBuyBtn: {
    marginTop: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY,
    paddingVertical: 13, borderRadius: 12,
  },
  modalBuyText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  modalBuyOwned: {
    marginTop: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7DD87D",
    paddingVertical: 13, borderRadius: 12,
  },
  modalBuyOwnedText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
  badgeImgWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  badgeImgLg: { width: 96, height: 96, resizeMode: "contain" },
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
