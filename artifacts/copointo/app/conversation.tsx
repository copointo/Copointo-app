import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatMessage, CommunityRole, getCommunityRole } from "@/data/mockData";
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
import { getGift, GiftDef } from "@/data/gifts";
import { useGiftInventory } from "@/hooks/useGiftInventory";

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
  senior: { label: "عضو مميز", color: "#CD7F32", emoji: "🌟" },
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

  const { chats, markRead, appendMsg, markSeen, getGroup, setActiveConv } = useMessages();
  const { getCommunity } = useCommunities();
  const { equipped: equippedTextStyleId } = useTextStyles();
  const equippedTextStyleDef = getTextStyle(equippedTextStyleId);
  const { registeredUsers } = useApp();
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

  const isCafe = type === "cafe";

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

    const giftDef = item.giftId ? getGift(item.giftId) : null;

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
            <MessageBubble
              style={[styles.bubble, styles.meBubble, { borderWidth: 1 }]}
              textStyleDef={equippedTextStyleDef}
              fallbackBg={ME_BG}
              fallbackBorder={PRIMARY}
            >
              {showSenderName && (
                <Text style={styles.senderLabel} numberOfLines={1}>{item.senderName}</Text>
              )}
              <Text style={[styles.bubbleText, { color: equippedTextStyleDef?.textColor ?? "#000" }]}>
                {item.text}
              </Text>
              {item.fromMe && (
                <View style={styles.metaRow}>
                  <Text style={[styles.metaTimeMe, equippedTextStyleDef?.bg && { color: "rgba(255,255,255,0.65)" }]}>{item.time}</Text>
                  <Ticks seen={item.seen} onThemed={!!equippedTextStyleDef?.bg} />
                </View>
              )}
            </MessageBubble>
          ) : (
          <View style={[styles.bubble, styles.themBubble]}>
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
            <Text style={[styles.bubbleText, styles.bubbleTextThem]}>
              {item.text}
            </Text>
            <Text style={[styles.metaTime, { alignSelf: "flex-start", marginTop: 3 }]}>
              {item.time}
            </Text>
          </View>
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
            <Text style={styles.headerName} numberOfLines={1}>
              {isGroup && group ? group.name : name}
            </Text>
            <Text style={styles.headerSub}>
              {isCafe
                ? t("conv.cafeRole")
                : isGroup
                  ? t("conv.groupSubtitle", { n: String(group?.members.length ?? 0) })
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
      ) : (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={styles.giftBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPickerOpen(true); }}
            activeOpacity={0.85}
          >
            <Feather name="gift" size={20} color={PRIMARY} />
          </TouchableOpacity>
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
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={sendMessage}
            activeOpacity={0.85}
            disabled={!text.trim()}
          >
            <Feather name="send" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      )}

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
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: PRIMARY },
  headerSub:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(232,184,109,0.55)" },

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
