import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { MESSAGES, CHAT_HISTORY, ChatMessage, Message } from "@/data/mockData";

const STORAGE_KEY_LIST  = "copointo_msg_list_v1";
const STORAGE_KEY_CHATS = "copointo_chats_v1";

interface MessagesCtx {
  convList:    Message[];
  chats:       Record<string, ChatMessage[]>;
  markRead:    (id: string) => void;
  appendMsg:   (convId: string, msg: ChatMessage) => void;
  markSeen:    (convId: string, msgId: string) => void;
}

const Ctx = createContext<MessagesCtx | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [convList, setConvList] = useState<Message[]>(MESSAGES);
  const [chats, setChats]       = useState<Record<string, ChatMessage[]>>(CHAT_HISTORY);
  const [ready, setReady]       = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const [listRaw, chatsRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_LIST),
          AsyncStorage.getItem(STORAGE_KEY_CHATS),
        ]);
        if (listRaw)  setConvList(JSON.parse(listRaw));
        if (chatsRaw) setChats(JSON.parse(chatsRaw));
      } catch (_) {}
      setReady(true);
    })();
  }, []);

  // Persist convList whenever it changes
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(convList)).catch(() => {});
  }, [convList, ready]);

  // Persist chats whenever they change
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(STORAGE_KEY_CHATS, JSON.stringify(chats)).catch(() => {});
  }, [chats, ready]);

  // Mark a conversation as read (clear badge)
  const markRead = useCallback((id: string) => {
    setConvList(prev =>
      prev.map(c => c.id === id ? { ...c, unread: 0 } : c)
    );
  }, []);

  // Append a new message to a conversation and update preview
  const appendMsg = useCallback((convId: string, msg: ChatMessage) => {
    setChats(prev => ({
      ...prev,
      [convId]: [...(prev[convId] ?? []), msg],
    }));
    setConvList(prev =>
      prev.map(c =>
        c.id === convId
          ? { ...c, preview: msg.text, timestamp: msg.time, unread: msg.fromMe ? 0 : c.unread + 1 }
          : c
      )
    );
  }, []);

  // Mark a specific sent message as seen (✓✓)
  const markSeen = useCallback((convId: string, msgId: string) => {
    setChats(prev => ({
      ...prev,
      [convId]: (prev[convId] ?? []).map(m => m.id === msgId ? { ...m, seen: true } : m),
    }));
  }, []);

  return (
    <Ctx.Provider value={{ convList, chats, markRead, appendMsg, markSeen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMessages must be inside MessagesProvider");
  return ctx;
}
