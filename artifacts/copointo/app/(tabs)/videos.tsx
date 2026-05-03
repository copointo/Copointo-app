import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "@/context/AppContext";
import { formatNumber } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";
import { apiFetch, apiPost, API_BASE } from "@/constants/api";

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
const VIDEO_HEIGHT = Platform.OS === "web" ? SCREEN_HEIGHT - 84 - 67 : SCREEN_HEIGHT;

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
function ReelVideo({ src, isActive }: { src: string; isActive: boolean }) {
  if (Platform.OS === "web") {
    return React.createElement("video" as any, {
      src,
      autoPlay: isActive,
      loop: true,
      muted: true,
      playsInline: true,
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
  onLike,
  onOpenComments,
  onOrder,
  onLocation,
  onView,
}: {
  reel: Reel;
  isActive: boolean;
  onLike: () => void;
  onOpenComments: () => void;
  onOrder: () => void;
  onLocation: () => void;
  onView: () => void;
}) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const viewedRef = useRef(false);

  useEffect(() => {
    if (isActive && !viewedRef.current) {
      viewedRef.current = true;
      onView();
    }
  }, [isActive, onView]);

  return (
    <View style={[styles.card, { height: VIDEO_HEIGHT }]}>
      <View style={styles.videoLayer}>
        <ReelVideo src={reel.videoUrl} isActive={isActive} />
        <View style={styles.scrim} />
      </View>

      {/* Right rail (like / comments / order / location) */}
      <View style={[styles.rightRail, { bottom: bottomPadding + 110 }]}>
        <TouchableOpacity onPress={onLike} style={styles.railBtn} activeOpacity={0.7}>
          <Ionicons
            name={reel.likedByMe ? "heart" : "heart-outline"}
            size={36}
            color={reel.likedByMe ? "#FF1744" : "#fff"}
          />
          <Text style={styles.railNum}>{formatNumber(reel.likes)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenComments} style={styles.railBtn} activeOpacity={0.7}>
          <Feather name="message-circle" size={32} color="#fff" />
          <Text style={styles.railNum}>{formatNumber(reel.comments)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOrder} style={styles.railIconBtn} activeOpacity={0.7}>
          <Feather name="shopping-bag" size={22} color="#000" />
          <Text style={styles.railIconLabel}>اطلب</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLocation} style={styles.railIconBtnAlt} activeOpacity={0.7}>
          <Feather name="map-pin" size={22} color={PRIMARY} />
          <Text style={[styles.railIconLabel, { color: PRIMARY }]}>الموقع</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom info */}
      <View style={[styles.bottomInfo, { paddingBottom: bottomPadding + 16 }]}>
        <View style={styles.cafeRow}>
          <View style={styles.cafeLogoBubble}>
            <Text style={{ color: PRIMARY, fontWeight: "700" }}>
              {reel.cafeName?.[0] ?? "C"}
            </Text>
          </View>
          <Text style={styles.cafeName} numberOfLines={1}>{reel.cafeName}</Text>
        </View>
        <Text style={styles.description} numberOfLines={3}>{reel.description}</Text>
      </View>

      {/* Tiny views chip — bottom-left */}
      <View style={[styles.viewsChip, { bottom: bottomPadding + 16 }]}>
        <Feather name="eye" size={12} color="#fff" />
        <Text style={styles.viewsChipText}>{formatNumber(reel.views)}</Text>
      </View>
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
  const [commentsOpenFor, setCommentsOpenFor] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

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

  const openComments = useCallback(async (reel: Reel) => {
    setCommentsOpenFor(reel);
    setCommentsLoading(true);
    try {
      const r = await apiFetch<{ comments: Comment[] }>(`/reels/${reel.id}/comments`);
      setComments(r.comments ?? []);
    } catch { setComments([]); }
    setCommentsLoading(false);
  }, []);

  const submitComment = useCallback(async () => {
    if (!commentsOpenFor || !commentDraft.trim()) return;
    const text = commentDraft.trim();
    setCommentDraft("");
    try {
      const r = await apiPost<{ comment: Comment }>(`/reels/${commentsOpenFor.id}/comments`, {
        userId, userName, text,
      });
      setComments((prev) => [r.comment, ...prev]);
      setReels((prev) => prev.map((x) =>
        x.id === commentsOpenFor.id ? { ...x, comments: x.comments + 1 } : x,
      ));
    } catch { /* ignore */ }
  }, [commentDraft, commentsOpenFor, userId, userName]);

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
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={VIDEO_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            isActive={index === activeIndex}
            onLike={() => handleLike(item)}
            onOpenComments={() => openComments(item)}
            onOrder={() => handleOrder(item)}
            onLocation={() => handleLocation(item)}
            onView={() => handleView(item.id)}
          />
        )}
      />

      {/* Comments modal */}
      <Modal
        visible={!!commentsOpenFor}
        animationType="slide"
        transparent
        onRequestClose={() => setCommentsOpenFor(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCommentsOpenFor(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{ flex: 1 }}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>التعليقات</Text>
                <TouchableOpacity onPress={() => setCommentsOpenFor(null)}>
                  <Feather name="x" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              {commentsLoading ? (
                <ActivityIndicator color={PRIMARY} style={{ marginTop: 24 }} />
              ) : comments.length === 0 ? (
                <Text style={styles.modalEmpty}>كن أول من يعلق</Text>
              ) : (
                <FlatList
                  data={comments}
                  keyExtractor={(c) => c.id}
                  contentContainerStyle={{ padding: 12 }}
                  renderItem={({ item }) => (
                    <View style={styles.commentRow}>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentName}>{item.userName}</Text>
                        <Text style={styles.commentText}>{item.text}</Text>
                      </View>
                    </View>
                  )}
                />
              )}
              <View style={styles.commentInputBar}>
                <TextInput
                  value={commentDraft}
                  onChangeText={setCommentDraft}
                  placeholder="اكتب تعليقاً…"
                  placeholderTextColor="#666"
                  style={styles.commentInput}
                  onSubmitEditing={submitComment}
                />
                <TouchableOpacity onPress={submitComment} style={styles.sendBtn}>
                  <Feather name="send" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", backgroundColor: "#000", position: "relative" },
  videoLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  rightRail: { position: "absolute", right: 12, alignItems: "center", gap: 18 },
  railBtn: { alignItems: "center", marginBottom: 16 },
  railNum: { color: "#fff", fontSize: 12, marginTop: 4, fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 3 },
  railIconBtn: {
    alignItems: "center", justifyContent: "center", marginBottom: 12,
    width: 50, height: 50, borderRadius: 25, backgroundColor: PRIMARY,
  },
  railIconBtnAlt: {
    alignItems: "center", justifyContent: "center", marginBottom: 12,
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: "rgba(0,0,0,0.45)",
  },
  railIconLabel: { color: "#000", fontSize: 9, fontWeight: "700", marginTop: 1 },
  viewsChip: {
    position: "absolute", left: 12, flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  viewsChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  bottomInfo: { position: "absolute", left: 0, right: 80, bottom: 0, padding: 16 },
  cafeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cafeLogoBubble: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#0A0606",
    borderWidth: 2, borderColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  cafeName: { color: "#fff", fontWeight: "700", fontSize: 15, flexShrink: 1 },
  description: { color: "#fff", fontSize: 14, lineHeight: 20, marginBottom: 12, opacity: 0.95 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyHint: { color: "#888", marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "rgba(0,0,0,0.55)", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    height: "65%", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as any) : {}),
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalEmpty: { color: "#aaa", textAlign: "center", marginTop: 32 },
  commentRow: { flexDirection: "row", marginBottom: 10 },
  commentBubble: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, padding: 10 },
  commentName: { color: PRIMARY, fontWeight: "700", fontSize: 13, marginBottom: 2 },
  commentText: { color: "#fff", fontSize: 14, lineHeight: 19 },
  commentInputBar: {
    flexDirection: "row", padding: 10, gap: 8,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  commentInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 22, paddingHorizontal: 16,
    paddingVertical: 10, color: "#fff", textAlign: "right",
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
});

// Avoid unused-import warning on web-only API_BASE.
void API_BASE;
