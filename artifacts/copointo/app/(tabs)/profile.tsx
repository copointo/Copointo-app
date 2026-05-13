import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
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
import { useApp, claimGameUsername } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useResponsive } from "@/hooks/useResponsive";
import { useReceivedGifts } from "@/hooks/useReceivedGifts";
import { useSentGifts } from "@/hooks/useSentGifts";
import { useCoins } from "@/hooks/useCoins";
import { RANKS, getRank } from "@/data/mockData";
import { AuthModal } from "@/components/AuthModal";
import AvatarWithFrame from "@/components/AvatarWithFrame";
import UserBadge from "@/components/UserBadge";
import Character from "@/components/Character";
import { getDefaultAvatarSource } from "@/lib/defaultAvatar";
import { useCharacters } from "@/hooks/useCharacters";
import { useFrames } from "@/hooks/useFrames";
import { useBadges } from "@/hooks/useBadges";
import { useUsernameColors } from "@/hooks/useUsernameColors";
import { useTextStyles } from "@/hooks/useTextStyles";
import { useBackgrounds } from "@/hooks/useBackgrounds";
import { getCharacter } from "@/data/characters";
import { getFrame } from "@/data/frames";
import { getBadge } from "@/data/badges";
import { getUsernameColor } from "@/data/usernameColors";
import { getTextStyle } from "@/data/textStyles";
import { getBackground } from "@/data/backgrounds";

const BG      = "#000000";
const CARD    = "#0A0606";
const BORDER  = "rgba(232,184,109,0.35)";
const PRIMARY = "#E8B86D";
const DANGER  = "#E55353";

// ─── Edit Modal ──────────────────────────────────────────────
function EditModal({
  visible, title, value, onClose, onSave, secure,
}: {
  visible: boolean; title: string; value: string;
  onClose: () => void; onSave: (v: string) => void;
  secure?: boolean;
}) {
  const [text, setText] = useState(value);
  const [show, setShow]  = useState(false);
  const { t } = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              secureTextEntry={secure && !show}
              autoFocus
              placeholderTextColor="rgba(255,255,255,0.30)"
              placeholder={secure ? "••••••••" : ""}
              selectionColor={PRIMARY}
            />
            {secure && (
              <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
                <Feather name={show ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.45)" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => { onSave(text); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


// ─── Logout Confirm Modal ────────────────────────────────────
function LogoutConfirmModal({ visible, onClose, onConfirm }: { visible: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={{ alignItems: "center", gap: 10 }}>
            <View style={styles.warnIcon}>
              <Feather name="log-out" size={26} color={DANGER} />
            </View>
            <Text style={styles.modalTitle}>{t("profile.logoutConfirmTitle")}</Text>
            <Text style={styles.confirmSub}>{t("profile.logoutConfirmMsg")}</Text>
          </View>
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.cancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: DANGER }]}
              onPress={() => { onConfirm(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
              activeOpacity={0.85}
            >
              <Text style={styles.saveText}>{t("profile.logout")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Ranks Journey Modal ─────────────────────────────────────
function RanksModal({
  visible, onClose, currentLevel,
}: { visible: boolean; onClose: () => void; currentLevel: number }) {
  const currentRank = getRank(currentLevel);
  const { t } = useT();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.ranksCard}>
          {/* Header */}
          <View style={styles.ranksHeader}>
            <Text style={styles.ranksTitle}>{t("ranks.title")}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.ranksSubtitle}>
            {t("ranks.youAreAt")} <Text style={{ color: PRIMARY, fontFamily: "Inter_700Bold" }}>{currentLevel}</Text>
            {"  •  "}
            <Text style={{ color: PRIMARY }}>{currentRank.name}</Text>
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 6 }}>
            {RANKS.map((r) => {
              const isPast    = currentLevel > r.max;
              const isCurrent = currentLevel >= r.min && currentLevel <= r.max;
              const cupsLeft  = Math.max(0, r.min - currentLevel);

              return (
                <View
                  key={r.nameEn}
                  style={[
                    styles.rankRow,
                    isCurrent && styles.rankRowCurrent,
                    isPast && { opacity: 0.55 },
                  ]}
                >
                  {/* Icon */}
                  <View style={[
                    styles.rankRowIcon,
                    isCurrent && { borderColor: PRIMARY, backgroundColor: "rgba(232,184,109,0.15)" }
                  ]}>
                    <Text style={{ fontSize: 22 }}>{r.icon}</Text>
                  </View>

                  {/* Name + range */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={[styles.rankRowName, isCurrent && { color: PRIMARY }]}>{r.nameEn}</Text>
                      {isCurrent && (
                        <View style={styles.hereBadge}>
                          <Text style={styles.hereBadgeText}>{t("ranks.youAreHere")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.rankRowSub}>{r.name}</Text>
                    <Text style={styles.rankRowRange}>{t("ranks.levelsRange", { min: String(r.min), max: String(r.max) })}</Text>
                  </View>

                  {/* Status */}
                  <View style={styles.rankRowStatus}>
                    {isPast ? (
                      <View style={styles.checkPill}>
                        <Feather name="check" size={14} color="#E8B86D" />
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.cupsRemainingCol}>
                        <Text style={styles.cupsRemainingNum}>{r.max - currentLevel + 1}</Text>
                        <Text style={styles.cupsRemainingLbl}>{t("ranks.cupsToNext")}</Text>
                      </View>
                    ) : (
                      <View style={styles.cupsRemainingCol}>
                        <View style={styles.cupsPill}>
                          <Text style={{ fontSize: 11 }}>☕</Text>
                          <Text style={styles.cupsPillNum}>{cupsLeft}</Text>
                        </View>
                        <Text style={styles.cupsRemainingLbl}>{t("ranks.remaining")}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Footer note */}
          <View style={styles.ranksFooter}>
            <Feather name="info" size={13} color="rgba(255,255,255,0.5)" />
            <Text style={styles.ranksFooterText}>{t("ranks.footer")}</Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Profile Screen ───────────────────────────────────────────
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const { user, setUser, logout, deleteAccount, friends, registeredUsers } = useApp();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { t, dir } = useT();

  const [authOpen,    setAuthOpen]    = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteOpen, setDeleteOpen]   = useState(false);
  const [deleteText, setDeleteText]   = useState("");
  const [deleting, setDeleting]       = useState(false);
  const { setCoins } = useCoins();
  const [modal, setModal] = useState<null | "username" | "password">(null);
  const [ranksOpen, setRanksOpen] = useState(false);

  const avatarUri = user?.avatar ?? null;
  const genderEmoji = user?.gender === "female" ? "👩" : user?.gender === "male" ? "🧑" : "👤";

  // ── Logged-out empty state ──
  if (!user) {
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
       <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("profile.title")}</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="user" size={56} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>{t("profile.welcome")}</Text>
          <Text style={styles.emptySub}>{t("profile.welcomeSub")}</Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => setAuthOpen(true)}
            activeOpacity={0.88}
          >
            <Feather name="log-in" size={18} color="#FFF" />
            <Text style={styles.loginBtnText}>{t("profile.loginNow")}</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authOpen} onClose={() => setAuthOpen(false)} />
       </View>
      </View>
    );
  }

  // ── Logged-in state ──
  const username = user.gameUsername || user.name;
  const level = user.level ?? 0;
  const rank  = getRank(level);
  const nextRank = getRank(Math.min(level + 1, 1000));
  const pct   = rank ? ((level - rank.min) / Math.max(rank.max - rank.min, 1)) * 100 : 0;
  const freeCoffees = Math.floor((user.totalOrders ?? 0) / 7);
  const giftsReceived = useReceivedGifts(user.id);
  const giftsSent     = useSentGifts(user.id);
  const { equipped: eqCharacterId } = useCharacters();
  const { equipped: eqFrameId }     = useFrames();
  const { equipped: eqBadgeId }     = useBadges();
  const { equipped: eqUcId }        = useUsernameColors();
  const { equipped: eqTsId }        = useTextStyles();
  const { equipped: eqBgId }        = useBackgrounds();

  // Friends count + ranks (show "—" for brand-new users with no activity)
  const friendsCount = friends.length;
  const hasActivity = (user.level ?? 0) > 0 || (user.totalOrders ?? 0) > 0 || (user.points ?? 0) > 0;

  const omanRankStr = (() => {
    if (!hasActivity) return "—";
    const sorted = [...registeredUsers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const friendsRankStr = (() => {
    if (!hasActivity) return "—";
    const friendPool = registeredUsers.filter(u => friends.includes(u.id) || u.id === user.id);
    if (friendPool.length === 0) return "—";
    const sorted = friendPool.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const idx = sorted.findIndex(u => u.id === user.id);
    return idx >= 0 ? `#${idx + 1}` : "—";
  })();

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert(t("profile.photoPermNeeded")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user) {
      setUser({ ...user, avatar: result.assets[0].uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, alignItems: "center" }]}>
     <View style={{ width: "100%", maxWidth: r.contentMaxWidth, flex: 1 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("profile.title")}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: r.hPad, paddingBottom: insets.bottom + 100, gap: 16 }}
      >
        {/* ── Avatar with double glowing ring + equipped frame ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarOuterRing}>
            <AvatarWithFrame size={100} scale={1.7}>
              <View style={styles.avatarInnerRing}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Image source={getDefaultAvatarSource(user?.gender)} style={styles.avatarImg} />
                )}
              </View>
            </AvatarWithFrame>
            {/* Camera badge bottom-right inside ring */}
            <View style={styles.cameraBadge}>
              <Feather name="camera" size={15} color="#FFF" />
            </View>
          </TouchableOpacity>
          {avatarUri && user && (
            <TouchableOpacity
              style={styles.removePhotoBtn}
              onPress={() => {
                const doRemove = () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const { avatar: _omit, ...rest } = user;
                  setUser(rest as typeof user);
                };
                if (Platform.OS === "web") {
                  // eslint-disable-next-line no-alert
                  if (typeof window !== "undefined" && window.confirm("هل تريد إزالة صورة البروفايل والرجوع إلى الصورة الافتراضية؟")) {
                    doRemove();
                  }
                  return;
                }
                Alert.alert(
                  "إزالة الصورة",
                  "هل تريد إزالة صورة البروفايل والرجوع إلى الصورة الافتراضية؟",
                  [
                    { text: "إلغاء", style: "cancel" },
                    { text: "إزالة", style: "destructive", onPress: doRemove },
                  ],
                );
              }}
              activeOpacity={0.85}
            >
              <Feather name="trash-2" size={13} color="#FF6B6B" />
              <Text style={styles.removePhotoBtnText}>إزالة الصورة</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.changePhotoHint}>{t("profile.tapToChangePhoto")}</Text>
        </View>

        {/* ── Rank pill (tap to view full ranks journey) ── */}
        <TouchableOpacity
          style={styles.rankPill}
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRanksOpen(true); }}
        >
          <View style={styles.rankPillIconRing}>
            <Text style={styles.rankPillIcon}>{rank?.icon ?? "☕"}</Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={styles.rankPillName}>{rank?.nameEn ?? t("profile.coffeeBeginner")}</Text>
            <Text style={styles.rankPillSub}>{rank?.name ?? t("profile.coffeeBeginnerAr")}</Text>
          </View>
          <Feather name="chevron-left" size={18} color={PRIMARY} style={{ opacity: 0.7 }} />
        </TouchableOpacity>

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          {/* Row 1 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>{friendsCount}</Text>
              <Text style={styles.statLabel}>{t("profile.statFriends")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>⭐</Text>
              <Text style={styles.statValue}>{level}</Text>
              <Text style={styles.statLabel}>{t("profile.statLevel")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard]}>
              <Text style={styles.statIcon}>☕</Text>
              <Text style={styles.statValue}>{freeCoffees}</Text>
              <Text style={styles.statLabel}>{t("profile.statFreeCoffees")}</Text>
            </View>
          </View>
          {/* Row 2 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>🎁</Text>
              <Text style={[styles.statValue, { color: "#FF6B9D" }]}>{giftsReceived}</Text>
              <Text style={styles.statLabel}>{t("profile.statGiftsReceived")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>💝</Text>
              <Text style={[styles.statValue, { color: "#A78BFA" }]}>{giftsSent}</Text>
              <Text style={styles.statLabel}>{t("profile.statGiftsSent")}</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>🇴🇲</Text>
              <Text style={styles.statValue}>{omanRankStr}</Text>
              <Text style={styles.statLabel}>{t("profile.statOmanRank")}</Text>
            </View>
          </View>
          {/* Row 3 */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBoxCard, { flex: 1 }]}>
              <Text style={styles.statIcon}>👫</Text>
              <Text style={styles.statValue}>{friendsRankStr}</Text>
              <Text style={styles.statLabel}>{t("profile.statFriendsRank")}</Text>
            </View>
          </View>
        </View>

        {/* ── Equipped cosmetics showcase ── */}
        <Text style={styles.cosmeticsTitle}>{t("profile.equippedTitle")}</Text>
        <View style={styles.cosmeticsGrid}>
          {(() => {
            const ch = getCharacter(eqCharacterId);
            const fr = getFrame(eqFrameId);
            const bd = getBadge(eqBadgeId);
            const uc = getUsernameColor(eqUcId);
            const ts = getTextStyle(eqTsId);
            const bg = getBackground(eqBgId);
            const ucColor = uc?.color ?? uc?.gradient?.[0] ?? uc?.mix?.[0] ?? "rgba(255,255,255,0.40)";
            const items = [
              { label: t("profile.eqCharacter"),      node: ch ? <Character def={ch} size={28} /> : null, name: ch?.name },
              { label: t("profile.eqFrame"),          node: fr ? <View style={{ width: 36, height: 36 }}><AvatarWithFrame size={36} scale={1} frameId={fr.id}><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)" }} /></AvatarWithFrame></View> : null, name: fr?.name },
              { label: t("profile.eqBadge"),          node: bd ? <UserBadge badgeId={bd.id} size={26} /> : null, name: bd?.name },
              { label: t("profile.eqUsernameColor"),  node: uc ? <Text style={{ color: ucColor, fontFamily: "Inter_700Bold", fontSize: 16 }}>أبجد</Text> : null, name: uc?.name },
              { label: t("profile.eqTextStyle"),      node: ts ? <Text style={{ color: "#FFF", fontFamily: "Inter_600SemiBold", fontSize: 12 }}>Aa</Text> : null, name: ts?.name },
              { label: t("profile.eqBackground"),     node: bg ? <View style={{ width: 28, height: 18, borderRadius: 4, backgroundColor: (bg as any).color ?? (Array.isArray((bg as any).gradient) ? (bg as any).gradient[0] : "#333"), borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} /> : null, name: bg?.name },
            ].filter(it => it.node);
            if (items.length === 0) {
              return (
                <View style={styles.cosmeticEmpty}>
                  <Text style={styles.cosmeticEmptyText}>{t("profile.equippedEmpty")}</Text>
                </View>
              );
            }
            return items.map((it, i) => (
              <View key={i} style={styles.cosmeticCard}>
                <Text style={styles.cosmeticLabel}>{it.label}</Text>
                <View style={styles.cosmeticPreview}>{it.node}</View>
                <Text style={styles.cosmeticName} numberOfLines={1}>{it.name ?? "—"}</Text>
              </View>
            ));
          })()}
        </View>

        {/* ── Progress bar ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t("profile.progressTitle")}</Text>
            <Text style={[styles.progressPct, { color: rank?.color ?? PRIMARY }]}>{Math.round(pct)}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: rank?.color ?? PRIMARY }]} />
          </View>
          <Text style={styles.progressSub}>
            {rank?.nameEn} {rank?.icon}  →  {nextRank?.nameEn} {nextRank?.icon}
          </Text>
        </View>

        {/* ── Edit fields ── */}
        <View style={styles.fieldsCard}>
          {/* Username */}
          {/* Phone (read-only — set at registration, cannot be edited) */}
          {!!user.phone && (
            <>
              <View style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Feather name="phone" size={17} color={PRIMARY} />
                </View>
                <View style={styles.fieldText}>
                  <Text style={styles.fieldLabel}>{t("profile.fieldPhone")}</Text>
                  <Text style={[styles.fieldValue, { writingDirection: "ltr" }]} numberOfLines={1}>
                    {user.phone}
                  </Text>
                </View>
                <Feather name="lock" size={14} color="rgba(255,255,255,0.25)" />
              </View>
              <View style={styles.divider} />
            </>
          )}

          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("username")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="user" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>{t("profile.fieldGameUser")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.fieldValue}>@{username}</Text>
                <UserBadge size={18} />
              </View>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Password */}
          <TouchableOpacity
            style={styles.fieldRow}
            onPress={() => setModal("password")}
            activeOpacity={0.8}
          >
            <View style={styles.fieldIcon}>
              <Feather name="lock" size={17} color={PRIMARY} />
            </View>
            <View style={styles.fieldText}>
              <Text style={styles.fieldLabel}>{t("profile.fieldPassword")}</Text>
              <Text style={styles.fieldValue}>{"•".repeat(10)}</Text>
            </View>
            <Feather name="edit-2" size={15} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        </View>

        {/* ── Support button (above logout) ── */}
        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => router.push("/support")}
          activeOpacity={0.85}
        >
          <Feather name="help-circle" size={17} color={PRIMARY} />
          <Text style={styles.supportText}>{t("profile.support")}</Text>
        </TouchableOpacity>

        {/* ── Privacy & Governance button (above logout) ── */}
        <TouchableOpacity
          style={styles.privacyBtn}
          onPress={() => router.push("/privacy")}
          activeOpacity={0.85}
        >
          <Feather name="shield" size={17} color={PRIMARY} />
          <Text style={styles.privacyText}>{t("profile.privacy")}</Text>
        </TouchableOpacity>

        {/* ── Logout button ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setConfirmOpen(true)}
          activeOpacity={0.85}
        >
          <Feather name="log-out" size={17} color={DANGER} />
          <Text style={styles.logoutText}>{t("profile.logout")}</Text>
        </TouchableOpacity>

        {/* ── Delete account permanently ── */}
        <TouchableOpacity
          style={styles.deleteAcctBtn}
          onPress={() => { setDeleteText(""); setDeleteOpen(true); }}
          activeOpacity={0.85}
        >
          <Feather name="trash-2" size={17} color={DANGER} />
          <Text style={styles.deleteAcctText}>{t("profile.deleteAccount")}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Username modal */}
      <EditModal
        visible={modal === "username"}
        title={t("profile.editGameUser")}
        value={username}
        onClose={() => setModal(null)}
        onSave={async (v) => {
          const next = v.trim();
          if (!next || !user) return;
          if (next.toLowerCase() === (user.gameUsername || "").toLowerCase()) return;
          // Server is the single source of truth for username uniqueness
          // across all devices — don't update locally if it's already taken.
          const r = await claimGameUsername(user.id, next);
          if (!r.ok) {
            Alert.alert(t("profile.usernameChangeFailed"), r.error);
            return;
          }
          setUser({ ...user, gameUsername: next });
        }}
      />

      {/* Password modal */}
      <EditModal
        visible={modal === "password"}
        title={t("profile.editPassword")}
        value=""
        onClose={() => setModal(null)}
        onSave={(v) => { if (v.trim() && user) setUser({ ...user, password: v.trim() }); }}
        secure
      />

      {/* Logout confirmation */}
      <LogoutConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => { setConfirmOpen(false); await logout(); }}
      />

      {/* Delete-account confirmation */}
      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => !deleting && setDeleteOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ alignItems: "center", gap: 10 }}>
              <View style={styles.warnIcon}>
                <Feather name="trash-2" size={26} color={DANGER} />
              </View>
              <Text style={styles.modalTitle}>{t("profile.deleteConfirmTitle")}</Text>
              <Text style={[styles.confirmSub, { textAlign: dir === "rtl" ? "right" : "left" }]}>
                {t("profile.deleteConfirmMsg")}
              </Text>
              <Text style={[styles.confirmSub, { color: DANGER, marginTop: 4 }]}>
                {t("profile.deleteConfirmHint")}
              </Text>
              <TextInput
                value={deleteText}
                onChangeText={setDeleteText}
                placeholder={t("profile.deleteConfirmKeyword")}
                placeholderTextColor="rgba(255,255,255,0.35)"
                editable={!deleting}
                autoCapitalize="characters"
                style={{
                  width: "100%",
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: `${DANGER}55`,
                  borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
                  color: "#FFF", fontFamily: "Inter_600SemiBold",
                  textAlign: "center", marginTop: 8,
                }}
              />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => !deleting && setDeleteOpen(false)}
                activeOpacity={0.85}
                disabled={deleting}
              >
                <Text style={styles.cancelText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: DANGER, opacity:
                      deleting || deleteText.trim().toUpperCase() !== t("profile.deleteConfirmKeyword").toUpperCase() ? 0.5 : 1 },
                ]}
                disabled={deleting || deleteText.trim().toUpperCase() !== t("profile.deleteConfirmKeyword").toUpperCase()}
                onPress={async () => {
                  setDeleting(true);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  const res = await deleteAccount();
                  setDeleting(false);
                  if (!res.ok) {
                    Alert.alert(t("profile.deleteFailed"), res.error || "");
                    return;
                  }
                  setDeleteOpen(false);
                  // No Alert here — the AuthGate will instantly re-render
                  // because `user` is now null, and the AuthModal will
                  // open straight on the "register-form" tab (flagged by
                  // deleteAccount via initialAuthStep). Showing a blocking
                  // Alert in between just delays that transition.
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.saveText}>
                  {deleting ? t("profile.deleting") : t("profile.deleteConfirmBtn")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ranks journey */}
      <RanksModal
        visible={ranksOpen}
        onClose={() => setRanksOpen(false)}
        currentLevel={level}
      />
     </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: BG },
  header:        { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle:   { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Empty state
  emptyState: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 32, gap: 16,
  },
  emptyIconWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: `${PRIMARY}15`,
    borderWidth: 2, borderColor: `${PRIMARY}40`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  emptySub:   { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center", marginBottom: 12 },
  loginBtn:   {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 28,
    borderRadius: 16, shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  loginBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },

  // ── Avatar (double glowing ring) ──
  avatarSection: { alignItems: "center", gap: 10, marginTop: 44 },
  avatarOuterRing: {
    width: 122, height: 122, borderRadius: 61,
    borderWidth: 2, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
    shadowColor: PRIMARY, shadowOpacity: 0.6,
    shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarInnerRing: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0A0606", overflow: "hidden",
  },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarLevelNum: {
    fontSize: 48, fontFamily: "Inter_700Bold", color: "#FFF",
    lineHeight: 56,
  },
  cameraBadge: {
    position: "absolute", bottom: 4, right: 4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  changePhotoHint: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)", marginTop: 4,
  },
  removePhotoBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1, borderColor: "rgba(255,107,107,0.35)",
  },
  removePhotoBtnText: {
    fontSize: 12, fontFamily: "Inter_700Bold", color: "#FF6B6B",
  },

  // ── Rank pill ──
  rankPill: {
    flexDirection: "row", alignItems: "center", gap: 16,
    backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    paddingVertical: 14, paddingHorizontal: 20,
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  rankPillIconRing: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1.5, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(232,184,109,0.08)",
    shadowColor: PRIMARY, shadowOpacity: 0.5,
    shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  rankPillIcon: { fontSize: 24 },
  rankPillName: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  rankPillSub:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.55)", marginTop: 2 },

  // ── Stats (glowing cards) ──
  statsGrid: { gap: 12 },
  statsRow:  { flexDirection: "row", gap: 12, marginTop: 8 },
  cosmeticsTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "right", marginTop: 8, marginBottom: 4,
  },
  cosmeticsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  cosmeticCard: {
    width: "31%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.18)",
    alignItems: "center", gap: 6,
  },
  cosmeticLabel: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_500Medium" },
  cosmeticPreview: { height: 44, alignItems: "center", justifyContent: "center" },
  cosmeticName: { fontSize: 11, color: "#FFF", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  cosmeticEmpty: {
    flex: 1, padding: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  cosmeticEmptyText: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontFamily: "Inter_400Regular" },
  statBox:   { alignItems: "center", gap: 8, paddingVertical: 18, paddingHorizontal: 8 },
  statBoxCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 22,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOpacity: 0.22,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  statIcon:  { fontSize: 26 },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },

  // ── Progress ──
  progressCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1,
    borderColor: BORDER, padding: 18, gap: 10,
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressTitle:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  progressPct:    { fontSize: 15, fontFamily: "Inter_700Bold" },
  progressTrack:  { height: 8, borderRadius: 4, backgroundColor: "rgba(232,184,109,0.12)", overflow: "hidden" },
  progressFill:   { height: "100%", borderRadius: 4 },
  progressSub:    { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", textAlign: "center" },

  // ── Edit fields ──
  fieldsCard: {
    backgroundColor: CARD, borderRadius: 22, borderWidth: 1,
    borderColor: BORDER, overflow: "hidden",
    shadowColor: PRIMARY, shadowOpacity: 0.18,
    shadowRadius: 14, shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 18,
  },
  fieldIcon: {
    width: 42, height: 42, borderRadius: 12,
    borderWidth: 1, borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  fieldText:  { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
  fieldValue: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },
  divider:    { height: 1, backgroundColor: "rgba(232,184,109,0.18)", marginHorizontal: 18 },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4,
  },
  logoutText: { fontSize: 15, fontFamily: "Inter_700Bold", color: DANGER },

  // Delete account permanently (destructive — sits below logout)
  deleteAcctBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: `${DANGER}80`, borderStyle: "dashed",
    paddingVertical: 14, borderRadius: 16, marginTop: 10, marginBottom: 6,
  },
  deleteAcctText: { fontSize: 14, fontFamily: "Inter_700Bold", color: DANGER },

  // Support
  supportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: `${PRIMARY}12`, borderWidth: 1, borderColor: `${PRIMARY}40`,
    paddingVertical: 14, borderRadius: 16, marginTop: 4, marginBottom: 10,
  },
  supportText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Privacy & Governance
  privacyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: `${PRIMARY}30`,
    paddingVertical: 14, borderRadius: 16, marginBottom: 10,
  },
  privacyText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.70)",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#0F0606",
    borderRadius: 24, padding: 24, gap: 16,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "center" },
  closeBtn: {
    position: "absolute", top: 12, left: 12, zIndex: 10,
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  inputWrap:  {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1, fontSize: 15, fontFamily: "Inter_500Medium",
    color: "#FFF", paddingVertical: 13,
  },
  eyeBtn:  { padding: 8 },
  modalBtns: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    alignItems: "center", paddingVertical: 14,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.50)" },
  saveBtn:   { flex: 1, borderRadius: 14, backgroundColor: PRIMARY, alignItems: "center", paddingVertical: 14 },
  saveText:  { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#FFF" },

  // Tabs
  tabsRow: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12, padding: 4, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  tabTextActive: { color: "#FFF" },

  errorText: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: DANGER, textAlign: "center",
    backgroundColor: `${DANGER}15`, padding: 10, borderRadius: 10,
  },

  // ── Auth modal (new) ──
  authCard: {
    width: "100%", backgroundColor: "#0F0606",
    borderRadius: 28, padding: 22, gap: 14,
    borderWidth: 1, borderColor: BORDER,
    position: "relative",
  },
  authBrand: { alignItems: "center", gap: 4, marginTop: 6 },
  authLogo: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: `${PRIMARY}25`,
    borderWidth: 1.5, borderColor: `${PRIMARY}55`,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  authBrandName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#FFF" },
  authBrandSub:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  authTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 4, gap: 4,
  },
  authTab: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center" },
  authTabActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  authTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
  authTabTextActive: { color: "#FFF" },
  authPrimaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 15, marginTop: 4,
    shadowColor: PRIMARY, shadowOpacity: 0.45,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  authPrimaryText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  authSwitchText:  { fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },

  // Register avatar
  regAvatarWrap: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 2, borderColor: `${PRIMARY}60`, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    position: "relative", overflow: "hidden",
  },
  regAvatarImg: { width: "100%", height: "100%", borderRadius: 43 },
  regAvatarBadge: {
    position: "absolute", bottom: -2, right: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#0F0606",
  },
  regAvatarHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)", marginTop: 6 },

  // Gender
  genderRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  genderBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: BORDER,
  },
  genderBtnActiveMale:   { backgroundColor: "#4FC3F7", borderColor: "#4FC3F7" },
  genderBtnActiveFemale: { backgroundColor: "#F06292", borderColor: "#F06292" },
  genderEmoji: { fontSize: 20 },
  genderText:  { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.65)" },

  // Confirm
  warnIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: `${DANGER}15`, borderWidth: 1, borderColor: `${DANGER}40`,
    alignItems: "center", justifyContent: "center",
  },
  confirmSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.60)", textAlign: "center", lineHeight: 20 },

  // Ranks Modal
  ranksCard: {
    width: "100%", maxHeight: "85%",
    backgroundColor: "#0F0606",
    borderRadius: 24, padding: 18,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  ranksHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingBottom: 6,
  },
  ranksTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF" },
  ranksSubtitle: {
    fontSize: 13, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)", textAlign: "right",
    paddingBottom: 8,
  },
  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.10)",
  },
  rankRowCurrent: {
    backgroundColor: "rgba(232,184,109,0.07)",
    borderColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 }, elevation: 6,
  },
  rankRowIcon: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
  },
  rankRowName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  rankRowSub:  { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(232,184,109,0.65)" },
  rankRowRange:{ fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },
  rankRowStatus: { minWidth: 70, alignItems: "center", justifyContent: "center" },
  hereBadge: {
    backgroundColor: PRIMARY, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  hereBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#000" },
  checkPill: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(125,216,125,0.15)",
    borderWidth: 1, borderColor: "rgba(125,216,125,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  cupsRemainingCol: { alignItems: "center", gap: 3 },
  cupsRemainingNum: { fontSize: 18, fontFamily: "Inter_700Bold", color: PRIMARY },
  cupsRemainingLbl: {
    fontSize: 9, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.50)", textAlign: "center",
  },
  cupsPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  cupsPillNum: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },
  ranksFooter: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingTop: 10, marginTop: 4,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
  },
  ranksFooterText: {
    flex: 1, fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.50)", textAlign: "right",
  },
});
