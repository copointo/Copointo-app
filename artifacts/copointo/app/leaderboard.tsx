import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type CafeProgress, type User } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useCommunities } from "@/context/CommunityContext";
import { getRank } from "@/data/mockData";
import AvatarWithFrame from "@/components/AvatarWithFrame";
import UserBadge from "@/components/UserBadge";
import UsernameBackground from "@/components/UsernameBackground";
import UsernameText from "@/components/UsernameText";
import Character from "@/components/Character";
import { getCharacter } from "@/data/characters";
import { useCharacters } from "@/hooks/useCharacters";
import { useGiftInventory } from "@/hooks/useGiftInventory";
import { useUsernameColors } from "@/hooks/useUsernameColors";
import { useTextStyles } from "@/hooks/useTextStyles";
import { useBackgrounds } from "@/hooks/useBackgrounds";
import { GIFTS } from "@/data/gifts";
import { getUsernameColor } from "@/data/usernameColors";
import { getTextStyle } from "@/data/textStyles";
import { getBackground } from "@/data/backgrounds";
import { LinearGradient } from "expo-linear-gradient";
import { getDefaultAvatarSource } from "@/lib/defaultAvatar";

type LeaderTab = "friends" | "oman" | "communities";

const MEDAL = ["🥇", "🥈", "🥉"];

interface Entry {
  id: string;
  name: string;
  username: string;
  level: number;
  totalOrders: number;
  isMe: boolean;
  isFriend: boolean;
  isPending: boolean;
  hasIncoming: boolean;
  avatar?: string;
  gender?: "male" | "female";
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    user, registeredUsers, friends,
    outgoingRequests, incomingRequests,
    sendFriendRequest, cancelFriendRequest, acceptFriendRequest,
    refreshAllUsers,
  } = useApp();
  const { rankingList } = useCommunities();
  const { equipped: equippedCharacterId } = useCharacters();
  const equippedCharacter = getCharacter(equippedCharacterId);
  const { equipped: equippedUsernameColorId } = useUsernameColors();
  const { equipped: equippedTextStyleId } = useTextStyles();
  const { equipped: equippedBackgroundId } = useBackgrounds();
  const { inventory: giftInventory } = useGiftInventory();
  const { t } = useT();
  const TAB_LABELS: Record<LeaderTab, string> = {
    friends:     t("lb.tabFriends"),
    oman:        t("lb.tabOman"),
    communities: t("lb.tabCommunities"),
  };

  // Pull the latest cross-device user roster on mount AND poll every 6 s
  // while this screen is open, so level-ups happening on other devices
  // appear live (a player's level rises and their rank moves up if they
  // pass someone above them) without the user pulling to refresh.
  useEffect(() => {
    refreshAllUsers().catch(() => {});
    const handle = setInterval(() => { refreshAllUsers().catch(() => {}); }, 6000);
    return () => clearInterval(handle);
  }, [refreshAllUsers]);
  const [activeTab, setActiveTab] = useState<LeaderTab>("friends");
  // ID of the user whose detail panel is currently open (null = closed).
  const [panelUserId, setPanelUserId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toEntry = (u: User): Entry => ({
    id: u.id,
    name: u.name,
    username: u.gameUsername,
    level: u.level,
    totalOrders: u.totalOrders ?? 0,
    isMe: u.id === user?.id,
    isFriend: friends.includes(u.id),
    isPending: outgoingRequests.includes(u.id),
    hasIncoming: incomingRequests.includes(u.id),
    avatar: u.avatar,
    gender: u.gender,
  });

  const sortDesc = (a: Entry, b: Entry) => b.level - a.level;

  const entries = useMemo<Entry[]>(() => {
    if (activeTab === "oman") {
      return registeredUsers.map(toEntry).sort(sortDesc);
    }
    // friends tab: friends + me, but only if user has at least one friend
    if (friends.length === 0) return [];
    return registeredUsers
      .filter(u => friends.includes(u.id) || u.id === user?.id)
      .map(toEntry)
      .sort(sortDesc);
    // Note: outgoingRequests / incomingRequests are intentionally part of
    // the dep list so the +/⏳/✓ button states re-render when they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, registeredUsers, friends, user?.id, outgoingRequests, incomingRequests]);

  const handleSendRequest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendFriendRequest(id);
  };

  const handleCancelRequest = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelFriendRequest(id);
  };

  const openPanel = (uid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPanelUserId(uid);
  };

  // Oman-wide rank for any given user (1-based, by level desc).
  const omanRankOf = useMemo(() => {
    const sorted = [...registeredUsers].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    const map = new Map<string, number>();
    sorted.forEach((u, i) => map.set(u.id, i + 1));
    return map;
  }, [registeredUsers]);

  const panelUser = panelUserId ? registeredUsers.find(u => u.id === panelUserId) ?? null : null;

  const emptyMsg =
    activeTab === "friends"     ? t("lb.emptyFriends")
    : activeTab === "communities" ? t("lb.emptyCommunities")
    :                               t("lb.emptyOman");
  const emptySub =
    activeTab === "friends"     ? t("lb.emptyFriendsSub")
    : activeTab === "communities" ? t("lb.emptyCommunitiesSub")
    :                               t("lb.emptyOmanSub");

  const openCommunity = (cid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/community-info", params: { id: cid } });
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("lb.title")}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(Object.keys(TAB_LABELS) as LeaderTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(tab);
            }}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entries */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Communities ranking tab ───────────────────────────── */}
        {activeTab === "communities" ? (
          rankingList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🏘️</Text>
              <Text style={styles.emptyTitle}>{emptyMsg}</Text>
              <Text style={styles.emptySub}>{emptySub}</Text>
            </View>
          ) : (
            rankingList.map((r, i) => {
              const isMine = !!user && r.community.members.includes(user.id);
              return (
                <TouchableOpacity
                  key={r.community.id}
                  activeOpacity={0.85}
                  onPress={() => openCommunity(r.community.id)}
                  style={[
                    styles.entryRow,
                    isMine && styles.entryRowMe,
                    i === 0 && styles.entryRowFirst,
                  ]}
                >
                  <Text style={[
                    styles.entryRankNum,
                    { color: i === 0 ? "#FFD700" : i === 1 ? "#A8A8A8" : i === 2 ? "#CD7F32" : "#999" },
                  ]}>
                    {MEDAL[i] ?? `#${i + 1}`}
                  </Text>

                  {r.community.avatar ? (
                    <Image source={{ uri: r.community.avatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatar, isMine && { backgroundColor: "rgba(232,184,109,0.30)" }]}>
                      <Text style={{ fontSize: 20 }}>🏘️</Text>
                    </View>
                  )}

                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, isMine && { color: "#E8B86D" }]} numberOfLines={1}>
                      {r.community.name}{isMine ? t("lb.yourCommunity") : ""}
                    </Text>
                    <Text style={styles.entryLevel}>
                      {t("lb.communityMembers", { n: String(r.community.members.length) })}
                    </Text>
                    <View style={styles.coffeeChip}>
                      <Text style={styles.coffeeChipText}>{t("lb.coffeeCount", { n: String(r.score) })}</Text>
                    </View>
                  </View>

                  <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.45)" />
                </TouchableOpacity>
              );
            })
          )
        ) : entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🏁</Text>
            <Text style={styles.emptyTitle}>{emptyMsg}</Text>
            <Text style={styles.emptySub}>{emptySub}</Text>
          </View>
        ) : entries.map((entry, i) => {
          const rankInfo = getRank(entry.level);
          const rowInner = (
            <>
              <Text style={[
                styles.entryRankNum,
                { color: i === 0 ? "#FFD700" : i === 1 ? "#A8A8A8" : i === 2 ? "#CD7F32" : "#999" },
              ]}>
                {MEDAL[i] ?? `#${i + 1}`}
              </Text>

              <AvatarWithFrame
                size={44}
                scale={1.55}
                frameId={entry.isMe ? undefined : null}
              >
                {entry.avatar ? (
                  <Image source={{ uri: entry.avatar }} style={styles.avatarImg} />
                ) : (
                  <Image
                    source={getDefaultAvatarSource(entry.gender as "male" | "female" | undefined)}
                    style={styles.avatarImg}
                  />
                )}
              </AvatarWithFrame>

              <View style={styles.entryInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {entry.isMe ? (
                    <UsernameText
                      text={`${entry.name}${t("lb.youSuffix")}`}
                      style={[styles.entryName, { color: "#E8B86D" }]}
                      fallbackColor="#E8B86D"
                      numberOfLines={1}
                    />
                  ) : (
                    <Text style={styles.entryName}>
                      {entry.name}
                    </Text>
                  )}
                  {entry.isMe && <UserBadge size={18} />}
                </View>
                <Text style={styles.entryLevel}>
                  {t("lb.levelLabel", { n: String(entry.level), rank: `${rankInfo.nameEn} ${rankInfo.icon}` })}
                </Text>
                <View style={styles.coffeeChip}>
                  <Text style={styles.coffeeChipText}>{t("lb.coffeeCount", { n: String(entry.totalOrders) })}</Text>
                </View>
              </View>

              {!entry.isMe && !entry.isFriend && !entry.isPending && !entry.hasIncoming && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => handleSendRequest(entry.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="user-plus" size={14} color="#000" />
                </TouchableOpacity>
              )}
              {!entry.isMe && !entry.isFriend && entry.hasIncoming && (
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: "#7DD87D" }]}
                  onPress={() => handleSendRequest(entry.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={14} color="#000" />
                </TouchableOpacity>
              )}
              {!entry.isMe && !entry.isFriend && entry.isPending && (
                <TouchableOpacity
                  style={styles.pendingTag}
                  onPress={() => handleCancelRequest(entry.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pendingTagText}>{t("lb.pendingTag")}</Text>
                </TouchableOpacity>
              )}
              {entry.isFriend && !entry.isMe && (
                <View style={styles.friendTag}>
                  <Text style={styles.friendTagText}>{t("lb.friendTag")}</Text>
                </View>
              )}
            </>
          );
          if (entry.isMe) {
            return (
              <TouchableOpacity
                key={entry.id}
                activeOpacity={0.85}
                onPress={() => openPanel(entry.id)}
                style={{ borderRadius: 18 }}
              >
                <UsernameBackground
                  borderRadius={18}
                  paddingHorizontal={14}
                  paddingVertical={14}
                  style={{ alignSelf: "stretch" }}
                >
                  <View style={styles.entryRowContent}>{rowInner}</View>
                  {equippedCharacter && (
                    <View style={styles.charBadge} pointerEvents="none">
                      <Character def={equippedCharacter} size={28} />
                    </View>
                  )}
                </UsernameBackground>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={entry.id}
              activeOpacity={0.85}
              onPress={() => openPanel(entry.id)}
              style={[
                styles.entryRow,
                i === 0 && styles.entryRowFirst,
              ]}
            >
              {rowInner}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── User detail panel (bottom sheet) ─────────────────────── */}
      <UserDetailPanel
        targetUser={panelUser}
        myId={user?.id ?? null}
        omanRank={panelUser ? omanRankOf.get(panelUser.id) ?? null : null}
        isFriend={!!(panelUser && friends.includes(panelUser.id))}
        isPending={!!(panelUser && outgoingRequests.includes(panelUser.id))}
        hasIncoming={!!(panelUser && incomingRequests.includes(panelUser.id))}
        myEquippedCharacterId={equippedCharacterId}
        myEquippedUsernameColorId={equippedUsernameColorId}
        myEquippedTextStyleId={equippedTextStyleId}
        myEquippedBackgroundId={equippedBackgroundId}
        myGiftInventory={giftInventory}
        onSend={(uid) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); sendFriendRequest(uid); }}
        onAccept={(uid) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); acceptFriendRequest(uid); }}
        onCancel={(uid) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cancelFriendRequest(uid); }}
        onClose={() => setPanelUserId(null)}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bottom-sheet panel showing a single user's classification, level,
// per-cafe coffee breakdown, grand total, and friend-add button.
// ─────────────────────────────────────────────────────────────────
interface PanelProps {
  targetUser: User | null;
  myId: string | null;
  omanRank: number | null;
  isFriend: boolean;
  isPending: boolean;
  hasIncoming: boolean;
  /** Local-only: my equipped cosmetics (only meaningful when viewing self). */
  myEquippedCharacterId: string | null;
  myEquippedUsernameColorId: string | null;
  myEquippedTextStyleId: string | null;
  myEquippedBackgroundId: string | null;
  myGiftInventory: Record<string, number>;
  onSend: (uid: string) => void;
  onAccept: (uid: string) => void;
  onCancel: (uid: string) => void;
  onClose: () => void;
}

function UserDetailPanel(p: PanelProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const open = !!p.targetUser;
  const u = p.targetUser;
  const isMe = !!(u && p.myId && u.id === p.myId);

  const cafes: CafeProgress[] = useMemo(() => {
    if (!u?.cafeProgress) return [];
    return Object.values(u.cafeProgress)
      .filter((c) => (c.totalOrders ?? 0) > 0)
      .sort((a, b) => b.totalOrders - a.totalOrders);
  }, [u]);
  const grandTotal = cafes.reduce((s, c) => s + (c.totalOrders ?? 0), 0);
  const rank = u ? getRank(u.level) : null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={p.onClose}
    >
      <Pressable style={panelStyles.backdrop} onPress={p.onClose}>
        {/* Stop-propagation wrapper so taps inside the sheet don't dismiss. */}
        <Pressable
          style={[panelStyles.sheet, { paddingBottom: insets.bottom + 24 }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <View style={panelStyles.handle} />

          {/* Close (X) button */}
          <TouchableOpacity style={panelStyles.closeBtn} onPress={p.onClose} activeOpacity={0.8}>
            <Feather name="x" size={20} color="#FFF" />
          </TouchableOpacity>

          {!u ? null : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header: avatar + name + username */}
              <View style={panelStyles.headerRow}>
                {u.avatar ? (
                  <Image source={{ uri: u.avatar }} style={panelStyles.avatarImg} />
                ) : (
                  <View style={panelStyles.avatarCircle}>
                    <Text style={{ fontSize: 40 }}>
                      {u.gender === "female" ? "👩" : u.gender === "male" ? "🧑" : "👤"}
                    </Text>
                  </View>
                )}
                <Text style={panelStyles.name}>{u.name}{isMe ? t("lb.youSuffix") : ""}</Text>
                <Text style={panelStyles.username}>@{u.gameUsername}</Text>
              </View>

              {/* Stats: rank · level · total coffees */}
              <View style={panelStyles.statsRow}>
                <View style={panelStyles.statBox}>
                  <Text style={panelStyles.statValue}>{p.omanRank ? `#${p.omanRank}` : "—"}</Text>
                  <Text style={panelStyles.statLabel}>{t("lb.panelOmanRank")}</Text>
                </View>
                <View style={panelStyles.statDivider} />
                <View style={panelStyles.statBox}>
                  <Text style={[panelStyles.statValue, { color: "#E8B86D" }]}>{u.level}</Text>
                  <Text style={panelStyles.statLabel}>{t("lb.panelLevel")}</Text>
                </View>
                <View style={panelStyles.statDivider} />
                <View style={panelStyles.statBox}>
                  <Text style={[panelStyles.statValue, { color: "#4FC3F7" }]}>{grandTotal}</Text>
                  <Text style={panelStyles.statLabel}>{t("lb.panelTotalCoffee")}</Text>
                </View>
              </View>

              {/* Rank badge */}
              {rank && (
                <View style={panelStyles.rankBadge}>
                  <Text style={panelStyles.rankIcon}>{rank.icon}</Text>
                  <Text style={panelStyles.rankName}>{rank.name}</Text>
                </View>
              )}

              {/* Per-cafe breakdown */}
              <Text style={panelStyles.sectionTitle}>{t("lb.panelPerCafe")}</Text>
              {cafes.length === 0 ? (
                <View style={panelStyles.emptyCafes}>
                  <Text style={panelStyles.emptyCafesText}>
                    {t("lb.panelEmptyCafes")}
                  </Text>
                </View>
              ) : (
                <View style={panelStyles.cafeList}>
                  {cafes.map((c) => (
                    <View key={c.cafeId} style={panelStyles.cafeRow}>
                      <Text style={panelStyles.cafeName} numberOfLines={1}>
                        {c.cafeName}
                      </Text>
                      <View style={panelStyles.cafeQtyPill}>
                        <Text style={panelStyles.cafeQtyText}>{c.totalOrders}</Text>
                      </View>
                    </View>
                  ))}
                  {/* Grand total row */}
                  <View style={[panelStyles.cafeRow, panelStyles.totalRow]}>
                    <Text style={panelStyles.totalLabel}>{t("lb.panelTotal")}</Text>
                    <View style={[panelStyles.cafeQtyPill, { backgroundColor: "#E8B86D" }]}>
                      <Text style={[panelStyles.cafeQtyText, { color: "#000" }]}>{grandTotal}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ── My equipped theme (visible only when viewing self) ── */}
              {isMe && (() => {
                const ch  = getCharacter(p.myEquippedCharacterId);
                const uc  = getUsernameColor(p.myEquippedUsernameColorId);
                const ts  = getTextStyle(p.myEquippedTextStyleId);
                const bg  = getBackground(p.myEquippedBackgroundId);
                const ucColor = uc?.color ?? uc?.gradient?.[0] ?? uc?.mix?.[0] ?? "rgba(255,255,255,0.40)";
                return (
                  <>
                    <Text style={panelStyles.sectionTitle}>الثيم المفعّل</Text>
                    <View style={panelStyles.themeGrid}>
                      {/* Character */}
                      <View style={panelStyles.themeCard}>
                        <Text style={panelStyles.themeLabel}>الشخصية</Text>
                        <View style={panelStyles.themePreviewBox}>
                          {ch ? <Character def={ch} size={28} /> : <Text style={panelStyles.themeEmpty}>—</Text>}
                        </View>
                        <Text style={panelStyles.themeName} numberOfLines={1}>{ch?.name ?? "بدون"}</Text>
                      </View>

                      {/* Username color */}
                      <View style={panelStyles.themeCard}>
                        <Text style={panelStyles.themeLabel}>لون المستخدم</Text>
                        <View style={panelStyles.themePreviewBox}>
                          {uc ? (
                            <Text style={[panelStyles.themePreviewText, { color: ucColor }]}>أبجد</Text>
                          ) : (
                            <Text style={panelStyles.themeEmpty}>—</Text>
                          )}
                        </View>
                        <Text style={panelStyles.themeName} numberOfLines={1}>{uc?.name ?? "بدون"}</Text>
                      </View>

                      {/* Text style */}
                      <View style={panelStyles.themeCard}>
                        <Text style={panelStyles.themeLabel}>نص ملون</Text>
                        <View style={[panelStyles.themePreviewBox, { padding: 0, overflow: "hidden" }]}>
                          {ts ? (
                            ts.bg?.gradient ? (
                              <LinearGradient
                                colors={[...ts.bg.gradient]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={panelStyles.tsBubble}
                              >
                                <Text style={[panelStyles.tsText, { color: ts.textColor }]}>أبجد</Text>
                              </LinearGradient>
                            ) : (
                              <View style={[
                                panelStyles.tsBubble,
                                { backgroundColor: ts.bg?.color ?? "transparent",
                                  borderColor: ts.bg?.border ?? "transparent",
                                  borderWidth: ts.bg ? 1 : 0 },
                              ]}>
                                <Text style={[panelStyles.tsText, { color: ts.textColor }]}>أبجد</Text>
                              </View>
                            )
                          ) : <Text style={panelStyles.themeEmpty}>—</Text>}
                        </View>
                        <Text style={panelStyles.themeName} numberOfLines={1}>{ts?.name ?? "بدون"}</Text>
                      </View>

                      {/* Background */}
                      <View style={panelStyles.themeCard}>
                        <Text style={panelStyles.themeLabel}>الخلفية</Text>
                        <View style={[panelStyles.themePreviewBox, { padding: 0, overflow: "hidden" }]}>
                          {bg ? (
                            <LinearGradient
                              colors={bg.colors as unknown as readonly [string, string, ...string[]]}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                              style={{ width: "100%", height: "100%", borderRadius: 8 }}
                            />
                          ) : <Text style={panelStyles.themeEmpty}>—</Text>}
                        </View>
                        <Text style={panelStyles.themeName} numberOfLines={1}>{bg?.name ?? "بدون"}</Text>
                      </View>
                    </View>
                  </>
                );
              })()}

              {/* ── Gifts inventory (visible only when viewing self) ── */}
              {isMe && (() => {
                const entries = GIFTS
                  .map(g => ({ g, n: p.myGiftInventory[g.id] ?? 0 }))
                  .filter(x => x.n > 0);
                const total = entries.reduce((s, x) => s + x.n, 0);
                return (
                  <>
                    <View style={panelStyles.giftsHeaderRow}>
                      <Text style={panelStyles.sectionTitle}>الهدايا</Text>
                      <View style={panelStyles.giftsTotalPill}>
                        <Text style={panelStyles.giftsTotalText}>{total}</Text>
                      </View>
                    </View>
                    {entries.length === 0 ? (
                      <View style={panelStyles.emptyCafes}>
                        <Text style={panelStyles.emptyCafesText}>ما عندك هدايا حالياً — تقدر تشتري من المتجر</Text>
                      </View>
                    ) : (
                      <View style={panelStyles.giftGrid}>
                        {entries.map(({ g, n }) => (
                          <View key={g.id} style={[panelStyles.giftCard, { borderColor: g.color + "55" }]}>
                            <Text style={panelStyles.giftEmoji}>{g.emoji}</Text>
                            <Text style={panelStyles.giftName} numberOfLines={1}>{g.name}</Text>
                            <View style={[panelStyles.giftCountPill, { backgroundColor: g.color + "22", borderColor: g.color + "66" }]}>
                              <Text style={[panelStyles.giftCountText, { color: g.color }]}>×{n}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                );
              })()}

              {/* Friend-add button (hidden when viewing self) */}
              {!isMe && p.myId && (
                <View style={{ marginTop: 18 }}>
                  {p.isFriend ? (
                    <View style={[panelStyles.actionBtn, { backgroundColor: "#4CAF50" }]}>
                      <Feather name="check" size={16} color="#FFF" />
                      <Text style={[panelStyles.actionText, { color: "#FFF" }]}>{t("lb.friendTag")}</Text>
                    </View>
                  ) : p.hasIncoming ? (
                    <TouchableOpacity
                      style={[panelStyles.actionBtn, { backgroundColor: "#4CAF50" }]}
                      onPress={() => p.onAccept(u.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name="check" size={16} color="#FFF" />
                      <Text style={[panelStyles.actionText, { color: "#FFF" }]}>{t("lb.panelAcceptRequest")}</Text>
                    </TouchableOpacity>
                  ) : p.isPending ? (
                    <TouchableOpacity
                      style={[panelStyles.actionBtn, panelStyles.actionBtnPending]}
                      onPress={() => p.onCancel(u.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name="clock" size={16} color="#E8B86D" />
                      <Text style={[panelStyles.actionText, { color: "#E8B86D" }]}>{t("lb.panelPendingCancel")}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={panelStyles.actionBtn}
                      onPress={() => p.onSend(u.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name="user-plus" size={16} color="#000" />
                      <Text style={panelStyles.actionText}>{t("lb.panelAddFriend")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    flex: 1, fontSize: 20,
    fontFamily: "Inter_700Bold", color: "#FFF",
  },
  tabsRow: {
    flexDirection: "row",
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(232,184,109,0.08)",
    borderRadius: 16, padding: 4, gap: 2,
  },
  tabBtn: {
    flex: 1, paddingVertical: 9,
    borderRadius: 12, alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#E8B86D" },
  tabText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.65)",
  },
  tabTextActive: { color: "#000000" },
  list: { flex: 1 },
  entryRow: {
    flexDirection: "row", alignItems: "center",
    gap: 12, padding: 14, borderRadius: 18,
    backgroundColor: "#0A0606",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  entryRowContent: {
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  entryRowMe: {
    backgroundColor: "rgba(232,184,109,0.10)", borderColor: "#E8B86D",
  },
  entryRowFirst: {
    borderColor: "rgba(255,215,0,0.4)", backgroundColor: "rgba(255,215,0,0.08)",
  },
  entryRankNum: {
    fontSize: 20, fontFamily: "Inter_700Bold",
    width: 32, textAlign: "center",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  avatarImg: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.20)",
  },
  entryInfo: { flex: 1 },
  entryName: {
    fontSize: 14, fontFamily: "Inter_600SemiBold",
    color: "#FFF", marginBottom: 3,
  },
  entryLevel: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#E8B86D",
    alignItems: "center", justifyContent: "center",
  },
  profileBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  friendTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, backgroundColor: "#0A0606", borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  friendTagText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  pendingTag: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 10, backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.40)",
    borderStyle: "dashed",
  },
  pendingTagText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "#E8B86D",
  },
  emptyWrap: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 32,
  },
  coffeeChip: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8, paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: "rgba(79,195,247,0.12)",
    borderWidth: 1, borderColor: "rgba(79,195,247,0.35)",
  },
  coffeeChipText: { fontSize: 10.5, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  charBadge: {
    position: "absolute",
    right: 6,
    top: "50%",
    marginTop: -25,
    width: 50, height: 50,
    alignItems: "center", justifyContent: "center",
  },
});

const panelStyles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0A0606",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 22, paddingTop: 14,
    maxHeight: "85%",
    borderTopWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  handle: {
    alignSelf: "center", width: 44, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)", marginBottom: 8,
  },
  closeBtn: {
    position: "absolute", top: 14, left: 18,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center", zIndex: 5,
  },
  headerRow: { alignItems: "center", gap: 4, marginTop: 4, marginBottom: 14 },
  avatarImg: {
    width: 84, height: 84, borderRadius: 42,
    borderWidth: 2.5, borderColor: "rgba(232,184,109,0.35)",
  },
  avatarCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  name: { fontSize: 19, fontFamily: "Inter_700Bold", color: "#FFF", marginTop: 8 },
  username: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statBox: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  statLabel: { fontSize: 10.5, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.50)" },
  rankBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    alignSelf: "center", marginTop: 12,
    paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)", borderRadius: 20,
    backgroundColor: "rgba(232,184,109,0.10)",
  },
  rankIcon: { fontSize: 16 },
  rankName: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#E8B86D" },
  sectionTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF",
    marginTop: 20, marginBottom: 10,
  },
  cafeList: { gap: 8 },
  cafeRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  cafeName: {
    flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFF",
    marginRight: 12,
  },
  cafeQtyPill: {
    minWidth: 38, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, backgroundColor: "rgba(79,195,247,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  cafeQtyText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#4FC3F7" },
  totalRow: {
    marginTop: 4,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderColor: "rgba(232,184,109,0.45)",
  },
  totalLabel: { flex: 1, fontSize: 13.5, fontFamily: "Inter_700Bold", color: "#E8B86D" },
  emptyCafes: {
    padding: 18, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  emptyCafesText: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#E8B86D",
    paddingVertical: 13, borderRadius: 14,
  },
  actionBtnPending: {
    backgroundColor: "transparent",
    borderWidth: 1, borderColor: "#E8B86D", borderStyle: "dashed",
  },
  actionText: { fontSize: 13.5, fontFamily: "Inter_700Bold", color: "#000" },

  // ── Theme grid ───────────────────────────────────────────────
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themeCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
    borderRadius: 14, padding: 10, alignItems: "center", gap: 6,
  },
  themeLabel: {
    fontSize: 10.5, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.55)",
  },
  themePreviewBox: {
    width: "100%", height: 50, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center", justifyContent: "center",
    padding: 4,
  },
  themePreviewText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  themeEmpty: { fontSize: 18, color: "rgba(255,255,255,0.30)" },
  themeName: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "center",
  },
  tsBubble: {
    width: "100%", height: "100%",
    borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  tsText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // ── Gifts grid ────────────────────────────────────────────────
  giftsHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  giftsTotalPill: {
    marginTop: 14,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(232,184,109,0.15)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.45)",
  },
  giftsTotalText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#E8B86D" },
  giftGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  giftCard: {
    width: "31.5%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6,
    alignItems: "center", gap: 4,
  },
  giftEmoji: { fontSize: 28 },
  giftName: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)", textAlign: "center",
  },
  giftCountPill: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, marginTop: 2,
  },
  giftCountText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
