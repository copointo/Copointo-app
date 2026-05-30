import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCoins } from "@/hooks/useCoins";

const BG = "#07060A";
const PRIMARY = "#E8B86D";
const PRIMARY_DARK = "#B07F3F";

const BIRD_LOGO = require("../assets/images/copointo-logo.png");
const COIN_IMG = require("../assets/images/copointo-coin.png");

// ── Physics / layout tuning ──
const GRAVITY = 1500;       // px / s²
const FLAP_V = -440;        // px / s (negative = up)
const PIPE_W = 66;
const PIPE_GAP = 205;       // vertical opening between pipes
const PIPE_SPEED = 165;     // px / s
const PIPE_SPACING = 240;   // horizontal distance between pipes
const BIRD_SIZE = 40;
const DAILY_GAME_CAP = 100; // max coins earnable per day from this game

const HI_KEY = "copointo_flappy_hi_v1";
const DAY_KEY = "copointo_flappy_day_v1";
const EARNED_KEY = "copointo_flappy_earned_v1";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type Pipe = { id: number; x: number; gapY: number; scored: boolean };
type Status = "idle" | "playing" | "over";

export default function PlayWinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { balance, addCoins } = useCoins();

  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const [hi, setHi] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [ready, setReady] = useState(false);

  const S = useRef({
    W: 0,
    H: 0,
    birdX: 0,
    birdY: 0,
    birdV: 0,
    pipes: [] as Pipe[],
    pipeId: 1,
    score: 0,
    status: "idle" as Status,
    last: 0,
    raf: 0 as number,
    overAt: 0,
    earnedToday: 0,
    runReward: 0,
    hi: 0,
    hydrated: false,
    dayStr: todayStr(),
  }).current;

  // ── Load persisted high score + today's earned coins ──
  useEffect(() => {
    (async () => {
      try {
        const [h, d, e] = await Promise.all([
          AsyncStorage.getItem(HI_KEY),
          AsyncStorage.getItem(DAY_KEY),
          AsyncStorage.getItem(EARNED_KEY),
        ]);
        S.hi = h ? parseInt(h, 10) || 0 : 0;
        const today = todayStr();
        let earned = 0;
        if (d === today) {
          earned = e ? parseInt(e, 10) || 0 : 0;
        } else {
          await AsyncStorage.multiSet([[DAY_KEY, today], [EARNED_KEY, "0"]]);
        }
        S.earnedToday = earned;
        S.dayStr = today;
        setHi(S.hi);
        setEarnedToday(earned);
      } catch {
        /* ignore */
      } finally {
        S.hydrated = true;
      }
    })();
    return () => {
      if (S.raf) cancelAnimationFrame(S.raf);
    };
  }, []);

  // ── Stop the loop when the screen loses focus ──
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (S.raf) cancelAnimationFrame(S.raf);
        if (S.status === "playing") {
          S.status = "over";
          forceRender();
        }
      };
    }, []),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const first = S.W === 0;
    S.W = width;
    S.H = height;
    S.birdX = Math.round(width * 0.28);
    if (first) {
      S.birdY = height * 0.42;
      setReady(true);
    }
    forceRender();
  };

  const spawnPipe = () => {
    const margin = PIPE_GAP / 2 + 48;
    const gapY = margin + Math.random() * Math.max(1, S.H - margin * 2);
    S.pipes.push({ id: S.pipeId++, x: S.W, gapY, scored: false });
  };

  const persistDaily = () => {
    AsyncStorage.multiSet([
      [DAY_KEY, todayStr()],
      [EARNED_KEY, String(S.earnedToday)],
    ]).catch(() => {});
  };
  const persistHi = () => {
    AsyncStorage.setItem(HI_KEY, String(S.hi)).catch(() => {});
  };

  const endGame = () => {
    if (S.status !== "playing") return;
    S.status = "over";
    S.overAt = Date.now();
    // Coins were already granted per-pipe during the run; just settle the UI.
    if (S.score > S.hi) {
      S.hi = S.score;
      persistHi();
      setHi(S.hi);
    }
    setLastReward(S.runReward);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      /* ignore */
    }
  };

  const frame = (t: number) => {
    if (!S.last) S.last = t;
    let dt = (t - S.last) / 1000;
    S.last = t;
    if (dt > 0.045) dt = 0.045; // clamp big gaps (tab switches etc.)

    if (S.status === "playing") {
      S.birdV += GRAVITY * dt;
      S.birdY += S.birdV * dt;

      for (const p of S.pipes) p.x -= PIPE_SPEED * dt;

      const lastP = S.pipes[S.pipes.length - 1];
      if (!lastP || lastP.x < S.W - PIPE_SPACING) spawnPipe();
      S.pipes = S.pipes.filter((p) => p.x + PIPE_W > -20);

      for (const p of S.pipes) {
        if (!p.scored && p.x + PIPE_W < S.birdX) {
          p.scored = true;
          S.score += 1;
          // Reward 1 coin per pipe passed, immediately, while under the
          // daily cap — so quitting mid-run never loses earned coins.
          if (S.earnedToday < DAILY_GAME_CAP) {
            S.earnedToday += 1;
            S.runReward += 1;
            addCoins(1);
            persistDaily();
            setEarnedToday(S.earnedToday);
          }
          try {
            Haptics.selectionAsync();
          } catch {
            /* ignore */
          }
        }
        const within = S.birdX + BIRD_SIZE > p.x && S.birdX < p.x + PIPE_W;
        if (within) {
          const gapTop = p.gapY - PIPE_GAP / 2;
          const gapBottom = p.gapY + PIPE_GAP / 2;
          if (S.birdY < gapTop || S.birdY + BIRD_SIZE > gapBottom) {
            endGame();
          }
        }
      }

      if (S.birdY < 0) {
        S.birdY = 0;
        S.birdV = 0;
      }
      if (S.birdY + BIRD_SIZE >= S.H) {
        S.birdY = S.H - BIRD_SIZE;
        endGame();
      }
    }

    forceRender();
    if (S.status === "playing") S.raf = requestAnimationFrame(frame);
  };

  const startGame = () => {
    if (S.W === 0 || !S.hydrated) return;
    // Reset the daily counter if the date rolled over while mounted.
    const today = todayStr();
    if (today !== S.dayStr) {
      S.dayStr = today;
      S.earnedToday = 0;
      persistDaily();
      setEarnedToday(0);
    }
    S.birdY = S.H * 0.42;
    S.birdV = 0;
    S.pipes = [];
    S.score = 0;
    S.runReward = 0;
    S.status = "playing";
    S.last = 0;
    setLastReward(0);
    if (S.raf) cancelAnimationFrame(S.raf);
    S.raf = requestAnimationFrame(frame);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      /* ignore */
    }
  };

  const onTap = () => {
    if (S.W === 0) return;
    if (S.status === "idle") {
      startGame();
      return;
    }
    if (S.status === "playing") {
      S.birdV = FLAP_V;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
  };

  const status = S.status;
  const birdAngle = Math.max(-22, Math.min(70, S.birdV * 0.06));

  return (
    <View style={styles.root} onLayout={onLayout}>
      {/* Tap surface (idle taps pass through to start/flap) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        {/* Pipes */}
        {S.pipes.map((p) => {
          const gapTop = p.gapY - PIPE_GAP / 2;
          const gapBottom = p.gapY + PIPE_GAP / 2;
          return (
            <View key={p.id} pointerEvents="none">
              <View
                style={[
                  styles.pipe,
                  { left: p.x, top: 0, height: Math.max(0, gapTop), width: PIPE_W },
                ]}
              >
                <View style={styles.pipeCapBottom} />
              </View>
              <View
                style={[
                  styles.pipe,
                  {
                    left: p.x,
                    top: gapBottom,
                    height: Math.max(0, S.H - gapBottom),
                    width: PIPE_W,
                  },
                ]}
              >
                <View style={styles.pipeCapTop} />
              </View>
            </View>
          );
        })}

        {/* Bird */}
        {ready && (
          <View
            pointerEvents="none"
            style={[
              styles.bird,
              {
                left: S.birdX,
                top: S.birdY,
                width: BIRD_SIZE,
                height: BIRD_SIZE,
                transform: [{ rotate: `${birdAngle}deg` }],
              },
            ]}
          >
            <Image source={BIRD_LOGO} style={styles.birdImg} />
          </View>
        )}

        {/* Live score */}
        {status === "playing" && (
          <Text style={[styles.scoreBig, { top: insets.top + 64 }]}>{S.score}</Text>
        )}
      </Pressable>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 8 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </Pressable>
        <View style={styles.coinPill}>
          <Image source={COIN_IMG} style={styles.coinImg} />
          <Text style={styles.coinTxt}>{balance}</Text>
        </View>
      </View>

      {/* Daily cap chip */}
      <View style={[styles.capChip, { bottom: insets.bottom + 18 }]} pointerEvents="none">
        <Text style={styles.capTxt}>
          اليوم: {earnedToday}/{DAILY_GAME_CAP} 🪙
        </Text>
      </View>

      {/* Idle overlay */}
      {status === "idle" && (
        <View style={styles.overlay} pointerEvents="none">
          <Image source={BIRD_LOGO} style={styles.idleLogo} />
          <Text style={styles.title}>العب واربح</Text>
          <Text style={styles.sub}>مرّر الطائر بين الأعمدة</Text>
          <View style={styles.hintPill}>
            <Feather name="mouse-pointer" size={13} color={PRIMARY} />
            <Text style={styles.hintTxt}>اضغط في أي مكان ليطير</Text>
          </View>
          <Text style={styles.rewardHint}>
            كل عمود تعبره = 🪙 1 · حتى {DAILY_GAME_CAP} يوميًا
          </Text>
          <Text style={styles.hiTxt}>أعلى نتيجة: {hi}</Text>
        </View>
      )}

      {/* Game-over overlay */}
      {status === "over" && (
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.goTitle}>انتهت الجولة</Text>
            <Text style={styles.goScore}>{S.score}</Text>
            <Text style={styles.goScoreLbl}>عمود تم عبوره</Text>

            {lastReward > 0 ? (
              <View style={styles.goRewardPill}>
                <Image source={COIN_IMG} style={styles.goRewardCoin} />
                <Text style={styles.goRewardTxt}>+{lastReward}</Text>
              </View>
            ) : earnedToday >= DAILY_GAME_CAP ? (
              <Text style={styles.goCap}>بلغت حد اليوم ({DAILY_GAME_CAP} 🪙)</Text>
            ) : null}

            <Text style={styles.goHi}>أعلى نتيجة: {hi}</Text>

            <Pressable style={styles.playAgain} onPress={startGame}>
              <Feather name="rotate-ccw" size={16} color="#000" />
              <Text style={styles.playAgainTxt}>العب مجددًا</Text>
            </Pressable>
            <Pressable style={styles.backLink} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backLinkTxt}>رجوع</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, overflow: "hidden" },

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
  glowBottom: {
    position: "absolute",
    bottom: -200,
    left: "50%",
    marginLeft: -220,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: "rgba(232,184,109,0.05)",
  },

  // ── Pipes ──
  pipe: {
    position: "absolute",
    backgroundColor: PRIMARY,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PRIMARY_DARK,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  pipeCapBottom: {
    position: "absolute",
    bottom: -2,
    left: -6,
    width: PIPE_W + 12,
    height: 18,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: PRIMARY_DARK,
  },
  pipeCapTop: {
    position: "absolute",
    top: -2,
    left: -6,
    width: PIPE_W + 12,
    height: 18,
    borderRadius: 8,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: PRIMARY_DARK,
  },

  // ── Bird ──
  bird: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 9,
  },
  birdImg: { width: "100%", height: "100%", resizeMode: "contain" },

  scoreBig: {
    position: "absolute",
    alignSelf: "center",
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // ── Header ──
  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 20,
  },
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
  coinPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(232,184,109,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.3)",
  },
  coinImg: { width: 18, height: 18, resizeMode: "contain" },
  coinTxt: { fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY },

  capChip: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(232,184,109,0.08)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.25)",
    zIndex: 10,
  },
  capTxt: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: PRIMARY },

  // ── Overlays ──
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 15,
  },
  idleLogo: { width: 76, height: 76, resizeMode: "contain", marginBottom: 14 },
  title: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    textShadowColor: "rgba(232,184,109,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: "rgba(232,184,109,0.1)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.35)",
  },
  hintTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: PRIMARY },
  rewardHint: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    marginTop: 16,
    textAlign: "center",
  },
  hiTxt: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(232,184,109,0.85)",
    marginTop: 10,
  },

  // ── Game over card ──
  card: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 22,
    borderRadius: 26,
    backgroundColor: "#100B07",
    borderWidth: 1.5,
    borderColor: "rgba(232,184,109,0.35)",
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 14,
  },
  goTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.9)" },
  goScore: {
    fontSize: 58,
    fontFamily: "Inter_700Bold",
    color: PRIMARY,
    marginTop: 4,
    textShadowColor: "rgba(232,184,109,0.5)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  goScoreLbl: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)",
    marginTop: -2,
  },
  goRewardPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "rgba(232,184,109,0.14)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.4)",
  },
  goRewardCoin: { width: 22, height: 22, resizeMode: "contain" },
  goRewardTxt: { fontSize: 20, fontFamily: "Inter_700Bold", color: PRIMARY },
  goCap: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    marginTop: 16,
    textAlign: "center",
  },
  goHi: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(232,184,109,0.85)",
    marginTop: 14,
  },
  playAgain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 18,
    backgroundColor: PRIMARY,
  },
  playAgainTxt: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#000" },
  backLink: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 16 },
  backLinkTxt: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.55)" },
});
