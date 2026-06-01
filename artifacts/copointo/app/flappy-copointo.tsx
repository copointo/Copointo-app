import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useCoins } from "@/hooks/useCoins";
import { FLAPPY_COIN_DATA_URI } from "@/data/flappyCoinAsset";

const BG = "#07060A";
const PRIMARY = "#E8B86D";

const COIN_IMG = require("../assets/images/copointo-coin.png");

const DAILY_GAME_CAP = 100; // max coins earnable per day from this game

// Persisted high score + daily-earned counters. Kept on the same AsyncStorage
// keys the previous in-app version used, so player progress carries over.
const HI_KEY = "copointo_flappy_hi_v1";
const DAY_KEY = "copointo_flappy_day_v1";
const EARNED_KEY = "copointo_flappy_earned_v1";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Serialize JSON for safe embedding inside an HTML <script> tag. Escapes `</`
 * so a value cannot terminate the script tag, plus U+2028/U+2029 which break
 * JS parsers. (Same hardening used by the cafes map.)
 */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\/(script)/gi, "<\\/$1")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Build the self-contained Flappy Copointo game page. It renders the entire
 * game on a 2D <canvas> with plain requestAnimationFrame — no React Native /
 * Reanimated involved — so it can never stutter or take the app down. The bird
 * and the glowing top emblem are our real Copointo coin (a small inlined PNG so
 * the page stays tiny). It reports progress to the
 * host via `ReactNativeWebView.postMessage` (native) or `window.parent.postMessage`
 * (web iframe):
 *   - { type: "coin", earned }      a pipe was cleared and a coin awarded
 *   - { type: "hi", hi }            a new high score was set
 *   - { type: "gameover", score }   the run ended
 *   - { type: "back" }              the player tapped "رجوع"
 */
function buildGameHtml(init: { hi: number; earned: number; cap: number; today: string }): string {
  const initJson = safeJsonForScript(init);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { height: 100%; background: #07060A; overflow: hidden;
    font-family: -apple-system, "Segoe UI", system-ui, sans-serif; user-select: none; -webkit-user-select: none; }
  #c { display: block; width: 100%; height: 100%; touch-action: none; }
  .overlay { position: fixed; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 0 24px; text-align: center; z-index: 15; }
  .hidden { display: none !important; }
  #score { position: fixed; top: calc(env(safe-area-inset-top) + 70px); left: 0; right: 0; text-align: center;
    font-size: 64px; font-weight: 800; color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,0.6); z-index: 12; }
  #cap { position: fixed; bottom: calc(env(safe-area-inset-bottom) + 18px); left: 50%; transform: translateX(-50%);
    padding: 7px 14px; border-radius: 16px; background: rgba(232,184,109,0.08);
    border: 1px solid rgba(232,184,109,0.25); color: #E8B86D; font-size: 12px; font-weight: 600;
    white-space: nowrap; z-index: 10; }
  .title { font-size: 30px; font-weight: 800; color: #E8B86D; text-shadow: 0 0 16px rgba(232,184,109,0.5); }
  .sub { font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.78); margin-top: 8px; }
  .pill { display: inline-flex; align-items: center; gap: 7px; margin-top: 16px; padding: 8px 14px;
    border-radius: 18px; background: rgba(232,184,109,0.10); border: 1px solid rgba(232,184,109,0.3);
    color: #E8B86D; font-size: 13px; font-weight: 600; }
  .rewardHint { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 14px; }
  .hi { font-size: 13px; color: rgba(232,184,109,0.85); margin-top: 10px; font-weight: 600; }
  .card { background: #0A0606; border: 1px solid rgba(232,184,109,0.3); border-radius: 24px;
    padding: 26px 30px; display: flex; flex-direction: column; align-items: center;
    box-shadow: 0 18px 50px rgba(0,0,0,0.6); }
  .goTitle { font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.85); }
  .goScore { font-size: 56px; font-weight: 800; color: #E8B86D; line-height: 1.1; margin-top: 4px;
    text-shadow: 0 0 18px rgba(232,184,109,0.5); }
  .goScoreLbl { font-size: 13px; color: rgba(255,255,255,0.55); margin-top: 2px; }
  .goReward { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 7px 16px;
    border-radius: 18px; background: rgba(232,184,109,0.12); color: #E8B86D; font-size: 16px; font-weight: 800; }
  .goCap { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 14px; }
  .goHi { font-size: 13px; color: rgba(232,184,109,0.85); margin-top: 12px; font-weight: 600; }
  .again { margin-top: 18px; display: inline-flex; align-items: center; gap: 8px; padding: 13px 26px;
    border-radius: 14px; background: #E8B86D; color: #000; font-size: 15px; font-weight: 800;
    border: none; cursor: pointer; }
  .back { margin-top: 14px; background: none; border: none; color: rgba(255,255,255,0.55);
    font-size: 14px; cursor: pointer; padding: 6px 10px; }
  .emoji { font-size: 1em; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="score" class="hidden">0</div>
<div id="cap"></div>

<div id="idle" class="overlay">
  <div class="title">Flappy Copointo</div>
  <div class="sub">مرّر الطائر بين الأعمدة</div>
  <div class="pill"><span class="emoji">👆</span><span>اضغط في أي مكان ليطير</span></div>
  <div class="rewardHint" id="idleReward"></div>
  <div class="hi" id="idleHi"></div>
</div>

<div id="over" class="overlay hidden">
  <div class="card">
    <div class="goTitle">انتهت الجولة</div>
    <div class="goScore" id="overScore">0</div>
    <div class="goScoreLbl">عمود تم عبوره</div>
    <div id="overReward"></div>
    <div class="goHi" id="overHi"></div>
    <button class="again" id="againBtn"><span class="emoji">🔄</span><span>العب مجددًا</span></button>
    <button class="back" id="backBtn">رجوع</button>
  </div>
</div>

<script>
(function () {
  var INIT = ${initJson};
  var CAP = INIT.cap;
  // Our real Copointo coin (small inlined PNG) used for the bird + the glowing
  // emblem at the top, instead of the old droplet / "moon" primitives.
  var COIN_SRC = "${FLAPPY_COIN_DATA_URI}";
  var coinImg = new Image();
  var coinReady = false;
  coinImg.onload = function () { coinReady = true; };
  coinImg.src = COIN_SRC;

  // ── Physics / layout tuning (mirrors the original feel) ──
  var GRAVITY = 1350, FLAP_V = -460;
  var PIPE_W = 68, PIPE_GAP = 224;
  var PIPE_SPEED = 148, PIPE_SPEED_MAX = 224, PIPE_SPEED_STEP = 2.4, PIPE_SPACING = 252;
  var BIRD_SIZE = 42, HITBOX_INSET = 7;
  var FIXED_DT = 1 / 120, MAX_PIPES = 6;
  var PRIMARY = "#E8B86D", PRIMARY_DARK = "#B07F3F";

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var capEl = document.getElementById("cap");
  var idleEl = document.getElementById("idle");
  var overEl = document.getElementById("over");
  var overScoreEl = document.getElementById("overScore");
  var overRewardEl = document.getElementById("overReward");
  var overHiEl = document.getElementById("overHi");

  var W = 0, H = 0, dpr = 1;
  var birdX = 0, birdY = 0, birdV = 0;
  var pipes = [];
  var speed = PIPE_SPEED;
  var status = "idle"; // idle | playing | over
  var score = 0, runReward = 0;
  var hi = INIT.hi || 0;
  var earned = INIT.earned || 0;

  function send(p) {
    var m = JSON.stringify(p);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(m);
    } else if (window.parent && window.parent !== window) {
      window.parent.postMessage(m, "*");
    }
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    birdX = Math.round(W * 0.28);
    if (status === "idle") birdY = H * 0.42;
  }
  window.addEventListener("resize", resize);

  function setCap() {
    capEl.textContent = "اليوم: " + earned + "/" + CAP + " 🪙";
  }
  document.getElementById("idleReward").textContent =
    "كل عمود تعبره = 🪙 1 · حتى " + CAP + " يوميًا";
  document.getElementById("idleHi").textContent = "أعلى نتيجة: " + hi;

  function start() {
    birdY = H * 0.42; birdV = 0;
    pipes = []; speed = PIPE_SPEED;
    score = 0; runReward = 0;
    scoreEl.textContent = "0";
    scoreEl.classList.remove("hidden");
    idleEl.classList.add("hidden");
    overEl.classList.add("hidden");
    status = "playing";
  }

  function flap() {
    if (status === "idle") { start(); return; }
    if (status === "playing") birdV = FLAP_V;
  }

  function gameOver() {
    if (status !== "playing") return;
    status = "over";
    scoreEl.classList.add("hidden");
    overScoreEl.textContent = String(score);
    if (runReward > 0) {
      overRewardEl.className = "goReward";
      overRewardEl.innerHTML = '<span class="emoji">🪙</span>+' + runReward;
    } else if (earned >= CAP) {
      overRewardEl.className = "goCap";
      overRewardEl.textContent = "بلغت حد اليوم (" + CAP + " 🪙)";
    } else {
      overRewardEl.className = "goCap hidden";
      overRewardEl.textContent = "";
    }
    if (score > hi) { hi = score; send({ type: "hi", hi: hi }); }
    overHiEl.textContent = "أعلى نتيجة: " + hi;
    overEl.classList.remove("hidden");
    send({ type: "gameover", score: score });
  }

  function step(dt) {
    birdV += GRAVITY * dt;
    birdY += birdV * dt;

    for (var i = 0; i < pipes.length; i++) pipes[i].x -= speed * dt;

    var lastP = pipes.length ? pipes[pipes.length - 1] : null;
    if (!lastP || lastP.x < W - PIPE_SPACING) {
      var margin = PIPE_GAP / 2 + 48;
      var gapY = margin + Math.random() * Math.max(1, H - margin * 2);
      pipes.push({ x: W, gapY: gapY, scored: false });
    }
    while (pipes.length && pipes[0].x + PIPE_W < -20) pipes.shift();
    if (pipes.length > MAX_PIPES) pipes = pipes.slice(pipes.length - MAX_PIPES);

    var bx = birdX + HITBOX_INSET, bw = BIRD_SIZE - HITBOX_INSET * 2;
    var by = birdY + HITBOX_INSET, bh = BIRD_SIZE - HITBOX_INSET * 2;
    for (var j = 0; j < pipes.length; j++) {
      var p = pipes[j];
      if (!p.scored && p.x + PIPE_W < birdX) {
        p.scored = true;
        speed = Math.min(PIPE_SPEED_MAX, speed + PIPE_SPEED_STEP);
        score += 1;
        scoreEl.textContent = String(score);
        if (earned < CAP) {
          earned += 1; runReward += 1;
          setCap();
          send({ type: "coin", earned: earned });
        }
      }
      if (bx + bw > p.x && bx < p.x + PIPE_W) {
        var gapTop = p.gapY - PIPE_GAP / 2, gapBottom = p.gapY + PIPE_GAP / 2;
        if (by < gapTop || by + bh > gapBottom) { gameOver(); return; }
      }
    }

    if (birdY < 0) { birdY = 0; birdV = 0; }
    if (birdY + BIRD_SIZE >= H) { birdY = H - BIRD_SIZE; gameOver(); }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tubeGrad(x) {
    var g = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
    g.addColorStop(0, "#6E461B"); g.addColorStop(0.28, "#C9974F");
    g.addColorStop(0.5, "#FBEAC6"); g.addColorStop(0.72, "#E8B86D"); g.addColorStop(1, "#7A4E1E");
    return g;
  }
  function capGrad(x) {
    var g = ctx.createLinearGradient(x - 7, 0, x + PIPE_W + 7, 0);
    g.addColorStop(0, "#7A4E1E"); g.addColorStop(0.33, "#F2D9A4");
    g.addColorStop(0.66, "#E8B86D"); g.addColorStop(1, "#6E461B");
    return g;
  }
  function drawTube(x, y, h) {
    ctx.save();
    roundRect(x, y, PIPE_W, h, 12);
    ctx.fillStyle = tubeGrad(x); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = PRIMARY_DARK; ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillRect(x + PIPE_W * 0.2, y, 5, h);
    ctx.restore();
  }
  function drawCap(x, y) {
    ctx.save();
    roundRect(x - 7, y, PIPE_W + 14, 20, 9);
    ctx.fillStyle = capGrad(x); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = PRIMARY_DARK; ctx.stroke();
    ctx.restore();
  }
  function drawPipe(p) {
    var gapTop = p.gapY - PIPE_GAP / 2, gapBottom = p.gapY + PIPE_GAP / 2;
    drawTube(p.x, 0, gapTop);
    drawCap(p.x, gapTop - 20);
    drawTube(p.x, gapBottom, H - gapBottom);
    drawCap(p.x, gapBottom);
  }

  // Top "emblem": our Copointo coin glowing, replacing the old moon.
  function drawMoon() {
    var cx = W / 2, cy = 132, r = 52;
    var glow = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 2.1);
    glow.addColorStop(0, "rgba(232,184,109,0.18)");
    glow.addColorStop(1, "rgba(232,184,109,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, r * 2.1, 0, Math.PI * 2); ctx.fill();
    if (coinReady) {
      ctx.drawImage(coinImg, cx - r, cy - r, r * 2, r * 2);
    } else {
      var cg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      cg.addColorStop(0, "#FBEAC6"); cg.addColorStop(0.5, "#E8B86D"); cg.addColorStop(1, "#9C6E33");
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = cg; ctx.fill();
    }
  }

  // The player is now our Copointo coin (with a slight tilt for feel),
  // instead of the old droplet shape.
  function drawBird() {
    var cx = birdX + BIRD_SIZE / 2, cy = birdY + BIRD_SIZE / 2, r = BIRD_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    var ang = Math.max(-20, Math.min(62, birdV * 0.05)) * Math.PI / 180;
    ctx.rotate(ang);
    ctx.shadowColor = "rgba(232,184,109,0.8)"; ctx.shadowBlur = 14;
    if (coinReady) {
      ctx.drawImage(coinImg, -r, -r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      var bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.2);
      bg.addColorStop(0, "#FBEAC6"); bg.addColorStop(0.55, "#E8B86D"); bg.addColorStop(1, "#B07F3F");
      ctx.fillStyle = bg; ctx.fill();
    }
    ctx.restore();
  }

  function render() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0E0B14"); bg.addColorStop(0.5, "#08070C"); bg.addColorStop(1, "#040308");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    drawMoon();
    for (var i = 0; i < pipes.length; i++) drawPipe(pipes[i]);
    drawBird();
  }

  var last = 0, acc = 0;
  function frame(t) {
    if (!last) last = t;
    var dt = (t - last) / 1000; last = t;
    if (dt > 0.25) dt = 0.25;
    if (status === "playing") {
      acc += dt; var guard = 0;
      while (acc >= FIXED_DT && status === "playing" && guard < 16) {
        guard += 1; acc -= FIXED_DT; step(FIXED_DT);
      }
    }
    render();
    requestAnimationFrame(frame);
  }

  // ── Input ──
  function onTap(e) { e.preventDefault(); flap(); }
  canvas.addEventListener("pointerdown", onTap);
  idleEl.addEventListener("pointerdown", onTap);
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
  });
  document.getElementById("againBtn").addEventListener("pointerdown", function (e) {
    e.preventDefault(); e.stopPropagation(); start();
  });
  document.getElementById("backBtn").addEventListener("pointerdown", function (e) {
    e.preventDefault(); e.stopPropagation(); send({ type: "back" });
  });

  resize();
  setCap();
  requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;
}

export default function FlappyCopointoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { balance, addCoins } = useCoins();

  const [seed, setSeed] = useState<{ hi: number; earned: number; today: string } | null>(null);
  // Host-authoritative daily progress. The embedded game also enforces the cap
  // for its own display, but the RN side is the source of truth for what is
  // actually persisted + awarded (handles day rollover and rejects over-cap).
  const progressRef = useRef<{ day: string; earned: number }>({ day: todayStr(), earned: 0 });

  // Load high score + today's earned coins, resetting the daily counter when
  // the date has rolled over (same logic as before, just done once up front).
  useEffect(() => {
    (async () => {
      const today = todayStr();
      let hi = 0;
      let earned = 0;
      try {
        const [h, d, e] = await Promise.all([
          AsyncStorage.getItem(HI_KEY),
          AsyncStorage.getItem(DAY_KEY),
          AsyncStorage.getItem(EARNED_KEY),
        ]);
        hi = h ? parseInt(h, 10) || 0 : 0;
        if (d === today) {
          earned = e ? parseInt(e, 10) || 0 : 0;
        } else {
          await AsyncStorage.multiSet([[DAY_KEY, today], [EARNED_KEY, "0"]]);
        }
      } catch {
        /* ignore */
      }
      progressRef.current = { day: today, earned };
      setSeed({ hi, earned, today });
    })();
  }, []);

  const html = useMemo(
    () =>
      seed
        ? buildGameHtml({ hi: seed.hi, earned: seed.earned, cap: DAILY_GAME_CAP, today: seed.today })
        : "",
    [seed],
  );

  // ── Bridge: messages coming from the game (native WebView + web iframe) ──
  const handleMessage = useCallback(
    (raw: string) => {
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        return;
      }
      if (!data || typeof data.type !== "string") return;
      switch (data.type) {
        case "coin": {
          // Host is authoritative: roll the daily counter over if the date
          // changed, and never award beyond the daily cap regardless of what
          // the embedded page reports.
          const today = todayStr();
          const prog = progressRef.current;
          if (prog.day !== today) {
            prog.day = today;
            prog.earned = 0;
          }
          if (prog.earned >= DAILY_GAME_CAP) {
            AsyncStorage.setItem(DAY_KEY, today).catch(() => {});
            break;
          }
          prog.earned += 1;
          addCoins(1);
          AsyncStorage.multiSet([
            [DAY_KEY, today],
            [EARNED_KEY, String(prog.earned)],
          ]).catch(() => {});
          try {
            Haptics.selectionAsync();
          } catch {
            /* ignore */
          }
          break;
        }
        case "hi": {
          if (Number.isFinite(data.hi)) {
            AsyncStorage.setItem(HI_KEY, String(data.hi)).catch(() => {});
          }
          break;
        }
        case "gameover": {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } catch {
            /* ignore */
          }
          break;
        }
        case "back": {
          router.back();
          break;
        }
        default:
          break;
      }
    },
    [addCoins, router],
  );

  // Web iframe message bridge — only trust messages from our own iframe.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data !== "string") return;
      // Only trust messages from our own game iframe.
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return;
      handleMessage(e.data);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [handleMessage]);

  return (
    <View style={styles.root}>
      {/* Game surface */}
      <View style={styles.gameWrap}>
        {!html ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : Platform.OS === "web" ? (
          <iframe
            ref={iframeRef}
            srcDoc={html}
            style={{ border: 0, width: "100%", height: "100%", display: "block" }}
            title="flappy-copointo"
            sandbox="allow-scripts"
          />
        ) : (
          <WebView
            originWhitelist={["*"]}
            source={{ html }}
            style={{ flex: 1, backgroundColor: BG }}
            onMessage={(e) => handleMessage(e.nativeEvent.data)}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            bounces={false}
          />
        )}
      </View>

      {/* Floating header (always available, even if the game hiccups) */}
      <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-right" size={20} color={PRIMARY} />
        </Pressable>
        <View style={styles.coinPill}>
          <Image source={COIN_IMG} style={styles.coinImg} />
          <Text style={styles.coinTxt}>{balance}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  gameWrap: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
});
