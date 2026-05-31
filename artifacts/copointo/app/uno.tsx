import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import {
  unoApi,
  type UnoIdentity,
  type UnoInviteSummary,
  type UnoMode,
} from "@/constants/uno";

const BG = "#07060A";
const PRIMARY = "#E8B86D";
const LOGO = require("../assets/images/copointo-logo.png");

function useIdentity(): UnoIdentity | null {
  const { user } = useApp();
  if (!user) return null;
  return { userId: user.id, name: user.gameUsername || user.name, avatar: user.avatar };
}

export default function UnoLobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = useIdentity();

  const [mode, setMode] = useState<UnoMode>("1v1");
  const [busy, setBusy] = useState<null | "create" | "quick">(null);
  const [invites, setInvites] = useState<UnoInviteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    if (!id) return;
    try {
      const r = await unoApi.invites(id.userId);
      setInvites(r.invites);
    } catch {
      /* silent — invites are best-effort */
    }
  }, [id]);

  useEffect(() => {
    loadInvites();
    const t = setInterval(loadInvites, 4000);
    return () => clearInterval(t);
  }, [loadInvites]);

  const goRoom = (sessionId: string) => {
    router.push({ pathname: "/uno-room", params: { sessionId } } as any);
  };

  const haptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* ignore */
    }
  };

  const onQuick = async () => {
    if (!id || busy) return;
    haptic();
    setBusy("quick");
    setError(null);
    try {
      const r = await unoApi.quickmatch(id, mode);
      goRoom(r.id);
    } catch {
      setError("تعذّر إيجاد مباراة، حاول مجددًا");
    } finally {
      setBusy(null);
    }
  };

  const onCreate = async () => {
    if (!id || busy) return;
    haptic();
    setBusy("create");
    setError(null);
    try {
      const r = await unoApi.create(id, mode, false);
      goRoom(r.id);
    } catch {
      setError("تعذّر إنشاء الغرفة، حاول مجددًا");
    } finally {
      setBusy(null);
    }
  };

  const acceptInvite = async (sessionId: string) => {
    if (!id) return;
    haptic();
    try {
      await unoApi.join(sessionId, id);
      goRoom(sessionId);
    } catch {
      setError("تعذّر الانضمام، ربما امتلأت الغرفة");
      loadInvites();
    }
  };

  const declineInvite = async (sessionId: string) => {
    if (!id) return;
    setInvites((prev) => prev.filter((iv) => iv.sessionId !== sessionId));
    try {
      await unoApi.decline(sessionId, id);
    } catch {
      /* ignore */
    }
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.glowTop} />

      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </Pressable>
        <Text style={styles.headerTitle}>أونو كوبوينتو</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 78,
          paddingBottom: insets.bottom + 30,
          paddingHorizontal: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Image source={LOGO} style={styles.heroLogo} />
        <Text style={styles.title}>أونو أونلاين</Text>
        <Text style={styles.sub}>العب مع أصدقائك أو لاعبين عشوائيين واربح ٢٥ كوينز عند الفوز</Text>

        {/* Mode selector */}
        <Text style={styles.section}>نوع المباراة</Text>
        <View style={styles.modeRow}>
          {(["1v1", "2v2"] as UnoMode[]).map((m) => {
            const active = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  haptic();
                  setMode(m);
                }}
                style={[styles.modeCard, active && styles.modeCardActive]}
              >
                <Text style={[styles.modeTitle, active && styles.modeTitleActive]}>
                  {m === "1v1" ? "فردي" : "زوجي"}
                </Text>
                <Text style={[styles.modeSub, active && styles.modeSubActive]}>
                  {m === "1v1" ? "١ ضد ١" : "٢ ضد ٢ (فرق)"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Primary actions */}
        <Pressable onPress={onQuick} disabled={!!busy} style={{ marginTop: 18 }}>
          <LinearGradient
            colors={["#F2C988", "#E8B86D", "#C9974F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryBtn}
          >
            {busy === "quick" ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Feather name="zap" size={18} color="#000" />
                <Text style={styles.primaryTxt}>مباراة سريعة</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={onCreate} disabled={!!busy} style={styles.secondaryBtn}>
          {busy === "create" ? (
            <ActivityIndicator color={PRIMARY} />
          ) : (
            <>
              <Feather name="users" size={18} color={PRIMARY} />
              <Text style={styles.secondaryTxt}>إنشاء غرفة ودعوة الأصدقاء</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.hint}>
          ستبدأ المباراة خلال ٦٠ ثانية. تُملأ المقاعد الفارغة بلاعبين آليين تلقائيًا.
        </Text>

        {/* Incoming invites */}
        {invites.length > 0 && (
          <>
            <Text style={styles.section}>دعوات واردة</Text>
            {invites.map((iv) => (
              <View key={iv.sessionId} style={styles.inviteCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteName}>{iv.fromName}</Text>
                  <Text style={styles.inviteMeta}>
                    {iv.mode === "1v1" ? "فردي" : "زوجي"} · {iv.players}/{iv.capacity} لاعبين ·{" "}
                    {Math.ceil(iv.countdownMs / 1000)}ث
                  </Text>
                </View>
                <Pressable style={styles.acceptBtn} onPress={() => acceptInvite(iv.sessionId)}>
                  <Text style={styles.acceptTxt}>انضمام</Text>
                </Pressable>
                <Pressable style={styles.declineBtn} onPress={() => declineInvite(iv.sessionId)}>
                  <Feather name="x" size={16} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
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
  heroLogo: { width: 64, height: 64, resizeMode: "contain", alignSelf: "center" },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textAlign: "center",
    marginTop: 10,
    textShadowColor: "rgba(232,184,109,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  section: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textAlign: "right",
    marginTop: 26,
    marginBottom: 12,
  },
  modeRow: { flexDirection: "row", gap: 12 },
  modeCard: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.2)",
  },
  modeCardActive: {
    borderColor: PRIMARY,
    backgroundColor: "rgba(232,184,109,0.12)",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  modeTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.85)" },
  modeTitleActive: { color: PRIMARY },
  modeSub: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)", marginTop: 4 },
  modeSubActive: { color: "rgba(232,184,109,0.8)" },
  error: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#E0584C",
    textAlign: "center",
    marginTop: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 18,
  },
  primaryTxt: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#000" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
    marginTop: 12,
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.4)",
  },
  secondaryTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: PRIMARY },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 14,
    lineHeight: 18,
  },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "#100B07",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.25)",
  },
  inviteName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FFF", textAlign: "right" },
  inviteMeta: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)",
    textAlign: "right",
    marginTop: 3,
  },
  acceptBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: PRIMARY,
  },
  acceptTxt: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#000" },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
});
