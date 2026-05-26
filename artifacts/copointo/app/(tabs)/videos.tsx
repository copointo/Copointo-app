import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
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
import { useResponsive } from "@/hooks/useResponsive";
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

// On web, the bottom tab bar is `position:"absolute"` and floats over the
// screen content, so a FlatList that "fills" the tabs layout actually
// reports the FULL window height in `onLayout` — NOT the visible region
// above the tab bar. That mismatch caused snap to skip past the visible
// page boundary, so the bottom of one reel bled into the top of the next.
// Fix: compute the effective page height as window.height minus the same
// `tabBarHeight` value the tab bar itself uses (from `useResponsive`).
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const FALLBACK_VIDEO_HEIGHT = Platform.OS === "web" ? SCREEN_HEIGHT - 84 : SCREEN_HEIGHT;

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
function ReelVideo({ src, isActive, muted, paused }: { src: string; isActive: boolean; muted: boolean; paused: boolean }) {
  const videoRef = useRef<any>(null);
  // Loading state shows a spinner overlay until the browser has enough
  // data to actually start playing the reel. Without it, slow networks
  // leave the user staring at a black frame, looking like the app froze.
  const [loading, setLoading] = useState(true);

  // Imperatively sync the muted property so the user can unmute mid-playback
  // without React tearing down the <video> element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    if (isActive && !paused) {
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => { /* autoplay may be blocked when unmuted */ });
    } else {
      // Pausing on the inactive reels (and especially when the user leaves
      // the Videos tab) is critical so audio doesn't keep playing in the
      // background. Also pauses when the user taps to pause the active reel.
      try { el.pause?.(); } catch { /* ignore */ }
    }
  }, [muted, isActive, paused]);

  // Reset loading state whenever the underlying clip changes.
  useEffect(() => { setLoading(true); }, [src]);

  if (Platform.OS === "web") {
    // Relative API paths (e.g. "/api/reels/123/video") must be resolved
    // against the API origin — the Expo web app is served from a different
    // host than api-server, so a bare relative URL would 404 (black screen).
    const resolved = /^https?:\/\//i.test(src) || src.startsWith("data:")
      ? src
      : `${API_BASE}${src.replace(/^\/api/, "")}`;
    const video = React.createElement("video" as any, {
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
      // Buffering lifecycle: `waiting`/`loadstart` → spinner on,
      // `playing`/`canplay`/`loadeddata` → spinner off.
      onLoadStart: () => setLoading(true),
      onWaiting:   () => setLoading(true),
      onLoadedData:() => setLoading(false),
      onCanPlay:   () => setLoading(false),
      onPlaying:   () => setLoading(false),
      onError:     () => setLoading(false),
      style: {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        backgroundColor: "#000",
      },
    });
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {video}
        {loading && isActive && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        )}
      </View>
    );
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
  onOpenComments,
  onOrder,
  onLocation,
  onView,
  videoHeight,
}: {
  reel: Reel;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onOrder: () => void;
  onLocation: () => void;
  onView: () => void;
  videoHeight: number;
}) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;
  const viewedRef = useRef(false);
  // Description is now hidden by default; user opens it via the
  // "اقرأ التفاصيل" button that sits just above the views chip.
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Tap-to-pause: tapping anywhere on the video toggles play/pause for the
  // active reel. We reset this whenever the reel becomes inactive so the
  // next time the user scrolls back, playback resumes automatically.
  const [paused, setPaused] = useState(false);
  useEffect(() => { if (!isActive) setPaused(false); }, [isActive]);

  useEffect(() => {
    if (isActive && !viewedRef.current) {
      viewedRef.current = true;
      onView();
    }
  }, [isActive, onView]);

  return (
    <View style={[styles.card, { height: videoHeight }]}>
      <Pressable
        style={styles.videoLayer}
        onPress={() => setPaused(p => !p)}
      >
        <ReelVideo src={reel.videoUrl} isActive={isActive} muted={muted} paused={paused} />
        <View style={styles.scrim} pointerEvents="none" />
        {paused && isActive && (
          <View style={styles.pausedOverlay} pointerEvents="none">
            <View style={styles.pausedIconBubble}>
              <Feather name="play" size={42} color="#fff" />
            </View>
          </View>
        )}
      </Pressable>

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

      {/* Bottom info — cafe + "Read details" button + views chip stacked left */}
      <View style={[styles.bottomInfo, { paddingBottom: bottomPadding + 12 }]}>
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
        <View style={styles.bottomRow}>
          <TouchableOpacity
            onPress={onToggleMute}
            style={styles.muteBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name={muted ? "volume-x" : "volume-2"} size={14} color="#fff" />
          </TouchableOpacity>
          <View style={styles.viewsChip}>
            <Feather name="eye" size={12} color="#fff" />
            <Text style={styles.viewsChipText}>{formatNumber(reel.views)}</Text>
          </View>
        </View>
      </View>

      {/* Details overlay — shown only after the user taps "اقرأ التفاصيل". */}
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
  const r = useResponsive();
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
  const [commentsOpenFor, setCommentsOpenFor] = useState<Reel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const [anonId, setAnonId] = useState<string>("");
  useEffect(() => { getAnonId().then(setAnonId); }, []);
  // Prefer id (stable, matches showcase user id "copointo-showcase-user")
  // over phone so the server can correctly identify the viewer for
  // showcase-only reel filtering.
  const userId = currentUser?.id ?? currentUser?.phone ?? anonId;
  const userName = currentUser?.gameUsername ?? currentUser?.name ?? "ضيف";

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await apiFetch<{ reels: Reel[] }>(`/reels?userId=${encodeURIComponent(userId)}`);
      // Split the feed into "new" (uploaded in the last 7 days) and "older"
      // buckets, then shuffle each bucket independently (Fisher–Yates) and
      // concatenate new-first. This gives new reels priority at the top of
      // every visit while still keeping the order fresh on each entry to
      // the screen — returning visitors don't see the same first clip twice.
      const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const all = r.reels ?? [];
      const fresh: Reel[] = [];
      const older: Reel[] = [];
      for (const x of all) {
        const t = Date.parse(x.createdAt);
        if (Number.isFinite(t) && now - t <= NEW_WINDOW_MS) fresh.push(x);
        else older.push(x);
      }
      const shuffle = (arr: Reel[]) => {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      };
      setReels([...shuffle(fresh), ...shuffle(older)]);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  // Instagram-style: tapping the Videos tab a second time (while it's the
  // currently focused tab) refreshes the feed and snaps back to the top.
  // This re-runs `load()` so a fresh shuffle + any newly-uploaded reels
  // appear instantly without the user having to leave and come back.
  const navigation = useNavigation();
  useEffect(() => {
    const parent = navigation.getParent?.();
    if (!parent) return;
    const unsub = parent.addListener("tabPress" as any, () => {
      // Only react when the user is already on the Videos tab — otherwise
      // this is just a normal tab switch and the focus effect handles it.
      const isFocused = (navigation as any).isFocused?.();
      if (!isFocused) return;
      try { listRef.current?.scrollToOffset({ offset: 0, animated: true }); } catch { /* ignore */ }
      setActiveIndex(0);
      load();
    });
    return unsub;
  }, [navigation, load]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first && typeof first.index === "number") setActiveIndex(first.index);
  }).current;

  // On web (mouse wheel + trackpad), react-native-web's FlatList does not
  // snap reliably between pages — wheel scroll either does nothing or stops
  // mid-reel. We intercept wheel events and snap to the next/previous reel.
  const listRef = useRef<FlatList<Reel> | null>(null);
  const wheelLockRef = useRef(false);
  // Effective per-reel page height = window height − floating tab bar height
  // (web only — on native the tab bar takes its own space so the wrapper's
  // onLayout already reports the correct value). We seed with a sensible
  // estimate, then refine from the wrapper's onLayout AFTER subtracting the
  // tab bar so the snap interval always matches what the user can actually
  // see between the top of the screen and the top of the tab bar.
  const tabBarH = Platform.OS === "web" ? r.tabBarHeight : 0;
  const [videoHeight, setVideoHeight] = useState(
    Math.max(200, (Platform.OS === "web" ? r.height : SCREEN_HEIGHT) - tabBarH),
  );
  // Whenever the responsive tab-bar height changes (resize / breakpoint),
  // recompute the video height from the latest window size so existing reels
  // re-snap to the new viewport height.
  useEffect(() => {
    const next = Math.max(200, (Platform.OS === "web" ? r.height : SCREEN_HEIGHT) - tabBarH);
    setVideoHeight(next);
  }, [r.height, tabBarH]);
  // When videoHeight changes (initial layout, window resize), realign the
  // currently active reel so we don't get stuck between two pages.
  useEffect(() => {
    const t = setTimeout(() => {
      try { listRef.current?.scrollToOffset({ offset: activeIndex * videoHeight, animated: false }); } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, [videoHeight, activeIndex]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 10) return;
      if (wheelLockRef.current) { e.preventDefault(); return; }
      const dir = e.deltaY > 0 ? 1 : -1;
      const next = Math.min(reels.length - 1, Math.max(0, activeIndex + dir));
      if (next === activeIndex) return;
      e.preventDefault();
      wheelLockRef.current = true;
      setActiveIndex(next);
      try { listRef.current?.scrollToIndex({ index: next, animated: true }); } catch { /* ignore */ }
      setTimeout(() => { wheelLockRef.current = false; }, 450);
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [activeIndex, reels.length]);

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
    <View
      style={{ height: videoHeight, width: "100%", backgroundColor: "#000", overflow: "hidden" }}
      onLayout={(e) => {
        // The wrapper itself is now sized to videoHeight, so onLayout just
        // confirms it. We also defensively subtract the tab bar height again
        // in case the parent layout doesn't honor the explicit height (older
        // Expo web behaviour) and gives us the full screen instead.
        const measured = Math.round(e.nativeEvent.layout.height);
        const effective = measured > videoHeight + 20 ? measured - tabBarH : measured;
        if (effective > 0 && Math.abs(effective - videoHeight) > 2) setVideoHeight(effective);
      }}
    >
      <FlatList
        ref={listRef}
        data={reels}
        keyExtractor={(r) => r.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={videoHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        decelerationRate="fast"
        // Force a fresh internal scroll state whenever the page height
        // changes so the FlatList recomputes content offsets / snap points
        // from scratch instead of carrying over stale values.
        key={`reels-${videoHeight}`}
        style={{ height: videoHeight }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        getItemLayout={(_, index) => ({ length: videoHeight, offset: videoHeight * index, index })}
        renderItem={({ item, index }) => (
          <ReelCard
            reel={item}
            isActive={index === activeIndex && screenFocused}
            muted={muted || !screenFocused}
            onToggleMute={() => setMuted((m) => !m)}
            onLike={() => handleLike(item)}
            onOpenComments={() => openComments(item)}
            onOrder={() => handleOrder(item)}
            onLocation={() => handleLocation(item)}
            onView={() => handleView(item.id)}
            videoHeight={videoHeight}
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
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  muteBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  viewsChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
  },
  pausedIconBubble: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
  },
  bottomInfo: {
    position: "absolute", left: 0, right: 80, bottom: 0, padding: 16,
    // Force LTR so children pin to the actual left edge of the screen
    // regardless of the app's RTL writing direction. Arabic text inside
    // each <Text> still renders correctly because RN handles bidi per text.
    direction: "ltr",
    alignItems: "flex-start",
  },
  descWrap: { marginBottom: 4 },
  readMore: { color: PRIMARY, fontSize: 13, fontWeight: "700", marginTop: 4 },
  cafeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cafeLogoBubble: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#0A0606",
    borderWidth: 2, borderColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  cafeName: { color: "#fff", fontWeight: "700", fontSize: 15, flexShrink: 1 },
  description: { color: "#fff", fontSize: 14, lineHeight: 20, opacity: 0.95 },
  detailsBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16,
    backgroundColor: PRIMARY, marginBottom: 6,
  },
  detailsBtnText: { color: "#000", fontSize: 12, fontWeight: "800" },
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

