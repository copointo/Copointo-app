import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CAFES, PRODUCTS } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
}

const WELCOME = "Hello! I'm your Copointo AI assistant. I can help you with our menu, suggest drinks, or place an order for you. What can I get for you today? ☕";

const BOT_REPLIES: Record<string, string> = {
  "latte": "Our Latte is one of our bestsellers! It's a smooth espresso with lots of steamed milk for 2.300 OMR. Would you like to add it to your cart?",
  "cold": "For cold drinks, I recommend our Iced Latte (2.500 OMR) or our signature Cold Brew (2.800 OMR). The cold brew is steeped for 12 hours for maximum smoothness!",
  "recommend": "Based on popular orders, I recommend the Flat White — a velvety double ristretto that's perfect any time of day! Would you like one?",
  "menu": "We have Hot Drinks (espresso, cappuccino, flat white, latte), Cold Drinks (iced latte, cold brew, frappuccino), and Desserts (chocolate croissant, cheesecake, date & walnut cake). What sounds good?",
  "price": "Our drinks start from 1.500 OMR for an espresso. Most specialties are between 2-3 OMR. Everything is fresh and made to order!",
  "book": "I can help you book a table! Just let me know your preferred time and number of guests. Or tap the calendar button on the cafe page.",
  "free": "Every 7 orders you earn a free coffee through the Copointo Game! You can check your progress in the Game tab.",
};

function getBotReply(text: string): string {
  const lower = text.toLowerCase();
  for (const key of Object.keys(BOT_REPLIES)) {
    if (lower.includes(key)) return BOT_REPLIES[key];
  }
  return "That's a great question! Our baristas are passionate about specialty coffee. Can I suggest one of our popular drinks or help you place an order?";
}

export default function CafeChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cafe = CAFES.find((c) => c.id === id) ?? CAFES[0];

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "0", role: "bot", text: WELCOME },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: input.trim(),
    };
    const userInput = input.trim();
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: getBotReply(userInput),
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1000);
  };

  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={[styles.botAvatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={{ fontSize: 20 }}>🤖</Text>
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Copointo AI
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              {cafe.name}
            </Text>
          </View>
        </View>
        <View style={[styles.onlineIndicator, { backgroundColor: "#4CAF50" }]} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.messageRow,
              item.role === "user" ? styles.userRow : styles.botRow,
            ]}
          >
            {item.role === "bot" && (
              <View style={[styles.botBubbleAvatar, { backgroundColor: colors.primary + "15" }]}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
            )}
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: item.role === "user" ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {item.text}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          isTyping ? (
            <View style={[styles.messageRow, styles.botRow]}>
              <View style={[styles.botBubbleAvatar, { backgroundColor: colors.primary + "15" }]}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>typing...</Text>
              </View>
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        scrollEnabled={messages.length > 0}
      />

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={0}
        style={[styles.inputArea, { paddingBottom: bottomPadding + 8, borderTopColor: colors.border, backgroundColor: colors.background }]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask me anything..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? colors.primary : colors.muted },
          ]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Feather
            name="send"
            size={18}
            color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerInfo: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 },
  botAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  headerSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  onlineIndicator: { width: 10, height: 10, borderRadius: 5 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "85%",
  },
  userRow: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  botRow: { alignSelf: "flex-start" },
  botBubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    borderRadius: 18,
    padding: 12,
    maxWidth: "85%",
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
