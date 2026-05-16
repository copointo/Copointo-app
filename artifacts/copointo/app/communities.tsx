import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useCommunities } from "@/context/CommunityContext";
import { COMMUNITY_ROLE_LABEL_AR, COMMUNITY_ROLE_LABEL_EN, getCommunityRole } from "@/data/mockData";
import UserBadge from "@/components/UserBadge";
import AvatarWithFrame from "@/components/AvatarWithFrame";
import Character from "@/components/Character";
import { getCharacter } from "@/data/characters";

const BG     = "#000000";
const CARD   = "#0A0606";
const BORDER = "rgba(232,184,109,0.30)";
const ACCENT = "#E8B86D";

type Tab = "mine" | "ranking";

export default function CommunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { t, isAr } = useT();
  const ROLE_LABEL = isAr ? COMMUNITY_ROLE_LABEL_AR : COMMUNITY_ROLE_LABEL_EN;

  const { user, registeredUsers } = useApp();
  const {
    myCommunities,
    myActiveCommunity,
    rankingList,
    incomingInvites,
    getCommunityScore,
    leftCommunities,
    rejoinCommunity,
    refresh,
  } = useCommunities();
  const alreadyInOne = !!myActiveCommunity;

  const [tab, setTab] = useState<Tab>("mine");
  const [rejoiningId, setRejoiningId] = useState<string | null>(null);

  const onRejoin = async (id: string, name: string) => {
    if (alreadyInOne) {
      Alert.alert("غير ممكن", "أنت بالفعل في مجتمع. غادره أولاً.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRejoiningId(id);
    const res = await rejoinCommunity(id);
    setRejoiningId(null);
    if (res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم", `عُدت إلى ${name}`);
    } else {
      Alert.alert("تعذر الانضمام", res.error);
    }
  };

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("comm.headerTitle")}</Text>

        <TouchableOpacity
          style={styles.invitesBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/community-invites");
          }}
          activeOpacity={0.8}
        >
          <Feather name="mail" size={18} color="#FFF" />
          {incomingInvites.length > 0 && (
            <View style={styles.invitesBadge}>
              <Text style={styles.invitesBadgeText}>{incomingInvites.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "mine" && styles.tabOn]}
          onPress={() => { Haptics.selectionAsync(); setTab("mine"); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === "mine" && styles.tabTextOn]}>
            {t("comm.tabMine", { n: myCommunities.length })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "ranking" && styles.tabOn]}
          onPress={() => { Haptics.selectionAsync(); setTab("ranking"); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === "ranking" && styles.tabTextOn]}>
            {t("comm.tabRanking")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "mine" ? (
          <>
          {myCommunities.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 56 }}>🏛️</Text>
              <Text style={styles.emptyTitle}>{t("comm.emptyTitle")}</Text>
              <Text style={styles.emptySub}>
                {t("comm.emptySubLong")}
              </Text>
              <TouchableOpacity
                style={[styles.emptyCta, alreadyInOne && { opacity: 0.5 }]}
                onPress={() => { if (!alreadyInOne) router.push("/create-community"); }}
                activeOpacity={0.85}
                disabled={alreadyInOne}
              >
                <Feather name="plus" size={14} color="#000" />
                <Text style={styles.emptyCtaText}>{t("comm.createAction")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myCommunities
              .slice()
              .sort((a, b) => getCommunityScore(b.id) - getCommunityScore(a.id))
              .map(c => {
                const score = getCommunityScore(c.id);
                const myRole = user ? getCommunityRole(c, user.id) : null;
                const roleColor =
                  myRole === "leader" ? "#FFD700" :
                  myRole === "vice"   ? "#E8B86D" :
                  myRole === "senior" ? "#7FB7E8" :
                  "rgba(255,255,255,0.55)";
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.row}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/community-info?id=${c.id}`);
                    }}
                    activeOpacity={0.85}
                  >
                    {c.avatar ? (
                      <Image source={{ uri: c.avatar }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarPh}>
                        <Text style={{ fontSize: 24 }}>🏛️</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowNameRow}>
                        <Text style={styles.commName} numberOfLines={1}>{c.name}</Text>
                        {myRole && (
                          <View style={[styles.creatorTag, { backgroundColor: roleColor + "22", borderColor: roleColor + "55", borderWidth: 1 }]}>
                            <Text style={[styles.creatorTagText, { color: roleColor }]}>
                              {ROLE_LABEL[myRole]}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.metaText}>
                        {t("comm.metaMembersDrinks", { members: c.members.length, score })}
                      </Text>
                    </View>
                    <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                );
              })
          )}

          {/* Recently-left communities → quick rejoin */}
          {leftCommunities.length > 0 && (
            <View style={styles.rejoinSection}>
              <Text style={styles.rejoinTitle}>مجتمعات غادرتها</Text>
              <Text style={styles.rejoinSub}>
                يمكنك العودة إليها بضغطة واحدة (إن لم يكن المجتمع ممتلئاً وأنت غير منضم لمجتمع آخر).
              </Text>
              {leftCommunities.map(c => {
                const busy = rejoiningId === c.id;
                return (
                  <View key={c.id} style={styles.rejoinRow}>
                    {c.avatar ? (
                      <Image source={{ uri: c.avatar }} style={styles.avatarImg} />
                    ) : (
                      <View style={styles.avatarPh}>
                        <Text style={{ fontSize: 24 }}>🏛️</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commName} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.metaText}>
                        {t("comm.rankMembers", { n: c.members.length })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.rejoinBtn, (alreadyInOne || busy) && { opacity: 0.5 }]}
                      onPress={() => onRejoin(c.id, c.name)}
                      activeOpacity={0.85}
                      disabled={alreadyInOne || busy}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Feather name="log-in" size={14} color="#000" />
                          <Text style={styles.rejoinBtnText}>دخول</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          </>
        ) : (
          rankingList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 56 }}>🏆</Text>
              <Text style={styles.emptyTitle}>{t("comm.emptyRankingTitle")}</Text>
              <Text style={styles.emptySub}>
                {t("comm.emptyRankingSub")}
              </Text>
            </View>
          ) : (
            rankingList.map((r, i) => {
              const isMine = !!user && r.community.members.includes(user.id);
              const leader = registeredUsers.find(u => u.id === r.community.createdBy);
              const leaderCharDef = leader?.equippedCharacter ? getCharacter(leader.equippedCharacter) : null;
              return (
                <TouchableOpacity
                  key={r.community.id}
                  style={[styles.rankRow, isMine && styles.rankRowMine]}
                  onPress={() => {
                    if (!isMine) return;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/community-info?id=${r.community.id}`);
                  }}
                  activeOpacity={isMine ? 0.85 : 1}
                  disabled={!isMine}
                >
                  <View style={[styles.rankBadge, i < 3 && styles.rankBadgeTop]}>
                    <Text style={[styles.rankBadgeText, i < 3 && styles.rankBadgeTextTop]}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </Text>
                  </View>
                  <AvatarWithFrame size={42} scale={1.4} frameId={leader?.equippedFrame ?? null}>
                    {r.community.avatar ? (
                      <Image source={{ uri: r.community.avatar }} style={styles.avatarImgSm} />
                    ) : (
                      <View style={styles.avatarPhSm}>
                        <Text style={{ fontSize: 18 }}>🏛️</Text>
                      </View>
                    )}
                  </AvatarWithFrame>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={styles.commName} numberOfLines={1}>
                        {r.community.name}
                      </Text>
                      {leader?.equippedBadge && (
                        <UserBadge badgeId={leader.equippedBadge} size={22} />
                      )}
                      {leaderCharDef && (
                        <Character def={leaderCharDef} size={22} />
                      )}
                    </View>
                    <Text style={styles.metaText}>
                      {t("comm.rankMembers", { n: r.community.members.length })}
                      {leader ? `  •  👑 ${leader.name}` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.scoreText}>{t("comm.rankScore", { n: r.score })}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      {/* FAB - create (hidden when user is already in a community) */}
      {!alreadyInOne && (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/create-community");
          }}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={20} color="#000" />
          <Text style={styles.fabText}>{t("comm.createAction")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF" },
  invitesBtn: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  invitesBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: "#FF6B6B",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: BG,
  },
  invitesBadgeText: {
    fontSize: 10, fontFamily: "Inter_700Bold", color: "#FFF",
  },

  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16, gap: 8,
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  tabOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextOn: { color: "#000", fontFamily: "Inter_700Bold" },

  emptyWrap: {
    alignItems: "center", paddingTop: 60, gap: 10,
    paddingHorizontal: 30,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
  },
  emptyCta: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: 12, marginTop: 8,
  },
  emptyCtaText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  avatarImg: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1.5, borderColor: ACCENT,
  },
  avatarPh: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: ACCENT + "22",
    borderWidth: 1.5, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  avatarImgSm: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: BORDER,
  },
  avatarPhSm: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ACCENT + "22",
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  rowNameRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  commName: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF",
    textAlign: "right", flexShrink: 1,
  },
  metaText: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.50)",
    marginTop: 3, textAlign: "right",
  },
  creatorTag: {
    backgroundColor: ACCENT + "33",
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  creatorTagText: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: ACCENT,
  },

  rankRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rankRowMine: { borderColor: ACCENT },
  rankBadge: {
    width: 36, alignItems: "center",
  },
  rankBadgeTop: {},
  rankBadgeText: {
    fontSize: 13, fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.55)",
  },
  rankBadgeTextTop: { fontSize: 22 },
  scoreText: {
    fontSize: 15, fontFamily: "Inter_700Bold", color: ACCENT,
  },

  rejoinSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  rejoinTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold",
    color: "#FFF", textAlign: "right",
  },
  rejoinSub: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "right", marginTop: 4, marginBottom: 10,
  },
  rejoinRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: CARD,
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  rejoinBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: ACCENT,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, minWidth: 72, justifyContent: "center",
  },
  rejoinBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#000" },

  fab: {
    position: "absolute", left: 20, right: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14, borderRadius: 16,
    shadowColor: ACCENT, shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12,
    elevation: 6,
  },
  fabText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#000" },
});
