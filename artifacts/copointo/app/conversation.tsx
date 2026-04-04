import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CHAT_HISTORY, MESSAGES, ChatMessage } from "@/data/mockData";

const BG      = "#0F0A2E";
const ME_BG   = "#C67C4E";
const THEM_BG = "rgba(255,255,255,0.08)";
const PRIMARY = "#C67C4E";

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
  return (
    <View style={styles.ticksRow}>
      <Text style={[styles.tick, { color: seen ? "#4FC3F7" : "rgba(255,255,255,0.50)" }]}>✓</Text>
      {seen && <Text style={[styles.tick, { color: "#4FC3F7", marginLeft: -5 }]}>✓</Text>}
    </View>
  );
}

export default function ConversationScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 67 : insets.top;
  const { id, name, type } = useLocalSearchParams<{ id: string; name: string; type: string }>();

  const listRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(CHAT_HISTORY[id] ?? []);
  const [text, setText] = useState("");

  // Mark all incoming as seen after 1.5 s (simulate read receipt)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages(prev => prev.map(m => (!m.fromMe ? { ...m, seen: true } : m)));
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom on open
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, []);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      text: trimmed,
      fromMe: true,
      time: now(),
      seen: false,
    };
    setMessages(prev => [...prev, newMsg]);
    setText("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    // Simulate "seen" after 2 s
    setTimeout(() => {
      setMessages(prev =>
        prev.map(m => m.id === newMsg.id ? { ...m, seen: true } : m)
      );
    }, 2000);
  };

  const isCafe = type === "cafe";

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const prevMsg  = messages[index - 1];
    const showTime = !prevMsg || prevMsg.time !== item.time;

    return (
      <View>
        {showTime && (
          <Text style={styles.timeLabel}>{item.time}</Text>
        )}
        <View style={[styles.bubbleRow, item.fromMe && styles.bubbleRowMe]}>
          {/* Their avatar (only first in group) */}
          {!item.fromMe && (!prevMsg || prevMsg.fromMe) && (
            <View style={styles.theirAvatar}>
              <Text style={{ fontSize: 16 }}>{isCafe ? "☕" : "👤"}</Text>
            </View>
          )}
          {!item.fromMe && prevMsg && !prevMsg.fromMe && (
            <View style={{ width: 32 }} />
          )}

          <View style={[styles.bubble, item.fromMe ? styles.meBubble : styles.themBubble]}>
            <Text style={[styles.bubbleText, !item.fromMe && styles.bubbleTextThem]}>
              {item.text}
            </Text>
            {/* Timestamp + ticks for my messages */}
            {item.fromMe && (
              <View style={styles.metaRow}>
                <Text style={styles.metaTime}>{item.time}</Text>
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

        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={{ fontSize: 18 }}>{isCafe ? "☕" : "👤"}</Text>
          </View>
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSub}>{isCafe ? "مقهى" : "صديق"}</Text>
          </View>
        </View>
      </View>

      {/* Messages list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
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
          <Feather name="send" size={18} color="#FFF" />
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

  bubble:      { maxWidth: "100%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  meBubble:    { backgroundColor: ME_BG, borderBottomRightRadius: 4 },
  themBubble:  { backgroundColor: THEM_BG, borderBottomLeftRadius: 4 },

  bubbleText:     { fontSize: 14, fontFamily: "Inter_400Regular", color: "#FFF", lineHeight: 20 },
  bubbleTextThem: { color: "rgba(255,255,255,0.90)" },

  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 3 },
  metaTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)", alignSelf: "flex-end" },

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
  sendBtnDisabled: { backgroundColor: "rgba(198,124,78,0.35)" },
});
