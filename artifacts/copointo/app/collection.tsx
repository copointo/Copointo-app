import { Feather, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvatarWithFrame from "../components/AvatarWithFrame";
import UserBadge from "../components/UserBadge";
import FadeInItem from "../components/FadeInItem";
import { useApp } from "../context/AppContext";
import { getDefaultAvatarSource } from "../lib/defaultAvatar";
import { BADGES } from "../data/badges";
import { FRAMES } from "../data/frames";
import { BACKGROUNDS } from "../data/backgrounds";
import { getRank } from "../data/mockData";
import { useBadges } from "../hooks/useBadges";
import { useFrames } from "../hooks/useFrames";
import { useBackgrounds } from "../hooks/useBackgrounds";
import UsernameBackground from "../components/UsernameBackground";
import UsernameText from "../components/UsernameText";
import { USERNAME_COLORS } from "../data/usernameColors";
import { useUsernameColors } from "../hooks/useUsernameColors";
import { TEXT_STYLES } from "../data/textStyles";
import { useTextStyles } from "../hooks/useTextStyles";
import MessageBubble from "../components/MessageBubble";
import { CHARACTERS } from "../data/characters";
import { useCharacters } from "../hooks/useCharacters";
import Character from "../components/Character";
import { GIFTS, GiftDef } from "../data/gifts";
import GiftAnimation from "../components/GiftAnimation";
import { useGiftInventory } from "../hooks/useGiftInventory";

const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const BG      = "#000000";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.25)";

export default function CollectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { user } = useApp();
  const { owned: ownedFrames, equipped: equippedFrame, equipFrame } = useFrames();
  const { owned: ownedBadges, equipped: equippedBadge, equipBadge } = useBadges();
  const { owned: ownedBackgrounds, equipped: equippedBackground, equipBackground } = useBackgrounds();
  const { owned: ownedUsernameColors, equipped: equippedUsernameColor, equipUsernameColor } = useUsernameColors();
  const { owned: ownedTextStyles, equipped: equippedTextStyle, equipTextStyle } = useTextStyles();
  const { owned: ownedCharacters, equipped: equippedCharacter, equipCharacter } = useCharacters();
  const { inventory: giftInventory } = useGiftInventory();
  const [previewGift, setPreviewGift] = useState<GiftDef | null>(null);
  type ShopCat = "frames" | "badges" | "background" | "username" | "text" | "gifts" | "characters";
  const CATEGORIES: { id: ShopCat; label: string; icon: keyof typeof Feather.glyphMap; iconLib?: "feather" | "fa5" | "mci"; faIcon?: string; mciIcon?: string }[] = [
    { id: "characters", label: "الشخصيات",       icon: "smile", iconLib: "fa5", faIcon: "user-astronaut" },
    { id: "gifts",      label: "الهدايا",        icon: "gift"   },
    { id: "frames",     label: "الإطارات",       icon: "circle", iconLib: "mci", mciIcon: "record-circle-outline" },
    { id: "badges",     label: "الأوسمة",        icon: "shield" },
    { id: "background", label: "خلفية المستخدم", icon: "image", iconLib: "mci", mciIcon: "card-account-details-outline" },
    { id: "username",   label: "لون اسم المستخدم", icon: "user"  },
    { id: "text",       label: "نص ملون",          icon: "type"  },
  ];
  const [tab, setTab] = useState<ShopCat>("characters");

  const avatarUri = user?.avatar ?? null;
  const username = user?.gameUsername || user?.name || "guest";

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>أغراضي</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Live preview ── */}
        <Text style={[styles.previewLabel, { marginBottom: 4 }]}>معاينة</Text>
        <UsernameBackground
          borderRadius={18}
          paddingHorizontal={16}
          paddingVertical={16}
          style={{ alignSelf: "stretch" }}
        >
          <View style={{ alignItems: "center", gap: 8 }}>
            <AvatarWithFrame size={84}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.previewAvatarImg} />
              ) : (
                <Image source={getDefaultAvatarSource(user?.gender)} style={styles.previewAvatarImg} />
              )}
            </AvatarWithFrame>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.previewName}>@{username}</Text>
              <UserBadge size={18} />
            </View>
            <Text style={styles.previewRankText}>
              {user?.level ? `المستوى ${user.level}` : "المستوى 1"}
            </Text>
          </View>
        </UsernameBackground>
        <Text style={styles.previewSub}>
          الإطار يظهر حول صورتك، والخلفية تظهر خلف بطاقتك في التصنيف
        </Text>

        {/* ════════ ICON CATEGORIES ════════ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {CATEGORIES.map(c => {
            const isActive = tab === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.catIconBtn, isActive && styles.catIconBtnActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTab(c.id); }}
                activeOpacity={0.85}
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
        <Text style={styles.catTitle}>{CATEGORIES.find(c => c.id === tab)?.label}</Text>

        {tab === "frames" && (<>
        {/* ════════ FRAMES ════════ */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>الإطارات</Text>
            <Text style={styles.sectionHint}>تلتفّ حول صورة الملف الشخصي</Text>
          </View>
          {equippedFrame && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipFrame(null); }}
              style={styles.removeBtn}
            >
              <Feather name="x" size={12} color={PRIMARY} />
              <Text style={styles.removeBtnText}>إزالة</Text>
            </TouchableOpacity>
          )}
        </View>

        {ownedFrames.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintTitle}>ما عندك إطارات بعد</Text>
            <Text style={styles.emptyHintSub}>اربح إطارات من مكافآت المستويات</Text>
          </View>
        )}

        <View style={styles.grid} key="frames-grid">
          {FRAMES.filter(f => ownedFrames.includes(f.id)).map((f, idx) => {
            const isEquipped = equippedFrame === f.id;
            return (
              <FadeInItem key={f.id} index={idx} style={styles.tileWrap}>
              <TouchableOpacity
                style={[styles.tile, isEquipped && styles.tileEquipped]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  equipFrame(isEquipped ? null : f.id);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.tileImgWrap}>
                  <Image source={f.source} style={styles.tileImg} />
                </View>
                <Text style={styles.tileName}>{f.name}</Text>
                {isEquipped ? (
                  <View style={styles.equippedChip}>
                    <Feather name="check" size={10} color="#000" />
                    <Text style={styles.equippedChipText}>مُجهَّز</Text>
                  </View>
                ) : (
                  <View style={styles.ownedChip}>
                    <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                  </View>
                )}
              </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>

        </>)}

        {tab === "badges" && (<>
        {/* ════════ BADGES ════════ */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>الأوسمة</Text>
            <Text style={styles.sectionHint}>تظهر بجانب اسمك في التصنيف والملف</Text>
          </View>
          {equippedBadge && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipBadge(null); }}
              style={styles.removeBtn}
            >
              <Feather name="x" size={12} color={PRIMARY} />
              <Text style={styles.removeBtnText}>إزالة</Text>
            </TouchableOpacity>
          )}
        </View>

        {ownedBadges.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintTitle}>ما عندك أوسمة بعد</Text>
            <Text style={styles.emptyHintSub}>اربح أوسمة من مكافآت المستويات</Text>
          </View>
        )}

        <View style={styles.grid} key="badges-grid">
          {BADGES.filter(b => ownedBadges.includes(b.id)).map((b, idx) => {
            const isEquipped = equippedBadge === b.id;
            return (
              <FadeInItem key={b.id} index={idx} style={styles.tileWrap}>
              <TouchableOpacity
                style={[styles.tile, isEquipped && styles.tileEquipped]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  equipBadge(isEquipped ? null : b.id);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.tileImgWrap}>
                  <Image source={b.source} style={styles.tileImg} />
                </View>
                <Text style={styles.tileName}>{b.name}</Text>
                {isEquipped ? (
                  <View style={styles.equippedChip}>
                    <Feather name="check" size={10} color="#000" />
                    <Text style={styles.equippedChipText}>مُجهَّز</Text>
                  </View>
                ) : (
                  <View style={styles.ownedChip}>
                    <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                  </View>
                )}
              </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>
        </>)}

        {tab === "background" && (<>
        {/* ════════ BACKGROUNDS ════════ */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>خلفية المستخدم</Text>
            <Text style={styles.sectionHint}>تظهر خلف اسم المستخدم في التصنيف والملف</Text>
          </View>
          {equippedBackground && (
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipBackground(null); }}
              style={styles.removeBtn}
            >
              <Feather name="x" size={12} color={PRIMARY} />
              <Text style={styles.removeBtnText}>إزالة</Text>
            </TouchableOpacity>
          )}
        </View>

        {ownedBackgrounds.length === 0 && (
          <FadeInItem style={styles.emptyHint}>
            <Feather name="shopping-bag" size={26} color={PRIMARY} />
            <Text style={styles.emptyHintTitle}>لا توجد خلفيات بعد</Text>
            <Text style={styles.emptyHintSub}>اشتر خلفيات من المتجر لتظهر هنا</Text>
          </FadeInItem>
        )}

        <View style={styles.grid} key="backgrounds-grid">
          {BACKGROUNDS.filter(bg => ownedBackgrounds.includes(bg.id)).map((bg, idx) => {
            const isOwned = true;
            const isEquipped = equippedBackground === bg.id;
            const price = 0;
            void price;
            const lvl = user?.level ?? 1;
            const rk = getRank(lvl);
            return (
              <FadeInItem key={bg.id} index={idx} style={styles.tileWrap}>
                <TouchableOpacity
                  style={[
                    styles.tile,
                    isEquipped && styles.tileEquipped,
                    !isOwned && styles.tileLocked,
                  ]}
                  disabled={!isOwned}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    equipBackground(isEquipped ? null : bg.id);
                  }}
                  activeOpacity={0.85}
                >
                  <UsernameBackground bg={bg} borderRadius={12} paddingHorizontal={8} paddingVertical={10} style={{ ...styles.bgTallPreview, opacity: isOwned ? 1 : 0.35 }}>
                    <View style={styles.bgCardLbRow}>
                      <AvatarWithFrame size={32} scale={1.55} frameId={undefined}>
                        <Image
                          source={avatarUri ? { uri: avatarUri } : getDefaultAvatarSource(user?.gender)}
                          style={styles.bgCardLbAvatarImg}
                        />
                      </AvatarWithFrame>
                      <View style={styles.bgCardLbInfo}>
                        <UsernameText
                          text={`@${username}`}
                          style={styles.bgCardLbName}
                          numberOfLines={1}
                        />
                        <Text style={styles.bgCardLbLevel} numberOfLines={1}>
                          Lv {lvl} · {rk.icon}
                        </Text>
                        <View style={styles.bgCardLbCoffeeChip}>
                          <Text style={styles.bgCardLbCoffeeText}>☕ {user?.totalOrders ?? 0}</Text>
                        </View>
                      </View>
                    </View>
                  </UsernameBackground>
                  <Text style={styles.tileName}>
                    {bg.name}
                  </Text>
                  {isEquipped ? (
                    <View style={styles.equippedChip}>
                      <Feather name="check" size={10} color="#000" />
                      <Text style={styles.equippedChipText}>مُجهَّز</Text>
                    </View>
                  ) : isOwned ? (
                    <View style={styles.ownedChip}>
                      <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                    </View>
                  ) : (
                    <View style={styles.lockedChip}>
                      <Feather name="lock" size={9} color="rgba(255,255,255,0.55)" />
                      <Text style={styles.lockedChipText}>من المتجر</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </FadeInItem>
            );
          })}
        </View>
        </>)}

        {tab === "username" && (<>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>لون اسم المستخدم</Text>
              <Text style={styles.sectionHint}>يظهر على اسمك في صفحة التصنيف</Text>
            </View>
            {equippedUsernameColor && (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipUsernameColor(null); }}
                style={styles.removeBtn}
              >
                <Feather name="x" size={12} color={PRIMARY} />
                <Text style={styles.removeBtnText}>إزالة</Text>
              </TouchableOpacity>
            )}
          </View>

          {ownedUsernameColors.length === 0 && (
            <FadeInItem style={styles.emptyHint}>
              <Feather name="shopping-bag" size={26} color={PRIMARY} />
              <Text style={styles.emptyHintTitle}>لا توجد ألوان بعد</Text>
              <Text style={styles.emptyHintSub}>اشتر ألوان للاسم من المتجر لتظهر هنا</Text>
            </FadeInItem>
          )}

          <View style={styles.grid} key="username-colors-grid">
            {USERNAME_COLORS.filter(uc => ownedUsernameColors.includes(uc.id)).map((uc, idx) => {
              const isEquipped = equippedUsernameColor === uc.id;
              return (
                <FadeInItem key={uc.id} index={idx} style={styles.tileWrap}>
                  <TouchableOpacity
                    style={[styles.tile, isEquipped && styles.tileEquipped]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      equipUsernameColor(isEquipped ? null : uc.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{
                      alignSelf: "stretch",
                      paddingVertical: 22, paddingHorizontal: 8,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      borderRadius: 12,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <UsernameText
                        text={`@${username}`}
                        style={{ fontSize: 18, fontFamily: "Inter_700Bold" }}
                        override={uc}
                        numberOfLines={1}
                      />
                    </View>
                    <Text style={styles.tileName}>{uc.name}</Text>
                    {isEquipped ? (
                      <View style={styles.equippedChip}>
                        <Feather name="check" size={10} color="#000" />
                        <Text style={styles.equippedChipText}>مُجهَّز</Text>
                      </View>
                    ) : (
                      <View style={styles.ownedChip}>
                        <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </FadeInItem>
              );
            })}
          </View>
        </>)}

        {tab === "text" && (<>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>نص ملوّن للرسائل</Text>
              <Text style={styles.sectionHint}>يظهر على رسائلك في الدردشة</Text>
            </View>
            {equippedTextStyle && (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipTextStyle(null); }}
                style={styles.removeBtn}
              >
                <Feather name="x" size={12} color={PRIMARY} />
                <Text style={styles.removeBtnText}>إزالة</Text>
              </TouchableOpacity>
            )}
          </View>

          {ownedTextStyles.length === 0 && (
            <FadeInItem style={styles.emptyHint}>
              <Feather name="shopping-bag" size={26} color={PRIMARY} />
              <Text style={styles.emptyHintTitle}>لا توجد ستايلات بعد</Text>
              <Text style={styles.emptyHintSub}>اشتر نصوص ملونة من المتجر لتظهر هنا</Text>
            </FadeInItem>
          )}

          <View style={styles.grid} key="text-styles-grid">
            {TEXT_STYLES.filter(ts => ownedTextStyles.includes(ts.id)).map((ts, idx) => {
              const isEquipped = equippedTextStyle === ts.id;
              return (
                <FadeInItem key={ts.id} index={idx} style={styles.tileWrap}>
                  <TouchableOpacity
                    style={[styles.tile, isEquipped && styles.tileEquipped]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      equipTextStyle(isEquipped ? null : ts.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{
                      alignSelf: "stretch",
                      paddingVertical: 18, paddingHorizontal: 8,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      borderRadius: 12,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <MessageBubble
                        style={{ borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 }}
                        textStyleDef={ts}
                        fallbackBg="#E8B86D"
                        fallbackBorder="#E8B86D"
                      >
                        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: ts.textColor }} numberOfLines={1}>
                          مرحباً 👋
                        </Text>
                      </MessageBubble>
                    </View>
                    <Text style={styles.tileName}>{ts.name}</Text>
                    {isEquipped ? (
                      <View style={styles.equippedChip}>
                        <Feather name="check" size={10} color="#000" />
                        <Text style={styles.equippedChipText}>مُجهَّز</Text>
                      </View>
                    ) : (
                      <View style={styles.ownedChip}>
                        <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </FadeInItem>
              );
            })}
          </View>
        </>)}

        {tab === "characters" && (<>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>الشخصيات</Text>
              <Text style={styles.sectionHint}>الرفيق الذي يظهر فوق مستواك في اللعبة</Text>
            </View>
            {equippedCharacter && (
              <TouchableOpacity
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); equipCharacter(null); }}
                style={styles.removeBtn}
              >
                <Feather name="x" size={12} color={PRIMARY} />
                <Text style={styles.removeBtnText}>إزالة</Text>
              </TouchableOpacity>
            )}
          </View>

          {ownedCharacters.length === 0 && (
            <FadeInItem style={styles.emptyHint}>
              <Feather name="shopping-bag" size={26} color={PRIMARY} />
              <Text style={styles.emptyHintTitle}>لا توجد شخصيات بعد</Text>
              <Text style={styles.emptyHintSub}>اشتر شخصيات من المتجر لتظهر هنا</Text>
            </FadeInItem>
          )}

          <View style={styles.grid} key="characters-grid">
            {CHARACTERS.filter(ch => ownedCharacters.includes(ch.id)).map((ch, idx) => {
              const isEquipped = equippedCharacter === ch.id;
              return (
                <FadeInItem key={ch.id} index={idx} style={styles.tileWrap}>
                  <TouchableOpacity
                    style={[styles.tile, isEquipped && styles.tileEquipped]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      equipCharacter(isEquipped ? null : ch.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={{
                      alignSelf: "stretch",
                      paddingVertical: 14, paddingHorizontal: 8,
                      backgroundColor: "rgba(0,0,0,0.55)",
                      borderRadius: 12,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                      alignItems: "center", justifyContent: "center",
                      minHeight: 90,
                    }}>
                      <Character def={ch} size={36} animated />
                    </View>
                    <Text style={styles.tileName}>{ch.name}</Text>
                    {isEquipped ? (
                      <View style={styles.equippedChip}>
                        <Feather name="check" size={10} color="#000" />
                        <Text style={styles.equippedChipText}>مُجهَّز</Text>
                      </View>
                    ) : (
                      <View style={styles.ownedChip}>
                        <Text style={styles.ownedChipText}>اضغط للتجهيز</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </FadeInItem>
              );
            })}
          </View>
        </>)}

        {tab === "gifts" && (<>
        {/* ════════ GIFTS INVENTORY ════════ */}
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>الهدايا</Text>
            <Text style={styles.sectionHint}>اضغط أي هدية لمعاينة الحركة — الإرسال من شات صديق أو ملفه</Text>
          </View>
        </View>

        {GIFTS.every(g => (giftInventory[g.id] ?? 0) === 0) ? (
          <FadeInItem key="gifts-empty" style={styles.comingSoon}>
            <Feather name="gift" size={28} color={PRIMARY} />
            <Text style={styles.comingSoonTitle}>لا تملك أي هدية</Text>
            <Text style={styles.comingSoonSub}>اشترِ هدايا من المتجر لإرسالها لأصدقائك</Text>
          </FadeInItem>
        ) : (
          <View style={styles.grid} key="gifts-grid">
            {GIFTS.map((g, idx) => {
              const count = giftInventory[g.id] ?? 0;
              if (count === 0) return null;
              return (
                <FadeInItem key={g.id} index={idx} style={styles.tileWrap}>
                  <TouchableOpacity
                    style={styles.tile}
                    activeOpacity={0.85}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPreviewGift(g);
                    }}
                  >
                    <View style={styles.tileImgWrap}>
                      {g.image ? (
                        <Image source={g.image} style={{ width: 64, height: 64 }} resizeMode="contain" />
                      ) : (
                        <Text style={{ fontSize: 56, lineHeight: 64, textAlign: "center" }}>{g.emoji}</Text>
                      )}
                    </View>
                    <Text style={styles.tileName}>{g.name}</Text>
                    <View style={[styles.equippedChip, { backgroundColor: g.color }]}>
                      <Feather name="gift" size={10} color="#000" />
                      <Text style={styles.equippedChipText}>×{count}</Text>
                    </View>
                  </TouchableOpacity>
                </FadeInItem>
              );
            })}
          </View>
        )}

        <GiftAnimation
          gift={previewGift}
          visible={!!previewGift}
          onDone={() => setPreviewGift(null)}
        />
        </>)}

        {tab !== "frames" && tab !== "badges" && tab !== "background" && tab !== "username" && tab !== "text" && tab !== "characters" && tab !== "gifts" && (
          <FadeInItem key={tab} style={styles.comingSoon}>
            <Feather name="clock" size={28} color={PRIMARY} />
            <Text style={styles.comingSoonTitle}>قريباً</Text>
            <Text style={styles.comingSoonSub}>هذا القسم تحت الإعداد، ترقّبه قريباً</Text>
          </FadeInItem>
        )}
      </ScrollView>
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
  scroll: { padding: 16, paddingBottom: 60, gap: 16 },

  previewCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", gap: 8,
  },
  previewLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  previewAvatarImg: { width: 84, height: 84, borderRadius: 42 },
  previewAvatarFallback: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  previewName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  previewSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", textAlign: "center",
    lineHeight: 17, paddingHorizontal: 8,
  },

  catRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
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
  comingSoon: { alignItems: "center", gap: 6, paddingVertical: 30 },
  comingSoonTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  comingSoonSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center" },

  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  sectionHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)", marginTop: 2 },
  removeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  removeBtnText: { fontSize: 11, fontFamily: "Inter_700Bold", color: PRIMARY },

  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between",
  },
  tileWrap: { width: "48%" },
  tile: {
    width: "100%",
    backgroundColor: "#0A0606",
    borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", gap: 8,
  },
  tileEquipped: {
    borderColor: PRIMARY, borderWidth: 2,
    backgroundColor: "rgba(232,184,109,0.10)",
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tileLocked: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  tileImgWrap: {
    width: 96, height: 96,
    alignItems: "center", justifyContent: "center",
  },
  tileImg: { width: 96, height: 96, resizeMode: "contain" },
  lockOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  tileName: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  bgPreview: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF" },
  bgPreviewSub: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },
  bgMiniAvatar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  bgMiniAvatarImg: { width: 28, height: 28, borderRadius: 14 },
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
  bgPriceChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  bgPriceCoin: { width: 12, height: 12, resizeMode: "contain" },
  bgPriceText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  emptyHint: {
    alignItems: "center", gap: 6,
    paddingVertical: 28, paddingHorizontal: 16,
    backgroundColor: "#0A0606",
    borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    marginVertical: 8,
  },
  emptyHintTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF", marginTop: 4 },
  emptyHintSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)", textAlign: "center" },
  previewRankText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.85)" },

  equippedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: PRIMARY,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  equippedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  ownedChip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
  },
  ownedChipText: { fontSize: 10, fontFamily: "Inter_700Bold", color: PRIMARY },
  lockedChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  lockedChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
});
