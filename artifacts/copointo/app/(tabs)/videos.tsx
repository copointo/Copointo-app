import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/context/AppContext";
import { formatNumber } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { apiFetch, apiPost, apiDelete, API_BASE } from "@/constants/api";

// Per-device anonymous identifier so logged-out viewers each count once for
// likes/views — never share a single "guest" identity across all devices.
const ANON_KEY = "copointo_anon_id_v1";
async function getAnonId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(ANON_KEY);
    if (existing) return existing;
    const fresh = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    return `anon_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
// Smaller, card-style video so multiple reels fit naturally in the feed and
// each reel's likes/comments can be shown directly underneath it.
const VIDEO_HEIGHT = Math.min(Math.round(SCREEN_HEIGHT * 0.55), 520);

interface Reel {
  id: string;
  cafeId: string;
  cafeName: string;
  cafeLogo?: string;
  videoUrl: string;
  description: string;
  orderLink: string;
  locationUrl: string;
  views: number;
  likes: number;
  comments: number;
  likedByMe: boolean;
  createdAt: string;
}

interface Comment {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
}

const PRIMARY = "#E8B86D";

// ── Native-safe video element. On web we use <video>, on native a placeholder
// thumbnail (full Expo video integration is out of scope for this slice;
// the user is testing in the web preview iframe).
function ReelVideo({ src, isActive, muted }: { src: string; isActive: boolean; muted: boolean }) {
  const videoRef = useRef<any>(null);
  // Imperatively sync the muted property so the user can unmute mid-playback
  // without React tearing down the <video> element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (isActive) {
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => { /* autoplay may be blocked when unmuted */ });
    } else {
      // Pausing on the inactive reels (and especially when the user leaves
      // the Videos tab) is critical so audio doesn't keep playing in the
      // background.
      try { el.pause?.(); } catch { /* ignore */ }
    }
  }, [muted, isActive]);

  if (Platform.OS === "web") {
    // Relative API paths (e.g. "/api/reels/123/video") must be resolved
    // against the API origin — the Expo web app is served from a different
    // host than api-server, so a bare relative URL would 404 (black screen).
    const resolved = /^https?:\/\//i.test(src) || src.startsWith("data:")
      ? src
      : `${API_BASE}${src.replace(/^\/api/, "")}`;
    return React.createElement("video" as any, {
      ref: videoRef,
      src: resolved,
      autoPlay: isActive,
      loop: true,
      muted,
      playsInline: true,
      // Instagram-like: only the active reel pre-buffers, neighbours lazy-load
      // metadata. The browser's native HTTP Range buffering will pause/stall
      // gracefully on weak networks instead of showing a black frame.
      preload: isActive ? "auto" : "metadata",
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        backgroundColor: "#000",
      },
    });
  }
  return (
    <View style={{ flex: 1, backgroundColor: "#111", alignItems: "center", justifyContent: "center" }}>
      <Feather name="play-circle" size={64} color="#E8B86D" />
      <Text style={{ color: "#E8B86D", marginTop: 8 }}>فيديو</Text>
    </View>
  );
}

function ReelCard({
  reel,
  isActive,
  muted,
  onToggleMute,
  onLike,
  onOrder,
  onLocation,
  onView,
  userId,
  userName,
  onCommentsCountChange,
}: {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onOrder: () => void;
  onLocation: () => void;
  onView: () => void;
  userId: string;
  userName: string;
  onCommentsCountChange: (reelId: string, delta: number) => void;
}) {
  const viewedRef = useRef(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (isActive && !viewedRef.current) {
      viewedRef.current = true;
      onView();
    }
  }, [isActive, onView]);

  // Each card fetches its own comments so they can be displayed inline
  // underneath the video — there's no longer a separate modal.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch<{ comments: Comment[] }>(`/reels/${reel.id}/comments`);
        if (!cancelled) setComments(r.comments ?? []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [reel.id]);

  const submitComment = useCallback(async () => {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft("");
    try {
      const r = await apiPost<{ comment: Comment }>(`/reels/${reel.id}/comments`, {
        userId, userName, text,
      });
      setComments((prev) => [...prev, r.comment]);
      onCommentsCountChange(reel.id, +1);
    } catch { /* ignore */ }
  }, [draft, reel.id, userId, userName, onCommentsCountChange]);

  const deleteComment = useCallback(async (cid: string) => {
    // Optimistic delete — reconcile silently if the request fails.
    setComments((prev) => prev.filter((c) => c.id !== cid));
    onCommentsCountChange(reel.id, -1);
    try {
      await apiDelete<{ ok: boolean }>(`/reels/${reel.id}/comments/${cid}`);
    } catch { /* ignore */ }
  }, [reel.id, onCommentsCountChange]);

  return (
    <View style={styles.card}>
      <View style={[styles.videoBox, { height: VIDEO_HEIGHT }]}>
        <ReelVideo src={reel.videoUrl} isActive={isActive} muted={muted} />
        <TouchableOpacity
          onPress={onToggleMute}
          style={styles.muteBtnFloat}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
        </TouchableOpacity>
        <View style={styles.viewsChipFloat}>
          <Feather name="eye" size={12} color="#fff" />
          <Text style={styles.viewsChipText}>{formatNumber(reel.views)}</Text>
        </View>
      </View>

      <View style={styles.infoBlock}>
        <View style={styles.cafeRow}>
          <View style={styles.cafeLogoBubble}>
            <Text style={{ color: PRIMARY, fontWeight: "700" }}>
              {reel.cafeName?.[0] ?? "C"}
            </Text>
          </View>
          <Text style={styles.cafeName} numberOfLines={1}>{reel.cafeName}</Text>
        </View>

        {!!reel.description && (
          <TouchableOpacity
            onPress={() => setDetailsOpen(true)}
            style={styles.detailsBtn}
            activeOpacity={0.7}
          >
            <Feather name="file-text" size={14} color="#000" />
            <Text style={styles.detailsBtnText}>اقرأ التفاصيل</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity onPress={onLike} style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons
              name={reel.likedByMe ? "heart" : "heart-outline"}
              size={22}
              color={reel.likedByMe ? "#FF1744" : "#fff"}
            />
            <Text style={styles.actionLabel}>{formatNumber(reel.likes)}</Text>
          </TouchableOpacity>
          <View style={styles.actionBtn}>
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.actionLabel}>{formatNumber(comments.length)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={onOrder} style={styles.cta} activeOpacity={0.7}>
            <Feather name="shopping-bag" size={14} color="#000" />
            <Text style={styles.ctaText}>اطلب</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onLocation} style={styles.ctaAlt} activeOpacity={0.7}>
            <Feather name="map-pin" size={14} color={PRIMARY} />
            <Text style={[styles.ctaText, { color: PRIMARY }]}>الموقع</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentsList}>
          {comments.length === 0 ? (
            <Text style={styles.noComments}>لا توجد تعليقات بعد — كن أول من يعلق</Text>
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentName}>{c.userName}</Text>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => deleteComment(c.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.commentDelBtn}
                  activeOpacity={0.6}
                >
                  <Feather name="trash-2" size={14} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.commentInputBar}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="اكتب تعليقاً…"
            placeholderTextColor="#777"
            style={styles.commentInput}
            onSubmitEditing={submitComment}
            returnKeyType="send"
          />
          <TouchableOpacity onPress={submitComment} style={styles.sendBtn} activeOpacity={0.7}>
            <Feather name="send" size={16} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={detailsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <TouchableOpacity
          style={styles.detailsBackdrop}
          activeOpacity={1}
          onPress={() => setDetailsOpen(false)}
        >
          <TouchableOpacity
            style={styles.detailsCard}
            activeOpacity={1}
            onPress={() => { /* swallow */ }}
          >
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>التفاصيل</Text>
              <TouchableOpacity
                onPress={() => setDetailsOpen(false)}
                style={styles.detailsClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="x" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.detailsBody}>{reel.description}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function VideosScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user: currentUser } = useApp();

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  // Reels start muted (browsers block autoplay-with-sound). The user can
  // unmute via the small speaker button at the bottom-left of any reel; the
  // state is shared across all reels so they keep the same audio preference.
  const [muted, setMuted] = useState(true);
  // When the user leaves the Videos tab we want every reel to pause and
  // mute immediately so audio doesn't keep playing in the background.
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );
  const [anonId, setAnonId] = useState<string>("");
  useEffect(() => { getAnonId().then(setAnonId); }, []);
  const userId = currentUser?.phone ?? currentUser?.id ?? anonId;
  const userName = currentUser?.gameUsername ?? currentUser?.name ?? "ضيف";

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiFetch<{ reels: Reel[] }>(`/reels?userId=${encodeURIComponent(userId)}`);
      setReels(r.reels ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first && typeof first.index === "number") setActiveIndex(first.index);
  }).current;

  const updateCommentsCount = useCallback((reelId: string, delta: number) => {
    setReels((prev) => prev.map((x) =>
      x.id === reelId ? { ...x, comments: Math.max(0, x.comments + delta) } : x,
    ));
  }, []);

  const handleView = useCallback(async (reelId: string) => {
    try {
      const r = await apiPost<{ views: number }>(`/reels/${reelId}/view`, { userId });
      setReels((prev) => prev.map((x) => x.id === reelId ? { ...x, views: r.views } : x));
    } catch { /* ignore */ }
  }, [userId]);

  const handleLike = useCallback(async (reel: Reel) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // optimistic
    setReels((prev) => prev.map((x) =>
      x.id === reel.id
        ? { ...x, likedByMe: !x.likedByMe, likes: x.likes + (x.likedByMe ? -1 : 1) }
        : x,
    ));
    try {
      const r = await apiPost<{ liked: boolean; likes: number }>(`/reels/${reel.id}/like`, { userId, userName });
      setReels((prev) => prev.map((x) =>
        x.id === reel.id ? { ...x, likedByMe: r.liked, likes: r.likes } : x,
      ));
    } catch {
      // Revert optimistic update on failure to keep UI in sync with server.
      setReels((prev) => prev.map((x) =>
        x.id === reel.id
          ? { ...x, likedByMe: reel.likedByMe, likes: reel.likes }
          : x,
      ));
    }
  }, [userId, userName]);

  const handleOrder = useCallback((reel: Reel) => {
    if (reel.orderLink?.startsWith("copointo://cafe/")) {
      const cafeId = reel.orderLink.replace("copointo://cafe/", "");
      router.push(`/cafe/${cafeId}` as any);
    } else if (reel.orderLink) {
      Linking.openURL(reel.orderLink).catch(() => router.push(`/cafe/${reel.cafeId}` as any));
    } else {
      router.push(`/cafe/${reel.cafeId}` as any);
    }
  }, [router]);

  const handleLocation = useCallback((reel: Reel) => {
    if (reel.locationUrl) Linking.openURL(reel.locationUrl).catch(() => {});
  }, []);

  if (loading) {
    return (
      <View style={[styles.empty, { backgroundColor: "#000" }]}>
        <ActivityIndicator color={PRIMARY} />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: "#000" }]}>
        <Feather name="video-off" size={48} color="#E8B86D" />
        <Text style={styles.emptyTitle}>لا توجد ريلز بعد</Text>
        <Text style={styles.emptyHint}>عودة قريباً — الكوفيات يحضرون فيديوهاتهم</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <FlatList
        data={reels}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 12 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            isActive={index === activeIndex && screenFocused}
            muted={muted || !screenFocused}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={() => handleLike(item)}
            onOrder={() => handleOrder(item)}
            onLocation={() => handleLocation(item)}
            onView={() => handleView(item.id)}
            userId={userId}
            userName={userName}
            onCommentsCountChange={updateCommentsCount}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%", maxWidth: 560, alignSelf: "center",
    backgroundColor: "#0A0606", borderRadius: 18, overflow: "hidden",
    marginBottom: 16, marginHorizontal: 8,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.18)",
  },
  videoBox: { width: "100%", backgroundColor: "#000", position: "relative" },
  muteBtnFloat: {
    position: "absolute", left: 10, bottom: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  viewsChipFloat: {
    position: "absolute", right: 10, bottom: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  viewsChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },

  infoBlock: { padding: 12, gap: 10 },
  cafeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cafeLogoBubble: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#0A0606",
    borderWidth: 2, borderColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  cafeName: { color: "#fff", fontWeight: "700", fontSize: 15, flexShrink: 1 },

  detailsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
    backgroundColor: PRIMARY,
  },
  detailsBtnText: { color: "#000", fontSize: 12, fontWeight: "800" },

  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 2 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cta: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    backgroundColor: PRIMARY,
  },
  ctaAlt: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    borderWidth: 1.2, borderColor: PRIMARY, backgroundColor: "rgba(0,0,0,0.3)",
  },
  ctaText: { color: "#000", fontSize: 12, fontWeight: "800" },

  commentsList: {
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 10, gap: 8,
  },
  noComments: { color: "#888", fontSize: 13, textAlign: "right", paddingVertical: 4 },
  commentItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10,
  },
  commentName: { color: PRIMARY, fontWeight: "700", fontSize: 13, marginBottom: 2 },
  commentText: { color: "#fff", fontSize: 14, lineHeight: 19 },
  commentDelBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,107,107,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  commentInputBar: {
    flexDirection: "row", gap: 8, alignItems: "center",
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingTop: 10,
  },
  commentInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8, color: "#fff", textAlign: "right",
    fontSize: 14,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },

  detailsBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", padding: 24,
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } as any) : {}),
  },
  detailsCard: {
    width: "100%", maxWidth: 480, maxHeight: "70%",
    backgroundColor: "#0A0606", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.35)",
    padding: 16,
  },
  detailsHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 12,
  },
  detailsTitle: { color: PRIMARY, fontWeight: "800", fontSize: 16 },
  detailsClose: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  detailsBody: { color: "#fff", fontSize: 15, lineHeight: 22, textAlign: "right" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyHint: { color: "#888", marginTop: 6 },
});

