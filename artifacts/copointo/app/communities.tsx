import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
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
import { useCommunities } from "@/context/CommunityContext";

const BG     = "#000000";
const CARD   = "#0A0606";
const BORDER = "rgba(232,184,109,0.30)";
const ACCENT = "#E8B86D";

type Tab = "mine" | "ranking";

export default function CommunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { user } = useApp();
  const {
    myCommunities,
    rankingList,
    incomingInvites,
    getCommunityScore,
    refresh,
  } = useCommunities();

  const [tab, setTab] = useState<Tab>("mine");

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
        <Text style={styles.headerTitle}>🏛️ المجتمعات</Text>

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
            مجتمعاتي ({myCommunities.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "ranking" && styles.tabOn]}
          onPress={() => { Haptics.selectionAsync(); setTab("ranking"); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, tab === "ranking" && styles.tabTextOn]}>
            الترتيب
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "mine" ? (
          myCommunities.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 56 }}>🏛️</Text>
              <Text style={styles.emptyTitle}>لا توجد مجتمعات</Text>
              <Text style={styles.emptySub}>
                ابدأ بإنشاء مجتمع وادعُ أصدقاءك لمنافسة المجتمعات الأخرى.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => router.push("/create-community")}
                activeOpacity={0.85}
              >
                <Feather name="plus" size={14} color="#000" />
                <Text style={styles.emptyCtaText}>إنشاء مجتمع</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myCommunities
              .slice()
              .sort((a, b) => getCommunityScore(b.id) - getCommunityScore(a.id))
              .map(c => {
                const score = getCommunityScore(c.id);
                const isOwn = c.createdBy === user?.id;
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
                        {isOwn && (
                          <View style={styles.creatorTag}>
                            <Text style={styles.creatorTagText}>المنشئ</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.metaText}>
                        👥 {c.members.length} · ☕ {score}
                      </Text>
                    </View>
                    <Feather name="chevron-left" size={18} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                );
              })
          )
        ) : (
          rankingList.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ fontSize: 56 }}>🏆</Text>
              <Text style={styles.emptyTitle}>لا يوجد ترتيب</Text>
              <Text style={styles.emptySub}>
                انضم إلى مجتمع أو أنشئ واحداً لرؤية الترتيب.
              </Text>
            </View>
          ) : (
            rankingList.map((r, i) => {
              const isMine = !!user && r.community.members.includes(user.id);
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
                  {r.community.avatar ? (
                    <Image source={{ uri: r.community.avatar }} style={styles.avatarImgSm} />
                  ) : (
                    <View style={styles.avatarPhSm}>
                      <Text style={{ fontSize: 18 }}>🏛️</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.commName} numberOfLines={1}>
                      {r.community.name}
                    </Text>
                    <Text style={styles.metaText}>
                      👥 {r.community.members.length} عضو
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.scoreText}>☕ {r.score}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      {/* FAB - create */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/create-community");
        }}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={20} color="#000" />
        <Text style={styles.fabText}>إنشاء مجتمع</Text>
      </TouchableOpacity>
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
