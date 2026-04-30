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
import { ChatMessage } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useMessages } from "@/context/MessagesContext";

const BG      = "#000000";
const ME_BG   = "#E8B86D";
const THEM_BG = "rgba(232,184,109,0.10)";
const PRIMARY = "#E8B86D";

function now(): string {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

// ─── Tick component: single ✓ = sent, double ✓✓ = seen ────────────────────
function Ticks({ seen }: { seen: boolean }) {
  // On amber bubble: dark grey for sent, dark blue for seen so they remain legible.
  return (
    <View style={styles.ticksRow}>
      <Text style={[styles.tick, { color: seen ? "#1976D2" : "rgba(0,0,0,0.50)" }]}>✓</Text>
      {seen && <Text style={[styles.tick, { color: "#1976D2", marginLeft: -5 }]}>✓</Text>}
    </View>
  );
}

export default function ConversationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const { id, name, type } = useLocalSearchParams<{ id: string; name: string; type: string }>();

  const { chats, markRead, appendMsg, markSeen, getGroup } = useMessages();
  const { registeredUsers } = useApp();
  const convMsgs = chats[id ?? ""] ?? [];

  const isGroup = type === "group";
  // For group conversations, the underlying group id is the convId without the `group_` prefix
  const groupId = isGroup && id?.startsWith("group_") ? id.slice("group_".length) : undefined;
  const group = groupId ? getGroup(groupId) : undefined;
  const isImageAvatar = !!group?.avatar &&
    (group.avatar.startsWith("http") || group.avatar.startsWith("data:") || group.avatar.startsWith("file:"));

  const listRef = useRef<FlatList>(null);
  const [text, setText] = useState("");

  // Mark conversation as read + scroll to bottom on open
  useEffect(() => {
    if (id) markRead(id);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 150);
  }, [id]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, [convMsgs.length]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      text: trimmed,
      fromMe: true,
      time: now(),
      seen: false,
    };
    appendMsg(id, newMsg);
    setText("");

    // Simulate "seen" after 2 s
    setTimeout(() => {
      markSeen(id, newMsg.id);
    }, 2000);
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

          <View style={[styles.bubble, item.fromMe ? styles.meBubble : styles.themBubble]}>
            {showSenderName && (
              <Text style={styles.senderLabel} numberOfLines={1}>{item.senderName}</Text>
            )}
            <Text style={[styles.bubbleText, item.fromMe ? styles.bubbleTextMe : styles.bubbleTextThem]}>
              {item.text}
            </Text>
            {/* Timestamp + ticks for my messages */}
            {item.fromMe && (
              <View style={styles.metaRow}>
                <Text style={styles.metaTimeMe}>{item.time}</Text>
                <Ticks seen={item.seen} />
              </View>
            )}
            {/* Timestamp only for their messages */}
            {!item.fromMe && (
              <Text style={[styles.metaTime, { alignSelf: "flex-start", marginTop: 3 }]}>
                {item.time}
              </Text>
            )}
          </View>
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
          <Feather name="arrow-left" size={22} color="#FFF" />
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
                ? "مقهى"
                : isGroup
                  ? `${group?.members.length ?? 0} أعضاء · اضغط للتفاصيل`
                  : "صديق"}
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

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.inputField}
          value={text}
          onChangeText={setText}
          placeholder="اكتب رسالة..."
          placeholderTextColor="rgba(255,255,255,0.30)"
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  headerInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  headerAvatarImg: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: PRIMARY,
  },
  headerName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#FFF" },
  headerSub:  { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.40)" },

  // List
  listContent: { paddingHorizontal: 12, paddingVertical: 16, gap: 8 },

  // Time label
  timeLabel: {
    textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.30)", marginVertical: 8,
  },

  // Bubbles
  bubbleRow:   { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "85%" },
  bubbleRowMe: { alignSelf: "flex-end", flexDirection: "row-reverse" },

  theirAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  theirAvatarImg: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(232,184,109,0.30)",
  },
  senderLabel: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    color: PRIMARY,
    marginBottom: 3,
    textAlign: "right",
  },

  bubble:      { maxWidth: "100%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  meBubble:    { backgroundColor: ME_BG, borderBottomRightRadius: 4 },
  themBubble:  { backgroundColor: THEM_BG, borderBottomLeftRadius: 4 },

  bubbleText:     { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTextMe:   { color: "#000" },
  bubbleTextThem: { color: "rgba(255,255,255,0.92)" },

  metaRow:    { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  metaTime:   { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", alignSelf: "flex-end" },
  metaTimeMe: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(0,0,0,0.55)", alignSelf: "flex-end" },

  // Ticks
  ticksRow: { flexDirection: "row", alignItems: "center" },
  tick:     { fontSize: 12, fontFamily: "Inter_700Bold" },

  // Input bar
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: BG,
  },
  inputField: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#FFF",
    maxHeight: 120,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "rgba(232,184,109,0.35)" },
});
