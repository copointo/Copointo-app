import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useCoins } from "@/hooks/useCoins";
import {
  cardFill,
  cardLabel,
  isWild,
  unoApi,
  UNO_COLORS,
  type UnoCard,
  type UnoColor,
  type UnoIdentity,
  type UnoView,
} from "@/constants/uno";

const BG = "#07060A";
const PRIMARY = "#E8B86D";
const REWARD = 25;
const POLL_MS = 1200;

function rewardKey(sessionId: string) {
  return `copointo_uno_reward_${sessionId}`;
}

function UnoCardFace({
  card,
  size = "md",
  active,
}: {
  card: UnoCard;
  size?: "sm" | "md" | "lg";
  active?: UnoColor | null;
}) {
  const dims = size === "lg" ? CARD.lg : size === "sm" ? CARD.sm : CARD.md;
  const fill = cardFill(card, active);
  const dark = card.color === "yellow";
  const fg = dark ? "#1A1320" : "#FFF";
  return (
    <View style={[styles.card, dims, { backgroundColor: fill }]}>
      <View style={styles.cardOval} />
      <Text style={[styles.cardLabel, { color: fg, fontSize: dims.font }]}>{cardLabel(card)}</Text>
      {isWild(card) && !active ? <Text style={styles.cardWildHint}>WILD</Text> : null}
    </View>
  );
}

export default function UnoRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useApp();
  const { addCoins } = useCoins();

  const userId = user?.id ?? null;
  const id: UnoIdentity | null = user
    ? { userId: user.id, name: user.gameUsername || user.name, avatar: user.avatar }
    : null;

  const [view, setView] = useState<UnoView | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wildCard, setWildCard] = useState<UnoCard | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [rewarded, setRewarded] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const haptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      /* ignore */
    }
  };

  // ── Single poll loop ───────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!userId || !sessionId) return;
    try {
      const r = await unoApi.state(sessionId, userId);
      if (mounted.current) {
        setView(r.view);
        setLoadErr(false);
      }
    } catch {
      if (mounted.current) setLoadErr(true);
    } finally {
      if (mounted.current) {
        pollRef.current = setTimeout(poll, POLL_MS);
      }
    }
  }, [userId, sessionId]);

  useEffect(() => {
    mounted.current = true;
    poll();
    return () => {
      mounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [poll]);

  // ── Award 25 coins exactly once on a win ───────────────────────────────────
  useEffect(() => {
    if (!view || view.status !== "finished" || !view.youWon || !sessionId || rewarded) return;
    (async () => {
      const key = rewardKey(sessionId);
      const already = await AsyncStorage.getItem(key);
      if (already) {
        setRewarded(true);
        return;
      }
      await AsyncStorage.setItem(key, "1");
      await addCoins(REWARD);
      setRewarded(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        /* ignore */
      }
    })();
  }, [view, sessionId, rewarded, addCoins]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const refreshNow = (next: UnoView) => setView(next);

  const onPlay = async (card: UnoCard) => {
    if (!id || !view || busy) return;
    if (!view.playableCardIds.includes(card.id)) return;
    if (isWild(card)) {
      setWildCard(card);
      return;
    }
    haptic();
    setBusy(true);
    try {
      const r = await unoApi.play(sessionId!, id, card.id);
      refreshNow(r.view);
    } catch {
      /* state will resync on next poll */
    } finally {
      setBusy(false);
    }
  };

  const onPickColor = async (color: UnoColor) => {
    if (!id || !wildCard) return;
    const card = wildCard;
    setWildCard(null);
    setBusy(true);
    try {
      const r = await unoApi.play(sessionId!, id, card.id, color);
      refreshNow(r.view);
    } catch {
      /* resync */
    } finally {
      setBusy(false);
    }
  };

  const onDraw = async () => {
    if (!id || !view || busy || !view.isYourTurn) return;
    haptic();
    setBusy(true);
    try {
      const r = await unoApi.draw(sessionId!, id);
      refreshNow(r.view);
    } catch {
      /* resync */
    } finally {
      setBusy(false);
    }
  };

  const onPass = async () => {
    if (!id || !view || busy) return;
    setBusy(true);
    try {
      const r = await unoApi.pass(sessionId!, id);
      refreshNow(r.view);
    } catch {
      /* resync */
    } finally {
      setBusy(false);
    }
  };

  const onSayUno = async () => {
    if (!id) return;
    haptic();
    try {
      const r = await unoApi.sayUno(sessionId!, id);
      refreshNow(r.view);
    } catch {
      /* ignore */
    }
  };

  const leave = async () => {
    if (id && sessionId) {
      try {
        await unoApi.leave(sessionId, id);
      } catch {
        /* ignore */
      }
    }
    router.back();
  };

  const openInvite = async () => {
    setShowInvite(true);
    if (!id) return;
    try {
      const r = await unoApi.friends(id.userId);
      setFriends(r.friends.map((f) => ({ id: f.id, name: f.name })));
    } catch {
      setFriends([]);
    }
  };

  const sendInvite = async (friendId: string) => {
    if (!id || !sessionId) return;
    setInvited((prev) => new Set(prev).add(friendId));
    try {
      await unoApi.invite(sessionId, id, friendId);
    } catch {
      /* ignore */
    }
  };

  // ── Render states ──────────────────────────────────────────────────────────
  if (!view) {
    return (
      <View style={[styles.root, styles.center]}>
        {loadErr ? (
          <>
            <Text style={styles.errBig}>تعذّر تحميل المباراة</Text>
            <Pressable style={styles.ghostBtn} onPress={() => router.back()}>
              <Text style={styles.ghostTxt}>رجوع</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={PRIMARY} size="large" />
        )}
      </View>
    );
  }

  const others = view.players.filter((p) => !p.isYou);

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowTop} />

      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={leave} hitSlop={12}>
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {view.mode === "1v1" ? "أونو · فردي" : "أونو · زوجي"}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      {/* ── Waiting room ─────────────────────────────────────────────── */}
      {view.status === "waiting" && (
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 90, paddingHorizontal: 20, paddingBottom: 40 }}
        >
          <Text style={styles.countdown}>{Math.ceil(view.countdownMs / 1000)}</Text>
          <Text style={styles.waitSub}>تبدأ المباراة تلقائيًا… المقاعد الفارغة ستُملأ بلاعبين آليين</Text>

          <View style={styles.seatList}>
            {Array.from({ length: view.capacity }).map((_, i) => {
              const p = view.players[i];
              return (
                <View key={i} style={styles.seatRow}>
                  <View style={styles.seatAvatar}>
                    <Text style={styles.seatAvatarTxt}>{p ? p.name.slice(0, 1) : "?"}</Text>
                  </View>
                  <Text style={styles.seatName}>
                    {p ? p.name : "بانتظار لاعب…"}
                    {p?.isYou ? " (أنت)" : ""}
                  </Text>
                  {p ? <Feather name="check-circle" size={18} color="#4CAF73" /> : null}
                </View>
              );
            })}
          </View>

          <Pressable style={styles.secondaryBtn} onPress={openInvite}>
            <Feather name="user-plus" size={18} color={PRIMARY} />
            <Text style={styles.secondaryTxt}>دعوة صديق</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── Game table ───────────────────────────────────────────────── */}
      {view.status === "playing" && (
        <View style={{ flex: 1, paddingTop: insets.top + 80 }}>
          {/* Opponents */}
          <View style={styles.oppRow}>
            {others.map((p) => (
              <View
                key={p.seat}
                style={[styles.oppCard, view.turnSeat === p.seat && styles.oppCardTurn]}
              >
                <View style={styles.seatAvatar}>
                  <Text style={styles.seatAvatarTxt}>{p.name.slice(0, 1)}</Text>
                </View>
                <Text style={styles.oppName} numberOfLines={1}>
                  {p.name}
                  {view.mode === "2v2" ? ` · ف${p.team + 1}` : ""}
                </Text>
                <View style={styles.handCountPill}>
                  <Feather name="layers" size={11} color={PRIMARY} />
                  <Text style={styles.handCountTxt}>{p.handCount}</Text>
                </View>
                {p.handCount === 1 ? <Text style={styles.unoTag}>UNO</Text> : null}
              </View>
            ))}
          </View>

          {/* Center: discard + draw */}
          <View style={styles.center}>
            <View style={styles.tableRow}>
              <Pressable onPress={onDraw} disabled={!view.isYourTurn || busy} style={styles.drawPile}>
                <View style={[styles.card, CARD.md, styles.drawBack]}>
                  <Text style={styles.drawBackTxt}>UNO</Text>
                </View>
                <Text style={styles.drawCount}>{view.drawCount}</Text>
              </Pressable>

              <View style={{ width: 26 }} />

              {view.topCard ? (
                <UnoCardFace card={view.topCard} size="lg" active={view.activeColor} />
              ) : (
                <View style={[styles.card, CARD.lg, { backgroundColor: "#1A1320" }]} />
              )}
            </View>

            {view.activeColor ? (
              <View style={styles.colorChip}>
                <View style={[styles.colorDot, { backgroundColor: UNO_COLORS[view.activeColor] }]} />
                <Text style={styles.colorChipTxt}>اللون المطلوب</Text>
              </View>
            ) : null}

            <Text style={styles.turnText}>
              {view.isYourTurn ? "دورك الآن" : `دور ${view.players[view.turnSeat]?.name ?? ""}`}
            </Text>
          </View>

          {/* Latest log line */}
          {view.log.length > 0 ? (
            <Text style={styles.logLine} numberOfLines={1}>
              {view.log[view.log.length - 1]}
            </Text>
          ) : null}

          {/* Your hand */}
          <View style={[styles.handArea, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.handTopRow}>
              <Text style={styles.handTitle}>أوراقك ({view.yourHand.length})</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {view.yourHand.length === 2 ? (
                  <Pressable style={styles.unoBtn} onPress={onSayUno}>
                    <Text style={styles.unoBtnTxt}>UNO!</Text>
                  </Pressable>
                ) : null}
                {view.canPass ? (
                  <Pressable style={styles.passBtn} onPress={onPass}>
                    <Text style={styles.passTxt}>تمرير</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.handScroll}>
              {view.yourHand.map((c) => {
                const playable = view.playableCardIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => onPlay(c)}
                    disabled={!playable || busy}
                    style={[styles.handCardWrap, playable ? styles.handCardOn : styles.handCardOff]}
                  >
                    <UnoCardFace card={c} size="md" />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ── Result ───────────────────────────────────────────────────── */}
      {view.status === "finished" && (
        <View style={[styles.center, { paddingHorizontal: 30 }]}>
          <Text style={styles.resultEmoji}>{view.youWon ? "🏆" : "🙂"}</Text>
          <Text style={styles.resultTitle}>{view.youWon ? "مبروك! لقد فزت" : "انتهت المباراة"}</Text>
          {view.youWon ? (
            <View style={styles.rewardPill}>
              <Feather name="award" size={18} color="#000" />
              <Text style={styles.rewardTxt}>+{REWARD} كوينز</Text>
            </View>
          ) : (
            <Text style={styles.resultSub}>
              {view.mode === "2v2" && view.winnerTeam != null
                ? `فاز الفريق ${view.winnerTeam + 1}`
                : "حظ أوفر في المرة القادمة"}
            </Text>
          )}
          <Pressable onPress={() => router.back()} style={{ marginTop: 26, width: "100%" }}>
            <LinearGradient
              colors={["#F2C988", "#E8B86D", "#C9974F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryTxt}>العودة للألعاب</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* ── Wild color picker ────────────────────────────────────────── */}
      <Modal transparent visible={!!wildCard} animationType="fade" onRequestClose={() => setWildCard(null)}>
        <Pressable style={styles.modalBg} onPress={() => setWildCard(null)}>
          <View style={styles.colorSheet}>
            <Text style={styles.colorSheetTitle}>اختر اللون</Text>
            <View style={styles.colorGrid}>
              {(Object.keys(UNO_COLORS) as UnoColor[]).map((c) => (
                <Pressable
                  key={c}
                  onPress={() => onPickColor(c)}
                  style={[styles.colorPick, { backgroundColor: UNO_COLORS[c] }]}
                />
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── Invite friends sheet ─────────────────────────────────────── */}
      <Modal transparent visible={showInvite} animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <Pressable style={styles.modalBg} onPress={() => setShowInvite(false)}>
          <Pressable style={styles.inviteSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.colorSheetTitle}>دعوة صديق</Text>
            {friends.length === 0 ? (
              <Text style={styles.emptyTxt}>لا يوجد أصدقاء لدعوتهم</Text>
            ) : (
              <ScrollView style={{ maxHeight: 320 }}>
                {friends.map((f) => {
                  const done = invited.has(f.id);
                  return (
                    <View key={f.id} style={styles.friendRow}>
                      <Text style={styles.friendName}>{f.name}</Text>
                      <Pressable
                        style={[styles.inviteBtn, done && styles.inviteBtnDone]}
                        onPress={() => !done && sendInvite(f.id)}
                        disabled={done}
                      >
                        <Text style={[styles.inviteBtnTxt, done && { color: "#4CAF73" }]}>
                          {done ? "تمت الدعوة" : "دعوة"}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            )}
            <Pressable style={styles.closeSheet} onPress={() => setShowInvite(false)}>
              <Text style={styles.ghostTxt}>إغلاق</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CARD = {
  sm: { width: 40, height: 58, borderRadius: 8, font: 18 },
  md: { width: 58, height: 84, borderRadius: 11, font: 26 },
  lg: { width: 78, height: 112, borderRadius: 14, font: 36 },
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  glowTop: {
    position: "absolute",
    top: -180,
    left: "50%",
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(232,184,109,0.07)",
  },
  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A0606",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.3)",
  },

  // Waiting
  countdown: {
    fontSize: 72,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
    textShadowColor: "rgba(232,184,109,0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  waitSub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
    lineHeight: 20,
  },
  seatList: { gap: 12 },
  seatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#100B07",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.22)",
  },
  seatAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(232,184,109,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.4)",
  },
  seatAvatarTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  seatName: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "right" },

  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 16,
    marginTop: 22,
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.4)",
  },
  secondaryTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Opponents
  oppRow: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 10, paddingHorizontal: 14 },
  oppCard: {
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.18)",
    minWidth: 92,
  },
  oppCardTurn: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  oppName: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#FFF", marginTop: 6, maxWidth: 96 },
  handCountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(232,184,109,0.12)",
  },
  handCountTxt: { fontSize: 12, fontFamily: "Inter_700Bold", color: PRIMARY },
  unoTag: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#E0584C", marginTop: 3 },

  // Table
  tableRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  drawPile: { alignItems: "center" },
  drawBack: {
    backgroundColor: "#1A1320",
    borderWidth: 2,
    borderColor: "rgba(232,184,109,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  drawBackTxt: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    transform: [{ rotate: "-20deg" }],
  },
  drawCount: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginTop: 6 },
  colorChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  colorDot: { width: 14, height: 14, borderRadius: 7 },
  colorChipTxt: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  turnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY, marginTop: 16 },
  logLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // Hand
  handArea: {
    backgroundColor: "rgba(16,11,7,0.9)",
    borderTopWidth: 1,
    borderTopColor: "rgba(232,184,109,0.25)",
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  handTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  handTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },
  handScroll: { gap: 8, paddingVertical: 6, paddingHorizontal: 2 },
  handCardWrap: { borderRadius: 12 },
  handCardOn: {
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
    transform: [{ translateY: -6 }],
  },
  handCardOff: { opacity: 0.55 },
  unoBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, backgroundColor: "#E0584C" },
  unoBtnTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#FFF" },
  passBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(232,184,109,0.16)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.5)",
  },
  passTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Card faces
  card: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  cardOval: {
    position: "absolute",
    width: "78%",
    height: "55%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
    transform: [{ rotate: "45deg" }],
  },
  cardLabel: { fontFamily: "Inter_700Bold" },
  cardWildHint: { position: "absolute", bottom: 5, fontSize: 8, fontFamily: "Inter_700Bold", color: "#FFF" },

  // Result
  resultEmoji: { fontSize: 64 },
  resultTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    marginTop: 12,
    textAlign: "center",
  },
  resultSub: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    marginTop: 8,
    textAlign: "center",
  },
  rewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: PRIMARY,
  },
  rewardTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
  },
  primaryTxt: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#000" },

  // Errors / shared
  errBig: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#E0584C", marginBottom: 16 },
  ghostBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.4)",
  },
  ghostTxt: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  // Modals
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  colorSheet: {
    width: "78%",
    padding: 22,
    borderRadius: 22,
    backgroundColor: "#120D0A",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.35)",
  },
  colorSheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
    marginBottom: 16,
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  colorPick: { width: 64, height: 64, borderRadius: 16 },
  inviteSheet: {
    width: "86%",
    padding: 20,
    borderRadius: 22,
    backgroundColor: "#120D0A",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.35)",
  },
  emptyTxt: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    paddingVertical: 16,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  friendName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFF" },
  inviteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: PRIMARY,
  },
  inviteBtnDone: { backgroundColor: "rgba(76,175,115,0.16)" },
  inviteBtnTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },
  closeSheet: { alignItems: "center", marginTop: 16, paddingVertical: 10 },
});
