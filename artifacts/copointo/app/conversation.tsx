import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  AudioModule, RecordingPresets, useAudioPlayer, useAudioPlayerStatus,
  useAudioRecorder, useAudioRecorderState,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatMessage, CommunityRole, getCommunityRole, getRank } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useT } from "@/context/LanguageContext";
import { useMessages } from "@/context/MessagesContext";
import { useCommunities } from "@/context/CommunityContext";
import { playReceiveMessageSound, playSendMessageSound } from "@/lib/notification-sound";
import MessageBubble from "@/components/MessageBubble";
import { useTextStyles } from "@/hooks/useTextStyles";
import { getTextStyle } from "@/data/textStyles";
import GiftPicker from "@/components/GiftPicker";
import GiftAnimation from "@/components/GiftAnimation";
import ChatMediaContent from "@/components/ChatMediaContent";
import { getGift, GiftDef } from "@/data/gifts";
import { useGiftInventory } from "@/hooks/useGiftInventory";
import { uploadChatMedia } from "@/constants/api";

const BG      = "#000000";
const CARD    = "#0A0606";
const ME_BG   = "#E8B86D";
const THEM_BG = "#0A0606";
const PRIMARY = "#E8B86D";
const BORDER  = "rgba(232,184,109,0.30)";
const BORDER_SOFT = "rgba(232,184,109,0.18)";

const ROLE_BADGE: Record<CommunityRole, { label: string; color: string; emoji: string }> = {
  leader: { label: "قائد", color: "#FFD700", emoji: "👑" },
  vice:   { label: "نائب القائد", color: "#C0C0C0", emoji: "⭐" },
  senior: { label: "عضو كبير", color: "#CD7F32", emoji: "🌟" },
  member: { label: "عضو", color: "rgba(255,255,255,0.55)", emoji: "" },
};

function buildNow(amLabel: string, pmLabel: string): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? pmLabel : amLabel;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

// ─── Tick component: single ✓ = sent, double ✓✓ = seen ────────────────────
function Ticks({ seen, onThemed = false }: { seen: boolean; onThemed?: boolean }) {
  // On amber bubble: dark grey for sent, dark blue for seen so they remain legible.
  // On themed (gradient) bubble: light gray for sent, light blue for seen.
  const sentColor = onThemed ? "rgba(255,255,255,0.65)" : "rgba(0,0,0,0.50)";
  const seenColor = onThemed ? "#7DD3FC" : "#1976D2";
  return (
    <View style={styles.ticksRow}>
      <Text style={[styles.tick, { color: seen ? seenColor : sentColor }]}>✓</Text>
      {seen && <Text style={[styles.tick, { color: seenColor, marginLeft: -5 }]}>✓</Text>}
    </View>
  );
}

export default function ConversationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const { id, name, type } = useLocalSearchParams<{ id: string; name: string; type: string }>();
  // Conversations originating from the super-admin (sender id `copointo-admin`,
  // wrapped as `friend_copointo-admin` on the conv side) are READ-ONLY: the
  // user cannot reply to system / Copointo broadcasts. We hide the input bar
  // entirely for that conv id and show a small note instead.
  const isCopointoAdminConv = id === "friend_copointo-admin";

  const { chats, markRead, appendMsg, markSeen, getGroup, setActiveConv, deleteMessage, tombstoneMessage } = useMessages();
  const { getCommunity } = useCommunities();
  const { equipped: equippedTextStyleId } = useTextStyles();
  const equippedTextStyleDef = getTextStyle(equippedTextStyleId);
  const { registeredUsers, user } = useApp();
  const { t } = useT();
  const convMsgs = chats[id ?? ""] ?? [];

  const isGroup = type === "group";
  // For group conversations, the underlying group id is the convId without the `group_` prefix
  const groupId = isGroup && id?.startsWith("group_") ? id.slice("group_".length) : undefined;
  const group = groupId ? getGroup(groupId) : undefined;
  // If this group is community-bound, look up the community so we can render
  // each sender's role badge under their name.
  const boundCommunity = group?.communityId ? getCommunity(group.communityId) : undefined;
  const isImageAvatar = !!group?.avatar &&
    (group.avatar.startsWith("http") || group.avatar.startsWith("data:") || group.avatar.startsWith("file:"));

  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState("");

  // ─── Gifts ────────────────────────────────────────────────────────
  const { consumeGift } = useGiftInventory();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [animGift, setAnimGift]     = useState<GiftDef | null>(null);
  const [animQty, setAnimQty]       = useState<number>(1);
  const [animFromName, setAnimFromName] = useState<string | undefined>(undefined);

  // The gift animation no longer auto-plays when entering a conversation.
  // The gift bubble in the chat itself is enough; if the user wants to see
  // the full effect again they can tap the bubble explicitly.
  const playedGiftIdsRef = useRef<Set<string>>(new Set());

  const sendGift = async (gift: GiftDef, qty: number) => {
    if (!id) return;
    const ok = await consumeGift(gift.id, qty);
    if (!ok) return;
    setPickerOpen(false);
    const giftMsg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: qty > 1 ? `🎁 ${qty}× ${gift.name}` : `🎁 ${gift.name}`,
      fromMe: true,
      time: buildNow(t("conv.amPm.am"), t("conv.amPm.pm")),
      seen: false,
      giftId: gift.id,
      giftQty: qty,
      recipientName: typeof name === "string" ? name : undefined,
    };
    appendMsg(id, giftMsg);
    // Mark as already played so we don't re-trigger from the convMsgs effect
    playedGiftIdsRef.current.add(giftMsg.id);
    // No immediate preview — the rain animation appears on the Levels page.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    playSendMessageSound();
  };

  // Mark conversation as read + scroll to bottom on open. Also register
  // this convId as "active" so the global poll loop won't bump the unread
  // badge for messages that arrive while the screen is on top — instead
  // it auto-tells the server we've seen them so ✓✓ flips on the sender.
  useEffect(() => {
    if (!id) return;
    markRead(id);
    setActiveConv(id);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
    return () => { setActiveConv(null); };
  }, [id]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [convMsgs.length]);

  // Play a soft chime when a new incoming (not-from-me) message appears.
  // Skips the initial mount so existing history doesn't trigger on open.
  const prevTheirCountRef = useRef<number | null>(null);
  useEffect(() => {
    const theirCount = convMsgs.filter(m => !m.fromMe).length;
    if (prevTheirCountRef.current !== null && theirCount > prevTheirCountRef.current) {
      playReceiveMessageSound();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    prevTheirCountRef.current = theirCount;
  }, [convMsgs]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSendMessageSound();
    // Globally-unique id (sender + ms + random) so two devices can never
    // collide and the server's `id`-based dedupe stays safe.
    const newMsg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      fromMe: true,
      time: buildNow(t("conv.amPm.am"), t("conv.amPm.pm")),
      seen: false,
    };
    appendMsg(id, newMsg);
    setText("");
    // ✓✓ ticks now flip via the real server "seen" sync — no fake delay.
  };

  // ─── Media attachments (images / videos / voice notes) ───────────────────
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading]   = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);
  const recStartRef = useRef<number>(0);
  // Live timer (seconds) shown while recording so the user can see how
  // long the voice note has been going. Stops at cancel/stop.
  const [recElapsed, setRecElapsed] = useState(0);
  useEffect(() => {
    if (!recState.isRecording) { setRecElapsed(0); return; }
    setRecElapsed(Math.max(0, Math.round((Date.now() - recStartRef.current) / 1000)));
    const t = setInterval(() => {
      setRecElapsed(Math.max(0, Math.round((Date.now() - recStartRef.current) / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [recState.isRecording]);

  // Pre-send preview: pickers and the recorder no longer auto-upload —
  // they stage the media into `pendingMedia` so the user can review it
  // (see the image, replay the voice note, scrub the video) and either
  // confirm send or cancel. Only on confirm do we upload and append.
  type PendingMedia = {
    kind: "image" | "video" | "audio";
    uri: string;
    mime: string;
    filename: string;
    duration?: number;
  };
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const previewVideoPlayer = useVideoPlayer(
    pendingMedia?.kind === "video" ? pendingMedia.uri : "",
    (p) => { p.loop = false; },
  );
  const previewAudioPlayer = useAudioPlayer(
    pendingMedia?.kind === "audio" ? pendingMedia.uri : "",
  );
  const previewAudioStatus = useAudioPlayerStatus(previewAudioPlayer);
  const previewAudioPlaying = !!previewAudioStatus?.playing;
  const previewAudioCurrent = previewAudioStatus?.currentTime ?? 0;
  const previewAudioTotal = pendingMedia?.duration && pendingMedia.duration > 0
    ? pendingMedia.duration
    : (previewAudioStatus?.duration ?? 0);
  const togglePreviewAudio = () => {
    if (!pendingMedia || pendingMedia.kind !== "audio") return;
    if (previewAudioPlaying) { previewAudioPlayer.pause(); return; }
    if (previewAudioTotal > 0 && previewAudioCurrent >= previewAudioTotal - 0.25) {
      try { previewAudioPlayer.seekTo(0); } catch { /* ignore */ }
    }
    previewAudioPlayer.play();
  };
  const fmtPreviewTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, "0")}`;
  };
  // If the user swipes back / navigates away while the preview modal is
  // open, pause both preview players so audio/video don't keep playing
  // in the background. Discard/Confirm pause inline too — this is the
  // safety net for navigation paths.
  useEffect(() => {
    return () => {
      try { previewAudioPlayer.pause(); } catch {}
      try { previewVideoPlayer.pause(); } catch {}
    };
  }, []);

  const discardPending = () => {
    if (pendingMedia?.kind === "audio") { try { previewAudioPlayer.pause(); } catch {} }
    if (pendingMedia?.kind === "video") { try { previewVideoPlayer.pause(); } catch {} }
    setPendingMedia(null);
  };
  const confirmSendPending = async () => {
    if (!pendingMedia) return;
    const pm = pendingMedia;
    if (pm.kind === "audio") { try { previewAudioPlayer.pause(); } catch {} }
    if (pm.kind === "video") { try { previewVideoPlayer.pause(); } catch {} }
    setPendingMedia(null);
    setUploading(true);
    try {
      const url = await uploadChatMedia(pm.uri, pm.mime, pm.filename, pm.kind);
      const extra: Partial<ChatMessage> =
          pm.kind === "image" ? { imageUrl: url }
        : pm.kind === "video" ? { videoUrl: url, mediaDuration: pm.duration }
        : { audioUrl: url, mediaDuration: pm.duration };
      sendMediaMessage(extra);
    } catch (err: any) {
      Alert.alert("فشل الإرسال", err?.message || "تعذر إرسال المرفق");
    } finally {
      setUploading(false);
    }
  };

  /** Build a ChatMessage shell and POST it through appendMsg. */
  const sendMediaMessage = (extra: Partial<ChatMessage>) => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSendMessageSound();
    const msg: ChatMessage = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: "",
      fromMe: true,
      time: buildNow(t("conv.amPm.am"), t("conv.amPm.pm")),
      seen: false,
      ...extra,
    };
    appendMsg(id, msg);
  };

  const pickAndSend = async (kind: "image" | "video") => {
    setAttachOpen(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("الإذن مطلوب", "نحتاج الوصول إلى المعرض لإرسال المرفقات");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: kind === "image"
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
        quality: kind === "image" ? 0.85 : 1,
        videoMaxDuration: 120,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const ext = (asset.uri.match(/\.([a-zA-Z0-9]+)(\?|$)/)?.[1] || (kind === "image" ? "jpg" : "mp4")).toLowerCase();
      const mime = asset.mimeType
        || (kind === "image" ? `image/${ext === "jpg" ? "jpeg" : ext}` : `video/${ext}`);
      const filename = `${kind}_${Date.now()}.${ext}`;
      // Stage into preview — user reviews then taps "Send" to actually upload.
      setPendingMedia({
        kind,
        uri: asset.uri,
        mime,
        filename,
        duration: kind === "video" && asset.duration
          ? Math.round(asset.duration / 1000) : undefined,
      });
    } catch (err: any) {
      Alert.alert("فشل اختيار المرفق", err?.message || "تعذر تحميل الملف");
    }
  };

  const startRecording = async () => {
    setAttachOpen(false);
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("الإذن مطلوب", "نحتاج إذن الميكروفون لتسجيل الرسائل الصوتية");
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recStartRef.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err: any) {
      Alert.alert("فشل التسجيل", err?.message || "تعذر بدء التسجيل");
    }
  };

  const stopRecordingAndSend = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const seconds = Math.max(1, Math.round((Date.now() - recStartRef.current) / 1000));
      if (!uri) {
        Alert.alert("لا يوجد تسجيل", "لم يتم حفظ التسجيل");
        return;
      }
      const ext = (uri.match(/\.([a-zA-Z0-9]+)(\?|$)/)?.[1] || "m4a").toLowerCase();
      const mime = ext === "m4a" || ext === "mp4" ? "audio/mp4"
        : ext === "wav" ? "audio/wav"
        : ext === "caf" ? "audio/x-caf"
        : `audio/${ext}`;
      // Stage into preview — user listens back then taps "Send" to upload.
      setPendingMedia({
        kind: "audio",
        uri,
        mime,
        filename: `voice_${Date.now()}.${ext}`,
        duration: seconds,
      });
    } catch (err: any) {
      Alert.alert("فشل التسجيل", err?.message || "تعذر إنهاء التسجيل");
    }
  };

  const cancelRecording = async () => {
    try { await recorder.stop(); } catch { /* ignore */ }
  };

  const isCafe = type === "cafe";

  // Long-press on a bubble → confirm delete. The bubble is replaced by a
  // "🚫 تم حذف الرسالة" placeholder in the same spot. For my own messages
  // we propagate the deletion to everyone via the server; for someone
  // else's message we tombstone it locally only. Read-only Copointo
  // broadcasts have no delete UI. Already-deleted bubbles are skipped.
  const onBubbleLongPress = (item: ChatMessage) => {
    if (isCopointoAdminConv || !id) return;
    if (item.deletedForAll) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const doDelete = () => {
      if (item.fromMe) {
        deleteMessage(id, item.id, "forEveryone");
      } else {
        tombstoneMessage(id, item.id);
      }
    };
    // Alert.alert is unreliable on react-native-web — fall back to window.confirm
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const ok = window.confirm("حذف الرسالة؟ سيتم استبدالها بـ \"تم حذف هذه الرسالة\" في نفس المكان.");
      if (ok) doDelete();
      return;
    }
    Alert.alert(
      "حذف الرسالة؟",
      "سيتم استبدال الرسالة بـ \"تم حذف هذه الرسالة\" في نفس المكان.",
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: doDelete },
      ],
    );
  };

  /** Resolve the sender chip (name + avatar + rank) for a media message.
   *  Falls back to the conv header name when the friend isn't in the
   *  registeredUsers list (e.g. mock 1:1 chats). */
  const getMediaSenderInfo = (item: ChatMessage): {
    name: string; avatar?: string; level: number;
  } => {
    if (item.fromMe) {
      return {
        name: user?.name || "أنت",
        avatar: user?.avatar,
        level: user?.level ?? 0,
      };
    }
    const r = item.senderId ? registeredUsers.find(u => u.id === item.senderId) : undefined;
    return {
      name: r?.name || item.senderName || (typeof name === "string" ? name : ""),
      avatar: r?.avatar || item.senderAvatar,
      level: r?.level ?? 0,
    };
  };

  /** Compact "who sent this" chip rendered ABOVE images / videos / voice
   *  notes so the recipient can see at-a-glance the sender's name, photo
   *  and rank without scrolling back up the conversation. */
  const renderMediaSenderChip = (item: ChatMessage) => {
    if (item.deletedForAll) return null;
    if (!item.imageUrl && !item.videoUrl && !item.audioUrl) return null;
    const s = getMediaSenderInfo(item);
    const rank = getRank(s.level);
    const isAvatarUri = !!s.avatar && (
      s.avatar.startsWith("http") || s.avatar.startsWith("data:") || s.avatar.startsWith("file:")
    );
    const nameColor = item.fromMe ? "rgba(0,0,0,0.85)" : PRIMARY;
    const subColor  = item.fromMe ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
    return (
      <View style={styles.mediaSenderChip}>
        {isAvatarUri ? (
          <Image source={{ uri: s.avatar! }} style={styles.mediaSenderAvatarImg} />
        ) : (
          <View style={styles.mediaSenderAvatarFallback}>
            <Text style={{ fontSize: 14 }}>{s.avatar || "👤"}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.mediaSenderName, { color: nameColor }]} numberOfLines={1}>
            {s.name}
          </Text>
          <View style={styles.mediaSenderRankRow}>
            <Text style={styles.mediaSenderRankIcon}>{rank.icon}</Text>
            <Text style={[styles.mediaSenderRankText, { color: rank.color }]} numberOfLines={1}>
              L{s.level} · {rank.name}
            </Text>
            <Text style={[styles.mediaSenderRankSub, { color: subColor }]} numberOfLines={1}>
              {rank.nameEn}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const prevMsg  = convMsgs[index - 1];
    const showTime = !prevMsg || prevMsg.time !== item.time;
    // In a group, only show sender name on the first bubble of a run from that sender
    const isRunStart = !prevMsg || prevMsg.fromMe || prevMsg.senderId !== item.senderId;
    const showSenderName = isGroup && !item.fromMe && isRunStart && !!item.senderName;

    // Sender avatar for this message (group messages may carry their own)
    const senderEmoji = isCafe ? "☕" : isGroup ? "👤" : "👤";
    const senderAvatarUri = item.senderAvatar &&
      (item.senderAvatar.startsWith("http") || item.senderAvatar.startsWith("data:") || item.senderAvatar.startsWith("file:"))
        ? item.senderAvatar : null;

    // Deleted-for-everyone bubbles always render as the placeholder, never
    // as a gift card — even if the original message carried a giftId.
    const giftDef = !item.deletedForAll && item.giftId ? getGift(item.giftId) : null;

    return (
      <View>
        {showTime && (
          <Text style={styles.timeLabel}>{item.time}</Text>
        )}
        <View style={[styles.bubbleRow, item.fromMe && styles.bubbleRowMe]}>
          {/* Their avatar (only first of a run) */}
          {!item.fromMe && isRunStart && (
            senderAvatarUri ? (
              <Image source={{ uri: senderAvatarUri }} style={styles.theirAvatarImg} />
            ) : (
              <View style={styles.theirAvatar}>
                <Text style={{ fontSize: 16 }}>{senderEmoji}</Text>
              </View>
            )
          )}
          {!item.fromMe && !isRunStart && (
            <View style={{ width: 32 }} />
          )}

          {giftDef ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onLongPress={() => onBubbleLongPress(item)}
              delayLongPress={350}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setAnimGift(giftDef);
                setAnimQty(item.giftQty ?? 1);
                setAnimFromName(item.fromMe ? undefined : (item.senderName ?? (typeof name === "string" ? name : undefined)));
              }}
              style={[
                styles.bubble,
                {
                  backgroundColor: `${giftDef.color}22`,
                  borderWidth: 1,
                  borderColor: giftDef.color,
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  minWidth: 140,
                },
              ]}
            >
              <Text style={{ fontSize: 44, lineHeight: 52, textAlign: "center" }}>{giftDef.emoji}</Text>
              <Text style={{
                fontSize: 13, fontFamily: "Inter_700Bold",
                color: giftDef.color, marginTop: 4, textAlign: "center",
              }}>
                {giftDef.name}
              </Text>
              <Text style={{
                fontSize: 10, fontFamily: "Inter_400Regular",
                color: "rgba(255,255,255,0.55)", marginTop: 2,
              }}>
                {item.fromMe ? "هدية أرسلتها · اضغط للإعادة" : "هدية وصلت · اضغط للإعادة"}
              </Text>
              <Text style={[styles.metaTime, { marginTop: 4 }]}>{item.time}</Text>
            </TouchableOpacity>
          ) : item.fromMe ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onLongPress={() => onBubbleLongPress(item)}
              delayLongPress={350}
            >
            <MessageBubble
              style={[styles.bubble, styles.meBubble, { borderWidth: 1 }]}
              textStyleDef={item.deletedForAll ? undefined : equippedTextStyleDef}
              fallbackBg={ME_BG}
              fallbackBorder={PRIMARY}
            >
              {showSenderName && (
                <Text style={styles.senderLabel} numberOfLines={1}>{item.senderName}</Text>
              )}
              {renderMediaSenderChip(item)}
              {!item.deletedForAll && <ChatMediaContent message={item} onThemed />}
              {!!item.text && (
                <Text style={[
                  styles.bubbleText,
                  { color: item.deletedForAll ? "rgba(0,0,0,0.55)" : (equippedTextStyleDef?.textColor ?? "#000") },
                  item.deletedForAll && { fontStyle: "italic" },
                ]}>
                  {item.text}
                </Text>
              )}
              {item.fromMe && (
                <View style={styles.metaRow}>
                  <Text style={[styles.metaTimeMe, equippedTextStyleDef?.bg && !item.deletedForAll && { color: "rgba(255,255,255,0.65)" }]}>{item.time}</Text>
                  {!item.deletedForAll && (
                    <Ticks seen={item.seen} onThemed={!!equippedTextStyleDef?.bg} />
                  )}
                </View>
              )}
            </MessageBubble>
            </TouchableOpacity>
          ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => onBubbleLongPress(item)}
            delayLongPress={350}
            style={[styles.bubble, styles.themBubble]}
          >
            {showSenderName && (() => {
              const role = boundCommunity && item.senderId
                ? getCommunityRole(boundCommunity, item.senderId)
                : null;
              const badge = role ? ROLE_BADGE[role] : null;
              return (
                <View style={styles.senderRow}>
                  <Text style={styles.senderLabel} numberOfLines={1}>{item.senderName}</Text>
                  {badge && (badge.emoji || badge.label) && (
                    <View style={[styles.roleBadge, { borderColor: badge.color, backgroundColor: badge.color + "1F" }]}>
                      {!!badge.emoji && (
                        <Text style={styles.roleBadgeEmoji}>{badge.emoji}</Text>
                      )}
                      <Text style={[styles.roleBadgeText, { color: badge.color }]} numberOfLines={1}>
                        {badge.label}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}
            {renderMediaSenderChip(item)}
            {!item.deletedForAll && <ChatMediaContent message={item} />}
            {!!item.text && (
              <Text style={[
                styles.bubbleText,
                styles.bubbleTextThem,
                item.deletedForAll && { color: "rgba(255,255,255,0.55)", fontStyle: "italic" },
              ]}>
                {item.text}
              </Text>
            )}
            <Text style={[styles.metaTime, { alignSelf: "flex-start", marginTop: 3 }]}>
              {item.time}
            </Text>
          </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color={PRIMARY} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerInfo}
          onPress={() => {
            if (isGroup && groupId) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/group-info?id=${groupId}`);
            }
          }}
          activeOpacity={isGroup ? 0.7 : 1}
          disabled={!isGroup}
        >
          {isGroup && isImageAvatar ? (
            <Image source={{ uri: group!.avatar! }} style={styles.headerAvatarImg} />
          ) : (
            <View style={[styles.headerAvatar, isGroup && { backgroundColor: PRIMARY + "22" }]}>
              <Text style={{ fontSize: 18 }}>{isCafe ? "☕" : isGroup ? "👥" : "👤"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {isGroup && group ? group.name : name}
              </Text>
              {/* In-conversation "مجتمع" tag intentionally removed — the
                  chat list (messages tab) now shows a clear "مجتمع · N
                  أعضاء" badge so the user knows it's a community before
                  they even open the chat. Keeping the subtitle below
                  (member count + bound community name) is enough context
                  once you're inside. */}
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isCafe
                ? t("conv.cafeRole")
                : isGroup
                  ? (boundCommunity
                      ? `🏛️ ${boundCommunity.name} · 👥 ${group?.members.length ?? 0} أعضاء`
                      : t("conv.groupSubtitle", { n: String(group?.members.length ?? 0) }))
                  : t("conv.friendRole")}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Messages list */}
      <FlatList
        ref={listRef}
        data={convMsgs}
        keyExtractor={(item, i) => `${item.id}-${i}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Input bar — hidden entirely for Copointo broadcast conv (read-only) */}
      {isCopointoAdminConv ? (
        <View style={[styles.readOnlyBar, { paddingBottom: insets.bottom + 10 }]}>
          <Feather name="lock" size={14} color="rgba(232,184,109,0.65)" />
          <Text style={styles.readOnlyText}>
            لا يمكن الرد على رسائل Copointo
          </Text>
        </View>
      ) : recState.isRecording ? (
        // Compact recording bar — replaces the normal input while recording.
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[styles.giftBtn, { borderColor: "#EF4444" }]}
            onPress={cancelRecording}
            activeOpacity={0.85}
          >
            <Feather name="x" size={20} color="#EF4444" />
          </TouchableOpacity>
          <View style={styles.recordingBar}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>جاري التسجيل…</Text>
            <Text style={styles.recordingTimer}>{fmtPreviewTime(recElapsed)}</Text>
          </View>
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={stopRecordingAndSend}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          {/* Attach (photo/video/voice) — available in both 1:1 and group chats. */}
          <TouchableOpacity
            style={styles.giftBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAttachOpen(true); }}
            activeOpacity={0.85}
            disabled={uploading}
          >
            <Feather name={uploading ? "loader" : "paperclip"} size={20} color={PRIMARY} />
          </TouchableOpacity>
          {/* Gifts are 1:1 only — hidden in group chats. */}
          {!isGroup && (
            <TouchableOpacity
              style={styles.giftBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerOpen(true); }}
              activeOpacity={0.85}
            >
              <Feather name="gift" size={20} color={PRIMARY} />
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.inputField}
            value={text}
            onChangeText={setText}
            placeholder={t("conv.inputPlaceholder")}
            placeholderTextColor="rgba(232,184,109,0.40)"
            multiline
            maxLength={500}
            selectionColor={PRIMARY}
            returnKeyType="default"
          />
          {text.trim() ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={sendMessage}
              activeOpacity={0.85}
            >
              <Feather name="send" size={18} color="#000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={startRecording}
              activeOpacity={0.85}
              disabled={uploading}
            >
              <Feather name="mic" size={18} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Attach-type chooser modal */}
      <Modal
        visible={attachOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachOpen(false)}
      >
        <Pressable style={styles.attachBackdrop} onPress={() => setAttachOpen(false)}>
          <Pressable style={styles.attachSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.attachTitle}>إرفاق</Text>
            <View style={styles.attachRow}>
              <TouchableOpacity style={styles.attachItem} onPress={() => pickAndSend("image")} activeOpacity={0.8}>
                <View style={[styles.attachIcon, { backgroundColor: "#3B82F622", borderColor: "#3B82F6" }]}>
                  <Feather name="image" size={22} color="#3B82F6" />
                </View>
                <Text style={styles.attachLabel}>صورة</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachItem} onPress={() => pickAndSend("video")} activeOpacity={0.8}>
                <View style={[styles.attachIcon, { backgroundColor: "#A855F722", borderColor: "#A855F7" }]}>
                  <Feather name="video" size={22} color="#A855F7" />
                </View>
                <Text style={styles.attachLabel}>فيديو</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachItem} onPress={startRecording} activeOpacity={0.8}>
                <View style={[styles.attachIcon, { backgroundColor: "#22C55E22", borderColor: "#22C55E" }]}>
                  <Feather name="mic" size={22} color="#22C55E" />
                </View>
                <Text style={styles.attachLabel}>تسجيل صوتي</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Pre-send preview — image/video/voice all share this sheet so the
          user can review (and listen / watch) before tapping إرسال. */}
      <Modal
        visible={!!pendingMedia}
        transparent
        animationType="fade"
        onRequestClose={discardPending}
      >
        <View style={styles.previewBackdrop}>
          <View style={styles.previewSheet}>
            <Text style={styles.previewTitle}>
              {pendingMedia?.kind === "image" ? "معاينة الصورة"
                : pendingMedia?.kind === "video" ? "معاينة الفيديو"
                : "معاينة التسجيل الصوتي"}
            </Text>

            {pendingMedia?.kind === "image" && (
              <Image
                source={{ uri: pendingMedia.uri }}
                style={styles.previewImage}
                resizeMode="contain"
              />
            )}
            {pendingMedia?.kind === "video" && (
              <View style={styles.previewVideoWrap}>
                <VideoView
                  player={previewVideoPlayer}
                  style={styles.previewVideo}
                  nativeControls
                  contentFit="contain"
                  allowsFullscreen
                />
              </View>
            )}
            {pendingMedia?.kind === "audio" && (
              <View style={styles.previewAudioBox}>
                <TouchableOpacity
                  onPress={togglePreviewAudio}
                  activeOpacity={0.85}
                  style={styles.previewAudioBtn}
                >
                  <Feather name={previewAudioPlaying ? "pause" : "play"} size={26} color="#000" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={styles.previewAudioTrack}>
                    <View style={[
                      styles.previewAudioFill,
                      { width: `${previewAudioTotal > 0
                          ? Math.min(100, (previewAudioCurrent / previewAudioTotal) * 100)
                          : 0}%` },
                    ]} />
                  </View>
                  <Text style={styles.previewAudioTime}>
                    {fmtPreviewTime(previewAudioCurrent)} / {fmtPreviewTime(previewAudioTotal)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnCancel]}
                onPress={discardPending}
                activeOpacity={0.85}
                disabled={uploading}
              >
                <Feather name="x" size={18} color="#EF4444" />
                <Text style={[styles.previewBtnText, { color: "#EF4444" }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.previewBtn, styles.previewBtnSend]}
                onPress={confirmSendPending}
                activeOpacity={0.85}
                disabled={uploading}
              >
                <Feather name="send" size={18} color="#000" />
                <Text style={[styles.previewBtnText, { color: "#000" }]}>إرسال</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GiftPicker
        visible={pickerOpen && !isCopointoAdminConv}
        toName={typeof name === "string" ? name : undefined}
        onClose={() => setPickerOpen(false)}
        onSend={sendGift}
      />
      <GiftAnimation
        gift={animGift}
        count={animQty}
        fromName={animFromName}
        visible={!!animGift}
        onDone={() => setAnimGift(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  headerInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarImg: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: PRIMARY,
  },
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY, flexShrink: 1 },
  headerSub:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.55)" },
  groupBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: PRIMARY + "22",
    borderWidth: 1, borderColor: PRIMARY + "55",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  groupBadgeText: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: PRIMARY,
  },

  // Attach modal
  attachBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  attachSheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30,
  },
  attachTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY,
    textAlign: "center", marginBottom: 14,
  },
  attachRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    gap: 12,
  },
  attachItem: { alignItems: "center", gap: 8, flex: 1 },
  attachIcon: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  attachLabel: {
    fontSize: 12, fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.85)",
  },

  // Recording bar
  recordingBar: {
    flex: 1,
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: BORDER_SOFT,
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  recordingDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444",
  },
  recordingText: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: PRIMARY,
    flex: 1,
  },
  recordingTimer: {
    fontSize: 13, fontFamily: "Inter_700Bold", color: "#EF4444",
    fontVariant: ["tabular-nums"],
  },

  // Pre-send preview (image / video / voice note)
  previewBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 16,
  },
  previewSheet: {
    width: "100%", maxWidth: 480,
    backgroundColor: CARD,
    borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    padding: 16, gap: 14,
  },
  previewTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold", color: PRIMARY,
    textAlign: "center",
  },
  previewImage: {
    width: "100%", height: 380,
    backgroundColor: "#000", borderRadius: 12,
  },
  previewVideoWrap: {
    width: "100%", height: 380,
    backgroundColor: "#000", borderRadius: 12, overflow: "hidden",
  },
  previewVideo: { width: "100%", height: "100%" },
  previewAudioBox: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(232,184,109,0.10)",
    borderWidth: 1, borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 18,
  },
  previewAudioBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  previewAudioTrack: {
    height: 6, borderRadius: 3, overflow: "hidden",
    backgroundColor: "rgba(232,184,109,0.20)",
  },
  previewAudioFill: { height: "100%", backgroundColor: PRIMARY, borderRadius: 3 },
  previewAudioTime: {
    fontSize: 12, fontFamily: "Inter_700Bold",
    color: PRIMARY, marginTop: 6, textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  previewActions: {
    flexDirection: "row-reverse", gap: 10,
  },
  previewBtn: {
    flex: 1,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1,
  },
  previewBtnCancel: {
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "#EF4444",
  },
  previewBtnSend: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  previewBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },

  // Sender chip rendered above media bubbles (image / video / voice note)
  mediaSenderChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.15)",
  },
  mediaSenderAvatarImg: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: PRIMARY + "55",
  },
  mediaSenderAvatarFallback: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(232,184,109,0.20)",
    borderWidth: 1, borderColor: PRIMARY + "55",
    alignItems: "center", justifyContent: "center",
  },
  mediaSenderName: {
    fontSize: 12, fontFamily: "Inter_700Bold",
  },
  mediaSenderRankRow: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 1,
  },
  mediaSenderRankIcon: { fontSize: 11 },
  mediaSenderRankText:  { fontSize: 10, fontFamily: "Inter_700Bold" },
  mediaSenderRankSub:   { fontSize: 9,  fontFamily: "Inter_400Regular" },

  // List
  listContent: { paddingHorizontal: 12, paddingVertical: 16, gap: 8 },

  // Time label
  timeLabel: {
    textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(232,184,109,0.40)", marginVertical: 8,
  },

  // Bubbles
  bubbleRow:   { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "85%" },
  bubbleRowMe: { alignSelf: "flex-end", flexDirection: "row-reverse" },

  theirAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER_SOFT,
    alignItems: "center", justifyContent: "center",
  },
  theirAvatarImg: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  senderLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: PRIMARY,
    marginBottom: 3,
    textAlign: "right",
  },
  senderRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
    flexWrap: "wrap",
  },
  roleBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeEmoji: { fontSize: 10 },
  roleBadgeText:  { fontSize: 9, fontFamily: "Inter_700Bold" },

  bubble:      { maxWidth: "100%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  meBubble:    { backgroundColor: ME_BG, borderWidth: 1, borderColor: PRIMARY, borderBottomRightRadius: 4 },
  themBubble:  { backgroundColor: THEM_BG, borderWidth: 1, borderColor: BORDER, borderBottomLeftRadius: 4 },

  bubbleText:     { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTextMe:   { color: "#000" },
  bubbleTextThem: { color: "#F5E6CC" },

  metaRow:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  metaTime:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.45)", alignSelf: "flex-end" },
  metaTimeMe: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(0,0,0,0.55)", alignSelf: "flex-end" },

  // Ticks
  ticksRow: { flexDirection: "row", alignItems: "center" },
  tick:     { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Read-only banner shown for Copointo broadcast conversations.
  readOnlyBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: BG,
  },
  readOnlyText: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    color: "rgba(232,184,109,0.75)",
  },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: BG,
  },
  inputField: {
    flex: 1, backgroundColor: CARD,
    borderRadius: 22, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#F5E6CC",
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY,
    borderWidth: 1, borderColor: PRIMARY,
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "rgba(232,184,109,0.15)",
    borderColor: BORDER,
  },
  giftBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
});
