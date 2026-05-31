import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCoins } from "@/hooks/useCoins";

const BG = "#07060A";
const PRIMARY = "#E8B86D";
const PRIMARY_DARK = "#B07F3F";

const BIRD_LOGO = require("../assets/images/copointo-logo.png");
const COIN_IMG = require("../assets/images/copointo-coin.png");

// ── Physics / layout tuning ──
const GRAVITY = 1500;       // px / s²
const FLAP_V = -500;        // px / s (negative = up) — stronger flap
const PIPE_W = 66;
const PIPE_GAP = 205;       // vertical opening between pipes
const PIPE_SPEED = 165;     // px / s
const PIPE_SPACING = 240;   // horizontal distance between pipes
const BIRD_SIZE = 40;
const DAILY_GAME_CAP = 100; // max coins earnable per day from this game
const FIXED_DT = 1 / 120;   // physics sub-step (decoupled from refresh rate)
const MAX_PIPES = 5;        // recycled pool of on-screen pipe pairs

const HI_KEY = "copointo_flappy_hi_v1";
const DAY_KEY = "copointo_flappy_day_v1";
const EARNED_KEY = "copointo_flappy_earned_v1";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

type PipeS = { x: number; gapY: number; scored: boolean };
type Status = "idle" | "playing" | "over";

// A single recycled pipe pair (top + bottom). Both halves are full-screen-tall
// and positioned purely with transforms on the UI thread, so only translate
// values change per frame — no layout passes, no JS-thread work, zero stutter.
function PipePair({
  index,
  pipes,
  worldH,
}: {
  index: number;
  pipes: SharedValue<PipeS[]>;
  worldH: SharedValue<number>;
}) {
  const topStyle = useAnimatedStyle(() => {
    const p = pipes.value[index];
    if (!p) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }] };
    const gapTop = p.gapY - PIPE_GAP / 2;
    return {
      opacity: 1,
      transform: [{ translateX: p.x }, { translateY: gapTop - worldH.value }],
    };
  });
  const bottomStyle = useAnimatedStyle(() => {
    const p = pipes.value[index];
    if (!p) return { opacity: 0, transform: [{ translateX: -9999 }, { translateY: 0 }] };
    const gapBottom = p.gapY + PIPE_GAP / 2;
    return {
      opacity: 1,
      transform: [{ translateX: p.x }, { translateY: gapBottom }],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.pipe, styles.pipeFull, topStyle]}>
        <View style={styles.pipeCapBottom} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.pipe, styles.pipeFull, bottomStyle]}>
        <View style={styles.pipeCapTop} />
      </Animated.View>
    </>
  );
}

export default function FlappyCopointoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { balance, addCoins } = useCoins();

  const [hi, setHi] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const [lastReward, setLastReward] = useState(0);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);

  // ── UI-thread animation state (Reanimated shared values) ──
  const birdX = useSharedValue(0);
  const birdY = useSharedValue(0);
  const birdV = useSharedValue(0);
  const acc = useSharedValue(0);
  const running = useSharedValue(0); // 1 while the simulation should advance
  const worldW = useSharedValue(0);
  const worldH = useSharedValue(0);
  const pipes = useSharedValue<PipeS[]>([]);

  const S = useRef({
    W: 0,
    H: 0,
    score: 0,
    status: "idle" as Status,
    overAt: 0,
    earnedToday: 0,
    runReward: 0,
    hi: 0,
    hydrated: false,
    dayStr: todayStr(),
    laidOut: false,
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
  }, []);

  const persistDaily = () => {
    AsyncStorage.multiSet([
      [DAY_KEY, todayStr()],
      [EARNED_KEY, String(S.earnedToday)],
    ]).catch(() => {});
  };
  const persistHi = () => {
    AsyncStorage.setItem(HI_KEY, String(S.hi)).catch(() => {});
  };

  // Called from the UI thread (via runOnJS) once per pipe cleared.
  const handleScore = () => {
    S.score += 1;
    setScore(S.score);
    // Reward 1 coin per pipe passed, immediately, while under the daily cap —
    // so quitting mid-run never loses earned coins.
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
  };

  // Called from the UI thread (via runOnJS) when the bird crashes.
  const handleEnd = () => {
    if (S.status !== "playing") return;
    S.status = "over";
    S.overAt = Date.now();
    tick.setActive(false);
    setStatus("over");
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

  // The entire simulation runs inside this worklet on the UI thread. Using a
  // fixed timestep accumulator keeps motion perfectly deterministic and
  // jitter-free regardless of the device refresh rate, and because nothing
  // here touches the JS thread per frame the motion never stutters.
  const tick = useFrameCallback((info) => {
    "worklet";
    if (running.value !== 1) return;
    let elapsed = (info.timeSincePreviousFrame ?? FIXED_DT * 1000) / 1000;
    if (elapsed > 0.25) elapsed = 0.25; // clamp after a long pause
    acc.value += elapsed;

    let guard = 0;
    while (acc.value >= FIXED_DT && running.value === 1 && guard < 16) {
      guard += 1;
      acc.value -= FIXED_DT;

      birdV.value += GRAVITY * FIXED_DT;
      birdY.value += birdV.value * FIXED_DT;

      // Rebuild the pipe list (new array so dependent styles recompute).
      let next: PipeS[] = [];
      for (let i = 0; i < pipes.value.length; i++) {
        const p = pipes.value[i]!;
        next.push({ x: p.x - PIPE_SPEED * FIXED_DT, gapY: p.gapY, scored: p.scored });
      }
      const lastP = next.length ? next[next.length - 1]! : null;
      if (!lastP || lastP.x < worldW.value - PIPE_SPACING) {
        const margin = PIPE_GAP / 2 + 48;
        const gapY = margin + Math.random() * Math.max(1, worldH.value - margin * 2);
        next.push({ x: worldW.value, gapY, scored: false });
      }
      next = next.filter((p) => p.x + PIPE_W > -20);
      if (next.length > MAX_PIPES) next = next.slice(next.length - MAX_PIPES);

      for (let i = 0; i < next.length; i++) {
        const p = next[i]!;
        if (!p.scored && p.x + PIPE_W < birdX.value) {
          p.scored = true;
          runOnJS(handleScore)();
        }
        const within = birdX.value + BIRD_SIZE > p.x && birdX.value < p.x + PIPE_W;
        if (within) {
          const gapTop = p.gapY - PIPE_GAP / 2;
          const gapBottom = p.gapY + PIPE_GAP / 2;
          if (birdY.value < gapTop || birdY.value + BIRD_SIZE > gapBottom) {
            running.value = 0;
            runOnJS(handleEnd)();
          }
        }
      }

      if (birdY.value < 0) {
        birdY.value = 0;
        birdV.value = 0;
      }
      if (birdY.value + BIRD_SIZE >= worldH.value) {
        birdY.value = worldH.value - BIRD_SIZE;
        running.value = 0;
        runOnJS(handleEnd)();
      }

      pipes.value = next;
    }
  }, false);

  // ── Stop the loop when the screen loses focus ──
  useFocusEffect(
    useCallback(() => {
      return () => {
        running.value = 0;
        tick.setActive(false);
        if (S.status === "playing") {
          S.status = "over";
          setStatus("over");
        }
      };
    }, []),
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const first = !S.laidOut;
    S.W = width;
    S.H = height;
    worldW.value = width;
    worldH.value = height;
    birdX.value = Math.round(width * 0.28);
    if (first) {
      S.laidOut = true;
      birdY.value = height * 0.42;
      setReady(true);
    }
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
    birdY.value = S.H * 0.42;
    birdV.value = 0;
    acc.value = 0;
    pipes.value = [];
    S.score = 0;
    S.runReward = 0;
    setScore(0);
    setLastReward(0);
    S.status = "playing";
    setStatus("playing");
    running.value = 1;
    tick.setActive(true);
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
      birdV.value = FLAP_V;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        /* ignore */
      }
    }
  };

  const birdStyle = useAnimatedStyle(() => {
    const angle = Math.max(-22, Math.min(70, birdV.value * 0.06));
    return {
      transform: [
        { translateX: birdX.value },
        { translateY: birdY.value },
        { rotate: `${angle}deg` },
      ],
    };
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      {/* Tap surface (idle taps pass through to start/flap) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onTap}>
        <View pointerEvents="none" style={styles.glowTop} />
        <View pointerEvents="none" style={styles.glowBottom} />

        {/* Pipes (recycled pool, animated entirely on the UI thread) */}
        {ready &&
          Array.from({ length: MAX_PIPES }).map((_, i) => (
            <PipePair key={i} index={i} pipes={pipes} worldH={worldH} />
          ))}

        {/* Bird */}
        {ready && (
          <Animated.View pointerEvents="none" style={[styles.bird, styles.birdBox, birdStyle]}>
            <Image source={BIRD_LOGO} style={styles.birdImg} />
          </Animated.View>
        )}

        {/* Live score */}
        {status === "playing" && (
          <Text style={[styles.scoreBig, { top: insets.top + 64 }]}>{score}</Text>
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
          <Text style={styles.title}>Flappy Copointo</Text>
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
  // Full-screen-tall halves positioned via transform (top:0/left:0 anchor).
  pipeFull: { top: 0, left: 0, width: PIPE_W, height: "100%" },
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
  birdBox: { top: 0, left: 0, width: BIRD_SIZE, height: BIRD_SIZE },
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
