import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COPOINTO_LOGO = require("../assets/images/copointo-logo.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useCommunities } from "@/context/CommunityContext";
import { useT } from "@/context/LanguageContext";
import { getRank } from "@/data/mockData";
import { apiFetch } from "@/constants/api";

interface Broadcast { id: string; message: string; createdAt: string; }
interface FreeCoffeeNotif {
  id: string;
  code: string;
  earnedAtLevel: number;
  earnedAt: string;
  earnedAtCafeId?: string | null;
  earnedAtCafeName?: string | null;
  redeemedAt: string | null;
}
interface BookingNotif {
  id: string;
  cafeId: string;
  cafeName?: string;
  tableNumber: number;
  tableCapacity?: number;
  guests: number;
  date: string;
  time: string;
  hours?: number;
  totalPrice?: number;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  confirmedAt?: string;
}

const BROADCAST_LAST_SEEN_KEY    = "copointo_broadcast_last_seen_v1";
const FREE_COFFEE_LAST_SEEN_KEY  = "copointo_free_coffee_last_seen_v1";
const BOOKING_LAST_SEEN_KEY      = "copointo_booking_last_seen_v1";

const buildFmtRelative = (t: (k: string, v?: Record<string, string>) => string) => (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1)   return t("common.now");
  if (m < 60)  return t("common.minAgo", { n: String(m) });
  const h = Math.floor(m / 60);
  if (h < 24)  return t("common.hoursAgo", { n: String(h) });
  const d = Math.floor(h / 24);
  return t("common.daysAgo", { n: String(d) });
};

const BG     = "#000000";
const ACCENT = "#E8B86D";

// Local-only state for showing the green/red confirmation chip after the user
// taps accept/decline (so the row doesn't just vanish without feedback).
type Decision = "accepted" | "rejected";

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const {
    user,
    incomingRequests, registeredUsers,
    rejectionNotifications, ackRejection,
    acceptFriendRequest, declineFriendRequest, refreshFriendData,
  } = useApp();
  const {
    incomingInvites, acceptInvite, declineInvite,
    myActiveCommunity, refresh: refreshCommunities,
  } = useCommunities();
  const { t } = useT();
  const fmtRelative = buildFmtRelative(t);

  // Track recent decisions so the row stays visible briefly with status
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});

  // Copointo system broadcasts from super-admin
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  // Held free coffees (earned-but-still-redeemable) for this signed-in phone
  const [freeCoffees, setFreeCoffees] = useState<FreeCoffeeNotif[]>([]);

  // Recent table bookings for this phone — show pending + confirmed/cancelled
  // updates from the last week so the user gets the cafe's response.
  const [bookings, setBookings] = useState<BookingNotif[]>([]);

  const loadBroadcasts = useCallback(async () => {
    try {
      const uid = user?.id ? `?userId=${encodeURIComponent(user.id)}` : "";
      const r = await apiFetch<{ broadcasts: Broadcast[] }>(`/broadcasts${uid}`);
      setBroadcasts(r.broadcasts ?? []);
      // Mark as seen so the bell badge clears.
      const newest = r.broadcasts?.[0]?.createdAt;
      if (newest) await AsyncStorage.setItem(BROADCAST_LAST_SEEN_KEY, newest);
    } catch {
      /* ignore network errors — show whatever is cached */
    }
  }, []);

  const loadFreeCoffees = useCallback(async () => {
    const phone = user?.phone?.trim();
    if (!phone) { setFreeCoffees([]); return; }
    try {
      const r = await apiFetch<{ coffees: FreeCoffeeNotif[] }>(
        `/free-coffees?phone=${encodeURIComponent(phone)}`,
      );
      // Show only currently-redeemable ones (unredeemed) — newest first.
      const open = (r.coffees ?? [])
        .filter(c => !c.redeemedAt)
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
      setFreeCoffees(open);
      // Mark as seen so the bell badge clears.
      const newest = open[0]?.earnedAt;
      if (newest) await AsyncStorage.setItem(FREE_COFFEE_LAST_SEEN_KEY, newest);
    } catch {
      /* ignore */
    }
  }, [user?.phone]);

  const loadBookings = useCallback(async () => {
    const phone = user?.phone?.trim();
    if (!phone) { setBookings([]); return; }
    try {
      const r = await apiFetch<{ bookings: BookingNotif[] }>(
        `/bookings?phone=${encodeURIComponent(phone)}`,
      );
      // Keep bookings from the last 14 days — pending shown indefinitely,
      // confirmed/cancelled only while still recent.
      const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const recent = (r.bookings ?? [])
        .filter(b => {
          if (b.status === "pending") return true;
          const ts = new Date(b.confirmedAt ?? b.createdAt).getTime();
          return ts >= cutoff;
        })
        .sort((a, b) =>
          (b.confirmedAt ?? b.createdAt).localeCompare(a.confirmedAt ?? a.createdAt),
        );
      setBookings(recent);
      // Mark as seen so the bell badge clears.
      const newestTs = recent[0]?.confirmedAt ?? recent[0]?.createdAt;
      if (newestTs) await AsyncStorage.setItem(BOOKING_LAST_SEEN_KEY, newestTs);
    } catch {
      /* ignore */
    }
  }, [user?.phone]);

  useEffect(() => {
    loadBroadcasts();
    loadFreeCoffees();
    loadBookings();
  }, [loadBroadcasts, loadFreeCoffees, loadBookings]);

  // Whenever this screen comes into focus, re-pull friend/request data from
  // storage in case another logged-in user on the same device sent something,
  // and start polling bookings every 8 s so the customer sees confirmations
  // appear inline. The interval is cleared on blur — no background chatter.
  useFocusEffect(
    useCallback(() => {
      refreshFriendData();
      refreshCommunities();
      loadBroadcasts();
      loadFreeCoffees();
      loadBookings();
      if (!user?.phone) return;
      const handle = setInterval(loadBookings, 8000);
      return () => clearInterval(handle);
    }, [refreshFriendData, refreshCommunities, loadBroadcasts, loadFreeCoffees, loadBookings, user?.phone])
  );

  // Track community-invite decisions for the brief "accepted/declined" chip.
  const [inviteBusyId, setInviteBusyId] = useState<string | null>(null);
  const [inviteErr,    setInviteErr]    = useState("");

  const handleAcceptInvite = async (cid: string) => {
    setInviteErr("");
    setInviteBusyId(cid);
    const r = await acceptInvite(cid);
    setInviteBusyId(null);
    if (!r.ok) { setInviteErr(r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push(`/community-info?id=${cid}`);
  };

  const handleDeclineInvite = async (cid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await declineInvite(cid);
  };

  // Build display rows from the incoming-request IDs, hydrated from
  // registeredUsers. If a sender id no longer matches a known user (e.g. they
  // were removed) we just skip it.
  const rows = useMemo(() => {
    return incomingRequests
      .map(senderId => {
        const u = registeredUsers.find(r => r.id === senderId);
        if (!u) return null;
        return {
          id: senderId,
          name: u.name,
          username: u.gameUsername,
          level: u.level,
        };
      })
      .filter((r): r is { id: string; name: string; username: string; level: number } => r !== null);
  }, [incomingRequests, registeredUsers]);

  const handleAccept = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDecisions(prev => ({ ...prev, [id]: "accepted" }));
    await acceptFriendRequest(id);
  };

  const handleDecline = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDecisions(prev => ({ ...prev, [id]: "rejected" }));
    await declineFriendRequest(id);
  };

  // Recently-decided rows we want to keep showing for a short moment after
  // they're removed from incomingRequests by the context.
  const recentlyDecided = Object.entries(decisions).filter(
    ([id]) => !incomingRequests.includes(id)
  );

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
        <Text style={styles.headerTitle}>{t("notif.title")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {rows.length === 0 && recentlyDecided.length === 0 && broadcasts.length === 0 && freeCoffees.length === 0 && bookings.length === 0 && rejectionNotifications.length === 0 && incomingInvites.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>{t("notif.empty")}</Text>
            <Text style={styles.emptySub}>
              {t("notif.emptySub")}
            </Text>
          </View>
        )}

        {/* Community invitations — accept joins the clan immediately */}
        {!!inviteErr && <Text style={styles.inviteErr}>{inviteErr}</Text>}
        {incomingInvites.map(inv => {
          const blocked = !!myActiveCommunity;
          return (
            <View key={`ci-${inv.communityId}`} style={styles.inviteCard}>
              <View style={styles.inviteHeader}>
                {inv.communityAvatar ? (
                  <Image source={{ uri: inv.communityAvatar }} style={styles.inviteAvatarImg} />
                ) : (
                  <View style={styles.inviteAvatarPh}>
                    <Text style={{ fontSize: 22 }}>🏛️</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteTitle}>دعوة لمجتمع {inv.communityName}</Text>
                  <Text style={styles.inviteFrom}>
                    دعاك <Text style={styles.inviteFromName}>{inv.fromUserName}</Text>
                  </Text>
                  <Text style={styles.inviteHint}>{fmtRelative(new Date(inv.invitedAt).toISOString())}</Text>
                </View>
              </View>
              {blocked && (
                <Text style={styles.inviteBlocked}>
                  أنت بالفعل في مجتمع ({myActiveCommunity?.name}). غادر مجتمعك الحالي أولاً لقبول الدعوة.
                </Text>
              )}
              <View style={styles.friendActions}>
                <TouchableOpacity
                  style={[styles.acceptBtn, (inviteBusyId === inv.communityId || blocked) && { opacity: 0.5 }]}
                  onPress={() => handleAcceptInvite(inv.communityId)}
                  disabled={inviteBusyId === inv.communityId || blocked}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={15} color="#000" />
                  <Text style={styles.acceptBtnText}>{t("common.accept")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleDeclineInvite(inv.communityId)}
                  disabled={inviteBusyId === inv.communityId}
                  activeOpacity={0.85}
                >
                  <Feather name="x" size={15} color="#E8B86D" />
                  <Text style={styles.rejectBtnText}>{t("common.reject")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Table booking status — pending / confirmed / cancelled */}
        {bookings.map(b => {
          const isPending   = b.status === "pending";
          const isConfirmed = b.status === "confirmed";
          const accent      = isConfirmed ? "#7DD87D"
                            : isPending   ? ACCENT
                            : "#E55353";
          const icon        = isConfirmed ? "✅"
                            : isPending   ? "⏳"
                            : "❌";
          const title       = isConfirmed ? t("notif.bookingConfirmed")
                            : isPending   ? t("notif.bookingPending")
                            : t("notif.bookingCancelled");
          const ts = b.confirmedAt ?? b.createdAt;
          return (
            <View
              key={`bk-${b.id}`}
              style={[styles.bookingCard, { borderColor: accent }]}
            >
              <View style={styles.bookingHeader}>
                <View style={[styles.bookingBadge, { backgroundColor: accent + "22", borderColor: accent }]}>
                  <Text style={{ fontSize: 22 }}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bookingTitle, { color: accent }]}>{title}</Text>
                  <Text style={styles.bookingTime}>
                    {fmtRelative(ts)}{b.cafeName ? `  •  ${b.cafeName}` : ""}
                  </Text>
                </View>
              </View>
              <View style={styles.bookingDetailsBox}>
                <Text style={styles.bookingDetail}>
                  {b.tableCapacity
                    ? t("notif.bookingTableCap", { n: String(b.tableNumber), cap: String(b.tableCapacity) })
                    : t("notif.bookingTable", { n: String(b.tableNumber) })}
                </Text>
                <Text style={styles.bookingDetail}>
                  {b.hours
                    ? t("notif.bookingDateTimeHrs", { date: b.date, time: b.time, hours: String(b.hours) })
                    : t("notif.bookingDateTime", { date: b.date, time: b.time })}
                </Text>
                <Text style={styles.bookingDetail}>
                  {b.guests === 1
                    ? t("notif.bookingGuestsOne", { n: String(b.guests) })
                    : t("notif.bookingGuestsMany", { n: String(b.guests) })}
                </Text>
                {typeof b.totalPrice === "number" && (
                  <Text style={[styles.bookingDetail, { color: accent, fontFamily: "Inter_700Bold" }]}>
                    {t("notif.bookingPrice", { price: Number(b.totalPrice).toFixed(3) })}
                  </Text>
                )}
              </View>
              {isPending && (
                <Text style={styles.bookingHint}>
                  {t("notif.bookingPendingHint")}
                </Text>
              )}
              {isConfirmed && (
                <Text style={styles.bookingHint}>
                  {t("notif.bookingConfirmedHint")}
                </Text>
              )}
            </View>
          );
        })}

        {/* Free coffees the user has earned but not yet redeemed */}
        {freeCoffees.map(c => (
          <View key={`fc-${c.id}`} style={styles.freeCoffeeCard}>
            <View style={styles.freeCoffeeHeader}>
              <View style={styles.freeCoffeeBadge}>
                <Text style={styles.freeCoffeeBadgeIcon}>🎁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.freeCoffeeTitle}>{t("notif.freeCoffeeTitle")}</Text>
                <Text style={styles.freeCoffeeTime}>
                  {t("notif.freeCoffeeMeta", { rel: fmtRelative(c.earnedAt), level: String(c.earnedAtLevel) })}
                </Text>
              </View>
            </View>
            <Text style={styles.freeCoffeeBody}>
              {c.earnedAtCafeName
                ? t("notif.freeCoffeeAt", { cafe: c.earnedAtCafeName })
                : t("notif.freeCoffeeAtFallback")}
            </Text>
            <View style={styles.freeCoffeeRulesBox}>
              <Text style={styles.freeCoffeeRule}>
                {c.earnedAtCafeName
                  ? t("notif.freeCoffeeRule1", { cafe: c.earnedAtCafeName })
                  : t("notif.freeCoffeeRule1Fallback")}
              </Text>
              <Text style={styles.freeCoffeeRule}>{t("notif.freeCoffeeRule2")}</Text>
              <Text style={styles.freeCoffeeRule}>{t("notif.freeCoffeeRule3")}</Text>
              <Text style={styles.freeCoffeeRule}>{t("notif.freeCoffeeRule4")}</Text>
            </View>
            <View style={styles.freeCoffeeCodeBox}>
              <Text style={styles.freeCoffeeCodeLabel}>{t("notif.freeCoffeeCodeLabel")}</Text>
              <Text style={styles.freeCoffeeCode}>{c.code}</Text>
            </View>
          </View>
        ))}

        {/* Copointo system broadcasts */}
        {broadcasts.map(b => (
          <View key={`bc-${b.id}`} style={styles.broadcastCard}>
            <View style={styles.broadcastHeader}>
              <View style={styles.broadcastBadge}>
                <Image source={COPOINTO_LOGO} style={styles.broadcastBadgeLogo} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.broadcastTitleRow}>
                  <Text style={styles.broadcastSender}>{t("notif.officialSender")}</Text>
                  <View style={styles.officialDot} />
                  <Text style={styles.broadcastOfficial}>{t("notif.officialBadge")}</Text>
                </View>
                <Text style={styles.broadcastTime}>{fmtRelative(b.createdAt)}</Text>
              </View>
            </View>
            <Text style={styles.broadcastBody}>{b.message}</Text>
          </View>
        ))}

        {/* "Your friend request was declined" receipts (sender side) */}
        {rejectionNotifications.map((rej) => {
          const u = registeredUsers.find(r => r.id === rej.toUserId);
          const name = u?.name ?? t("common.friend");
          return (
            <View
              key={`rej-${rej.id}`}
              style={[styles.card, { borderColor: "rgba(229,83,83,0.45)" }]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { borderColor: "rgba(229,83,83,0.45)", backgroundColor: "rgba(229,83,83,0.10)" }]}>
                  <Text style={{ fontSize: 22 }}>✕</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{t("notif.requestRejected", { name })}</Text>
                  {u?.gameUsername && (
                    <Text style={styles.cardSub}>@{u.gameUsername}</Text>
                  )}
                  {rej.decidedAt && (
                    <Text style={styles.cardHint}>{fmtRelative(rej.decidedAt)}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  ackRejection(rej.id);
                }}
                activeOpacity={0.85}
              >
                <Feather name="x" size={15} color="#E8B86D" />
                <Text style={styles.rejectBtnText}>{t("common.hide")}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Pending friend requests */}
        {rows.map((r) => {
          const rankInfo = getRank(r.level);
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{r.name}</Text>
                  <Text style={styles.cardSub}>
                    {t("notif.userMeta", { user: r.username, level: String(r.level), icon: rankInfo.icon })}
                  </Text>
                  <Text style={styles.cardHint}>{t("notif.requestSent")}</Text>
                </View>
              </View>

              <View style={styles.friendActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(r.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="check" size={15} color="#000" />
                  <Text style={styles.acceptBtnText}>{t("common.accept")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => handleDecline(r.id)}
                  activeOpacity={0.85}
                >
                  <Feather name="x" size={15} color="#E8B86D" />
                  <Text style={styles.rejectBtnText}>{t("common.reject")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Recently decided — stay visible briefly with status chip */}
        {recentlyDecided.map(([id, decision]) => {
          const u = registeredUsers.find(r => r.id === id);
          if (!u) return null;
          return (
            <View key={`done-${id}`} style={[styles.card, { opacity: 0.7 }]}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 22 }}>👤</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{u.name}</Text>
                  <Text style={styles.cardSub}>@{u.gameUsername}</Text>
                </View>
              </View>
              <View style={[
                styles.statusTag,
                { backgroundColor: decision === "accepted" ? "rgba(125,216,125,0.18)" : "rgba(229,83,83,0.18)" },
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: decision === "accepted" ? "#7DD87D" : "#E55353" },
                ]}>
                  {decision === "accepted" ? t("notif.becameFriends") : t("notif.requestRejectedShort")}
                </Text>
              </View>
            </View>
          );
        })}

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
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
    backgroundColor: "#0A0606",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 14 },
  card: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.25)",
    gap: 14,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
    alignItems: "center", justifyContent: "center",
  },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFF",
  },
  cardSub: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  cardHint: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: ACCENT, marginTop: 4,
  },
  friendActions: { flexDirection: "row", gap: 10 },
  acceptBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 11, borderRadius: 12,
  },
  acceptBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#000",
  },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: "rgba(229,83,83,0.10)",
    borderWidth: 1, borderColor: "rgba(229,83,83,0.50)",
    paddingVertical: 11, borderRadius: 12,
  },
  rejectBtnText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#E55353",
  },
  statusTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13, fontFamily: "Inter_600SemiBold",
  },
  // Community invitation card
  inviteCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: ACCENT,
    gap: 12,
  },
  inviteHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  inviteAvatarImg: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: ACCENT,
  },
  inviteAvatarPh: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(232,184,109,0.12)",
    borderWidth: 1.5, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  inviteTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF",
  },
  inviteFrom: {
    fontSize: 12, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)", marginTop: 2,
  },
  inviteFromName: { color: ACCENT, fontFamily: "Inter_700Bold" },
  inviteHint: {
    fontSize: 11, fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.45)", marginTop: 4,
  },
  inviteBlocked: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "#FFD3D3", lineHeight: 18,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1, borderColor: "rgba(255,107,107,0.35)",
    borderRadius: 10, padding: 10,
  },
  inviteErr: {
    color: "#E55353", textAlign: "center",
    fontSize: 13, fontFamily: "Inter_500Medium",
  },

  // Broadcast (system message from Copointo)
  broadcastCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: ACCENT,
    gap: 12,
  },
  broadcastHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  broadcastBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#0A0606",
    borderWidth: 1.5, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  broadcastBadgeIcon: { fontSize: 22 },
  broadcastBadgeLogo: { width: 36, height: 36, resizeMode: "contain" },
  broadcastTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  broadcastSender: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF" },
  officialDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ACCENT },
  broadcastOfficial: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: ACCENT },
  broadcastTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", marginTop: 2 },
  broadcastBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#FFF", lineHeight: 22 },

  // Free-coffee earned notification
  freeCoffeeCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: ACCENT,
    gap: 12,
  },
  freeCoffeeHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  freeCoffeeBadge: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(232,184,109,0.18)",
    borderWidth: 1, borderColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  freeCoffeeBadgeIcon: { fontSize: 24 },
  freeCoffeeTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: ACCENT },
  freeCoffeeTime:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  freeCoffeeBody:  { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFF", lineHeight: 20 },
  freeCoffeeRulesBox: {
    backgroundColor: "rgba(232,184,109,0.06)",
    borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.20)",
    paddingVertical: 10, paddingHorizontal: 12,
    gap: 4,
  },
  freeCoffeeRule:  { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.78)", lineHeight: 18 },
  freeCoffeeCodeBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  freeCoffeeCodeLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#000" },
  freeCoffeeCode: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000", letterSpacing: 2 },

  // Table booking notification
  bookingCard: {
    backgroundColor: "#0A0606",
    borderRadius: 18, padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  bookingHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  bookingBadge: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  bookingTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  bookingTime:  { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  bookingDetailsBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    gap: 5,
  },
  bookingDetail: { fontSize: 12.5, fontFamily: "Inter_500Medium", color: "#FFF", lineHeight: 18 },
  bookingHint:   { fontSize: 11, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.65)", textAlign: "center" },

  emptyWrap: { alignItems: "center", paddingTop: 100, gap: 10 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#FFF" },
  emptySub: {
    fontSize: 13, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.50)",
    textAlign: "center", paddingHorizontal: 32,
  },
});
