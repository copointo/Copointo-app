import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE, apiFetch } from "@/constants/api";
import { useApp } from "@/context/AppContext";
import { useCoins } from "@/hooks/useCoins";
import { playLevelUpSound } from "@/lib/notification-sound";

const COPOINTO_LOGO = require("../assets/images/copointo-logo.png");
const COPOINTO_COIN = require("../assets/images/copointo-coin.png");

const ACCENT = "#E8B86D";
const ACCENT_DIM = "rgba(232,184,109,0.30)";

interface CoinGift {
  id: string;
  userId: string;
  amount: number;
  message: string;
  createdAt: string;
  /** Super-admin reset signal: zero out balance silently, no modal. */
  reset?: boolean;
}

/**
 * Polls /coin-gifts?userId=... every 30s. When the super-admin sends the
 * signed-in user a coin gift, this modal pops up with a celebration. On
 * accept: addCoins(amount) is called locally and POST /coin-gifts/:id/claim
 * marks it consumed on the server so it never appears again.
 *
 * Mount once near the top of the app (currently inside the game screen).
 */
export default function CoinGiftModal() {
  const { user } = useApp();
  const { addCoins, setCoins } = useCoins();
  const userId = user?.id?.trim() || "";

  const [queue,   setQueue]   = useState<CoinGift[]>([]);
  const [current, setCurrent] = useState<CoinGift | null>(null);
  const [busy,    setBusy]    = useState(false);

  const scale = useRef(new Animated.Value(0.6)).current;
  const spin  = useRef(new Animated.Value(0)).current;

  // Poll for unclaimed gifts.
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiFetch<{ gifts: CoinGift[] }>(
        `/coin-gifts?userId=${encodeURIComponent(userId)}`,
      );
      const items = r.gifts ?? [];
      if (items.length > 0) {
        setQueue(prev => {
          // Merge server list with anything already queued, dedupe by id.
          const seen = new Set(prev.map(g => g.id));
          const merged = [...prev];
          for (const g of items) if (!seen.has(g.id)) merged.push(g);
          return merged;
        });
      }
    } catch { /* ignore */ }
  }, [userId]);

  // Silently handle super-admin RESET records: zero local balance + claim
  // on server, never queue them for the celebration modal.
  useEffect(() => {
    const resets = queue.filter(g => g.reset);
    if (resets.length === 0) return;
    (async () => {
      for (const g of resets) {
        try {
          await setCoins(0);
          await fetch(`${API_BASE}/coin-gifts/${g.id}/claim`, { method: "POST" });
        } catch { /* ignore — will retry next poll */ }
      }
      setQueue(prev => prev.filter(g => !g.reset));
    })();
  }, [queue, setCoins]);

  useEffect(() => {
    if (!userId) { setQueue([]); setCurrent(null); return; }
    let cancelled = false;
    const tick = async () => { if (!cancelled) await refresh(); };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [userId, refresh]);

  // Pop the next NON-reset gift from the queue when none is showing.
  // (Reset records are handled silently by the effect above.)
  useEffect(() => {
    if (current) return;
    if (queue.length === 0) return;
    const idx = queue.findIndex(g => !g.reset);
    if (idx === -1) return;
    const next = queue[idx]!;
    const rest = [...queue.slice(0, idx), ...queue.slice(idx + 1)];
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  // Entrance animation + chime + haptic when a gift becomes current.
  useEffect(() => {
    if (!current) return;
    scale.setValue(0.6);
    spin.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try { playLevelUpSound(); } catch { /* ignore */ }
  }, [current, scale, spin]);

  const claim = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/coin-gifts/${current.id}/claim`, { method: "POST" });
      if (res.ok) {
        await addCoins(current.amount);
      }
    } catch { /* ignore — server still has it for retry next poll */ }
    finally {
      setBusy(false);
      setCurrent(null);
    }
  };

  if (!current) return null;

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { /* must claim */ }}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {/* Confetti corners */}
          <Text style={[styles.confetti, { top: 8,  left: 12 }]}>🎉</Text>
          <Text style={[styles.confetti, { top: 8,  right: 12 }]}>✨</Text>
          <Text style={[styles.confetti, { bottom: 8, left: 12 }]}>🎊</Text>
          <Text style={[styles.confetti, { bottom: 8, right: 12 }]}>⭐</Text>

          {/* Brand header */}
          <View style={styles.header}>
            <Image source={COPOINTO_LOGO} style={styles.logo} />
            <View>
              <Text style={styles.fromLabel}>هدية رسمية من</Text>
              <Text style={styles.brandName}>شركة Copointo</Text>
            </View>
          </View>

          {/* Coin ring */}
          <View style={styles.coinWrap}>
            <Animated.View style={[styles.coinHaloOuter, { transform: [{ rotate }] }]} />
            <View style={styles.coinHaloInner} />
            <Image source={COPOINTO_COIN} style={styles.coin} />
          </View>

          <Text style={styles.title}>🎉 تهانينا!</Text>
          <Text style={styles.amountRow}>
            <Text style={styles.amount}>{current.amount.toLocaleString("en-US")}</Text>
            <Text style={styles.amountSuffix}> عملة</Text>
          </Text>

          <View style={styles.messageBox}>
            <Text style={styles.message}>{current.message}</Text>
          </View>

          <TouchableOpacity
            onPress={claim}
            disabled={busy}
            activeOpacity={0.85}
            style={[styles.acceptBtn, busy && { opacity: 0.6 }]}
          >
            <Feather name="gift" size={18} color="#000" />
            <Text style={styles.acceptText}>{busy ? "جارٍ الاستلام..." : "استلام الهدية"}</Text>
          </TouchableOpacity>

          {queue.length > 0 && (
            <Text style={styles.queueHint}>+{queue.length} هدية أخرى بانتظارك</Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#0d0905",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: ACCENT,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  confetti: { position: "absolute", fontSize: 22 },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  logo: { width: 38, height: 38, resizeMode: "contain" },
  fromLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textAlign: "right",
  },
  brandName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
    textAlign: "right",
  },
  coinWrap: {
    width: 130, height: 130,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  coinHaloOuter: {
    position: "absolute",
    width: 130, height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: ACCENT_DIM,
    borderStyle: "dashed",
  },
  coinHaloInner: {
    position: "absolute",
    width: 110, height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(232,184,109,0.12)",
  },
  coin: { width: 86, height: 86, resizeMode: "contain" },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    marginTop: 4,
  },
  amountRow: {
    marginTop: 6,
    textAlign: "center",
  },
  amount: {
    fontSize: 38,
    fontFamily: "Inter_900Black",
    color: ACCENT,
  },
  amountSuffix: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: ACCENT,
  },
  messageBox: {
    marginTop: 14,
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(232,184,109,0.08)",
    borderWidth: 1,
    borderColor: "rgba(232,184,109,0.25)",
    width: "100%",
  },
  message: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#FFF",
    textAlign: "center",
    lineHeight: 22,
  },
  acceptBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: ACCENT,
    width: "100%",
  },
  acceptText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000",
  },
  queueHint: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
});
