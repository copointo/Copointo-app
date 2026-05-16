import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
import { useFrames } from "@/hooks/useFrames";
import { useBadges } from "@/hooks/useBadges";
import { useMessages } from "@/context/MessagesContext";
import { useUsernameColors } from "@/hooks/useUsernameColors";
import { useTextStyles } from "@/hooks/useTextStyles";
import { useBackgrounds } from "@/hooks/useBackgrounds";
import { GIFTS, GiftDef } from "@/data/gifts";
import GiftPicker from "@/components/GiftPicker";
import GiftAnimation from "@/components/GiftAnimation";
import { useGiftInventory } from "@/hooks/useGiftInventory";
import type { ChatMessage } from "@/data/mockData";
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
  /** Equipped cosmetics — populated from the server-mirrored loadout so
   *  every viewer sees every player's frame / badge / character / colors,
   *  not just their own. Falls back to null when the player has nothing
   *  equipped or the field hasn't synced yet. */
  equippedFrame: string | null;
  equippedBadge: string | null;
  equippedBackground: string | null;
  equippedCharacter: string | null;
  equippedUsernameColor: string | null;
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
  const { equipped: equippedFrameId } = useFrames();
  const { equipped: equippedBadgeId } = useBadges();
  const { chats } = useMessages();
  const giftsReceived = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const list of Object.values(chats)) {
      for (const m of list) {
        if (!m.fromMe && m.giftId) {
          counts[m.giftId] = (counts[m.giftId] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [chats]);
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

  const toEntry = (u: User): Entry => {
    const isMe = u.id === user?.id;
    return {
      id: u.id,
      name: u.name,
      username: u.gameUsername,
      level: u.level,
      totalOrders: u.totalOrders ?? 0,
      isMe,
      isFriend: friends.includes(u.id),
      isPending: outgoingRequests.includes(u.id),
      hasIncoming: incomingRequests.includes(u.id),
      avatar: u.avatar,
      gender: u.gender,
      // For the current user we prefer the locally-equipped IDs (the
      // per-cosmetic hooks are the source of truth on this device, and they
      // update instantly on equip without waiting for the next server poll).
      // For everyone else we use the server-mirrored values that arrived via
      // refreshAllUsers().
      equippedFrame:         isMe ? equippedFrameId         : (u.equippedFrame         ?? null),
      equippedBadge:         isMe ? equippedBadgeId         : (u.equippedBadge         ?? null),
      equippedBackground:    isMe ? equippedBackgroundId    : (u.equippedBackground    ?? null),
      equippedCharacter:     isMe ? equippedCharacterId     : (u.equippedCharacter     ?? null),
      equippedUsernameColor: isMe ? equippedUsernameColorId : (u.equippedUsernameColor ?? null),
    };
  };

  // Sort by total coffee orders (Copointo Hub progress) — that's the real
  // engagement metric the leaderboard should reflect, not the most recent
  // joiner. Level is kept as a tiebreaker so two equal counts still order
  // deterministically.
  const sortDesc = (a: Entry, b: Entry) =>
    (b.totalOrders - a.totalOrders) || (b.level - a.level);

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

  // Oman-wide rank for any given user (1-based, by total coffee orders desc;
  // level breaks ties). Mirrors the leaderboard list ordering above.
  const omanRankOf = useMemo(() => {
    const sorted = [...registeredUsers].sort((a, b) =>
      ((b.totalOrders ?? 0) - (a.totalOrders ?? 0)) || ((b.level ?? 0) - (a.level ?? 0))
    );
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
              // Pull the leader's equipped cosmetics so the community row in
              // the ranking is themed by their loadout (frame, badge,
              // background, character) — visible to all viewers.
              const leaderId = r.community.createdBy;
              const leader = leaderId ? registeredUsers.find(u => u.id === leaderId) : undefined;
              const leaderFrameId      = leader?.equippedFrame      ?? null;
              const leaderBadgeId      = leader?.equippedBadge      ?? null;
              const leaderBgId         = leader?.equippedBackground ?? null;
              const leaderCharacterDef = getCharacter(leader?.equippedCharacter ?? null);
              const leaderUsernameColor = getUsernameColor(leader?.equippedUsernameColor ?? null);
              const innerRow = (
                <>
                  <Text style={[
                    styles.entryRankNum,
                    { color: i === 0 ? "#FFD700" : i === 1 ? "#A8A8A8" : i === 2 ? "#CD7F32" : "#999" },
                  ]}>
                    {MEDAL[i] ?? `#${i + 1}`}
                  </Text>

                  <AvatarWithFrame size={44} scale={1.55} frameId={leaderFrameId}>
                    {r.community.avatar ? (
                      <Image source={{ uri: r.community.avatar }} style={styles.avatarImg} />
                    ) : leader?.avatar ? (
                      <Image source={{ uri: leader.avatar }} style={styles.avatarImg} />
                    ) : (
                      <Image
                        source={getDefaultAvatarSource(leader?.gender as "male" | "female" | undefined)}
                        style={styles.avatarImg}
                      />
                    )}
                  </AvatarWithFrame>

                  <View style={styles.entryInfo}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <UsernameText
                        text={`${r.community.name}${isMine ? t("lb.yourCommunity") : ""}`}
                        style={[styles.entryName, isMine && { color: "#E8B86D" }]}
                        override={leaderUsernameColor}
                        fallbackColor={isMine ? "#E8B86D" : "#FFFFFF"}
                        numberOfLines={1}
                      />
                      <UserBadge badgeId={leaderBadgeId} size={26} />
                      {leaderCharacterDef && <Character def={leaderCharacterDef} size={22} />}
                    </View>
                    <Text style={styles.entryLevel}>
                      {t("lb.communityMembers", { n: String(r.community.members.length) })}
                    </Text>
                    <View style={styles.coffeeChip}>
                      <Text style={styles.coffeeChipText}>{t("lb.coffeeCount", { n: String(r.score) })}</Text>
                    </View>
                  </View>

                  <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.45)" />
                </>
              );
              if (leaderBgId) {
                return (
                  <TouchableOpacity
                    key={r.community.id}
                    activeOpacity={0.85}
                    onPress={() => openCommunity(r.community.id)}
                    style={{ borderRadius: 18 }}
                  >
                    <UsernameBackground
                      backgroundId={leaderBgId}
                      borderRadius={18}
                      paddingHorizontal={14}
                      paddingVertical={14}
                      style={{ alignSelf: "stretch" }}
                    >
                      <View style={styles.entryRowContent}>{innerRow}</View>
                    </UsernameBackground>
                  </TouchableOpacity>
                );
              }
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
                  {innerRow}
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
          // Resolve each cosmetic from the entry's own equipped IDs so EVERY
          // viewer sees the player's actual loadout — frame, badge, character,
          // username color and background — not just their own.
          const entryCharacter = getCharacter(entry.equippedCharacter);
          const entryUsernameColor = getUsernameColor(entry.equippedUsernameColor);
          const entryBg = entry.equippedBackground;
          const rowInner = (
            <>
              <AvatarWithFrame
                size={44}
                scale={1.55}
                frameId={entry.equippedFrame}
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
                  <UsernameText
                    text={entry.username
                      ? `@${entry.username}${entry.isMe ? t("lb.youSuffix") : ""}`
                      : `${entry.name}${entry.isMe ? t("lb.youSuffix") : ""}`}
                    style={[styles.entryName, entry.isMe && { color: "#E8B86D" }]}
                    override={entryUsernameColor}
                    fallbackColor={entry.isMe ? "#E8B86D" : "#FFFFFF"}
                    numberOfLines={1}
                  />
                  <UserBadge badgeId={entry.equippedBadge} size={28} />
                </View>
                {entry.username && entry.name && (
                  <Text style={styles.entryRealName} numberOfLines={1}>
                    {entry.name}
                  </Text>
                )}
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
          // Floating rank badge anchored to the TOP-LEFT corner of the row
          // (away from the character on the right) so the medal never sits on
          // top of the avatar/character. Top-3 get gold/silver/bronze color
          // and the medal emoji; everyone else just gets a small "#N" chip.
          const isTop3 = i < 3;
          const medalColor = i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#999";
          const rankBadge = (
            <View
              pointerEvents="none"
              style={[
                styles.rankCornerBadge,
                isTop3 && {
                  backgroundColor: i === 0 ? "rgba(255,215,0,0.18)"
                    : i === 1 ? "rgba(192,192,192,0.18)"
                    : "rgba(205,127,50,0.18)",
                  borderColor: medalColor,
                },
              ]}
            >
              <Text style={[styles.rankCornerText, { color: medalColor }]}>
                {isTop3 ? `${MEDAL[i]} ${i + 1}` : `#${i + 1}`}
              </Text>
              {entry.avatar ? (
                <Image source={{ uri: entry.avatar }} style={styles.rankCornerAvatar} />
              ) : (
                <Image
                  source={getDefaultAvatarSource(entry.gender as "male" | "female" | undefined)}
                  style={styles.rankCornerAvatar}
                />
              )}
              {entryCharacter && (
                <View style={styles.rankCornerChar}>
                  <Character def={entryCharacter} size={18} />
                </View>
              )}
            </View>
          );
          // Wrap rows that have a background in UsernameBackground so the
          // animated card shows for every player (not just the current user).
          // Rows without a background fall back to the plain entryRow style.
          if (entryBg) {
            return (
              <TouchableOpacity
                key={entry.id}
                activeOpacity={0.85}
                onPress={() => openPanel(entry.id)}
                style={{ borderRadius: 18 }}
              >
                <UsernameBackground
                  backgroundId={entryBg}
                  borderRadius={18}
                  paddingHorizontal={14}
                  paddingVertical={14}
                  style={{ alignSelf: "stretch" }}
                >
                  <View style={styles.entryRowContent}>{rowInner}</View>
                  {rankBadge}
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
              {rankBadge}
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
        myGiftsReceived={giftsReceived}
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
  myGiftsReceived: Record<string, number>;
  onSend: (uid: string) => void;
  onAccept: (uid: string) => void;
  onCancel: (uid: string) => void;
  onClose: () => void;
}

function UserDetailPanel(p: PanelProps) {
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const router = useRouter();
  const open = !!p.targetUser;
  const u = p.targetUser;
  const isMe = !!(u && p.myId && u.id === p.myId);

  // ── Gift sending (to other users only) ─────────────────────
  const { consumeGift } = useGiftInventory();
  const { appendMsg } = useMessages();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [animGift, setAnimGift] = useState<GiftDef | null>(null);
  const [animQty, setAnimQty]   = useState<number>(1);

  const sendGift = async (gift: GiftDef, qty: number) => {
    if (!u) return;
    const ok = await consumeGift(gift.id, qty);
    if (!ok) {
      setPickerOpen(false);
      Alert.alert("ما عندك كفاية من هذي الهدية", "اشتر هدايا إضافية من المتجر أولاً.");
      return;
    }
    setPickerOpen(false);
    const convId = `friend_${u.id}`;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const period = h >= 12 ? "م" : "ص";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const giftMsg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: qty > 1 ? `🎁 ${qty}× ${gift.name}` : `🎁 ${gift.name}`,
      fromMe: true,
      time: `${h12}:${m} ${period}`,
      seen: false,
      giftId: gift.id,
      giftQty: qty,
      recipientName: u.gameUsername || u.name,
    };
    appendMsg(convId, giftMsg);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Close the panel and take the sender to the Copointo Hub home so they
    // see the rain animation alongside every other user on the platform.
    p.onClose();
    router.replace("/(tabs)/game");
  };

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
                <TouchableOpacity
                  style={panelStyles.fullProfileBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    p.onClose();
                    router.push({ pathname: "/competitor-profile", params: { id: u.gameUsername } });
                  }}
                >
                  <Feather name="user" size={14} color="#000" />
                  <Text style={panelStyles.fullProfileBtnText}>عرض الملف الشخصي الكامل</Text>
                </TouchableOpacity>
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
                  .map(g => ({ g, n: p.myGiftsReceived[g.id] ?? 0 }))
                  .filter(x => x.n > 0);
                const total = entries.reduce((s, x) => s + x.n, 0);
                return (
                  <>
                    <View style={panelStyles.giftsHeaderRow}>
                      <Text style={panelStyles.sectionTitle}>الهدايا التي أُهديت لك</Text>
                      <View style={panelStyles.giftsTotalPill}>
                        <Text style={panelStyles.giftsTotalText}>{total}</Text>
                      </View>
                    </View>
                    {entries.length === 0 ? (
                      <View style={panelStyles.emptyCafes}>
                        <Text style={panelStyles.emptyCafesText}>ما وصلتك هدايا بعد</Text>
                      </View>
                    ) : (
                      <View style={panelStyles.giftGrid}>
                        {entries.map(({ g, n }) => (
                          <View key={g.id} style={[panelStyles.giftCard, { borderColor: g.color + "55" }]}>
                            {g.image ? (
                              <Image source={g.image} style={{ width: 32, height: 32, marginBottom: 4 }} resizeMode="contain" />
                            ) : (
                              <Text style={panelStyles.giftEmoji}>{g.emoji}</Text>
                            )}
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

              {/* Send-gift button (hidden when viewing self) */}
              {!isMe && p.myId && (
                <TouchableOpacity
                  style={[panelStyles.actionBtn, { marginTop: 18, backgroundColor: "#EC4899" }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setPickerOpen(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Feather name="gift" size={16} color="#FFF" />
                  <Text style={[panelStyles.actionText, { color: "#FFF" }]}>إهداء هدية</Text>
                </TouchableOpacity>
              )}

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

      {/* Gift picker + send animation (rendered alongside the panel modal) */}
      {!isMe && u && (
        <>
          <GiftPicker
            visible={pickerOpen}
            toName={u.name}
            onClose={() => setPickerOpen(false)}
            onSend={sendGift}
          />
          <GiftAnimation
            gift={animGift}
            count={animQty}
            visible={!!animGift}
            onDone={() => setAnimGift(null)}
          />
        </>
      )}
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
  entryRealName: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginBottom: 3,
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
    left: 8,
    top: "50%",
    marginTop: -18,
    width: 36, height: 36,
    alignItems: "center", justifyContent: "center",
  },
  // Small floating chip pinned to the top-LEFT corner of every leaderboard
  // row. Sits above the row content but never overlaps the avatar/character
  // (which lives on the right side).
  rankCornerBadge: {
    position: "absolute",
    top: -6,
    left: -6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    minWidth: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    zIndex: 5,
  },
  rankCornerText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textAlign: "center",
  },
  rankCornerChar: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCornerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    resizeMode: "cover",
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
  fullProfileBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#E8B86D",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, marginTop: 8,
  },
  fullProfileBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#000" },
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
