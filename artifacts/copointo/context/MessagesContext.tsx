import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from "react";
import { ChatMessage, Message } from "@/data/mockData";
import { useApp } from "@/context/AppContext";

const STORAGE_KEY_CHATS  = "copointo_chats_v2";
const STORAGE_KEY_UNREAD = "copointo_unread_v2";

const chatsKey  = (uid: string) => `${STORAGE_KEY_CHATS}:${uid}`;
const unreadKey = (uid: string) => `${STORAGE_KEY_UNREAD}:${uid}`;

interface MessagesCtx {
  convList:    Message[];
  chats:       Record<string, ChatMessage[]>;
  markRead:    (id: string) => void;
  appendMsg:   (convId: string, msg: ChatMessage) => void;
  markSeen:    (convId: string, msgId: string) => void;
  refreshChats: () => Promise<void>;
}

const Ctx = createContext<MessagesCtx | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, friends, registeredUsers } = useApp();

  const [chats, setChats]         = useState<Record<string, ChatMessage[]>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [ready, setReady]         = useState(false);

  // Per-user load: re-load whenever the active user changes.
  // CRITICAL: We set `ready=false` first so the persistence effects don't
  // race and overwrite the new user's storage with the previous user's
  // in-memory state before the load completes.
  useEffect(() => {
    setReady(false);
    if (!user) {
      setChats({});
      setUnreadMap({});
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [chatsRaw, unreadRaw] = await Promise.all([
          AsyncStorage.getItem(chatsKey(user.id)),
          AsyncStorage.getItem(unreadKey(user.id)),
        ]);
        if (cancelled) return;
        setChats(chatsRaw ? JSON.parse(chatsRaw) : {});
        setUnreadMap(unreadRaw ? JSON.parse(unreadRaw) : {});
      } catch (_) {
        if (cancelled) return;
        setChats({});
        setUnreadMap({});
      }
      if (!cancelled) setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(chatsKey(user.id), JSON.stringify(chats)).catch(() => {});
  }, [chats, ready, user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(unreadKey(user.id), JSON.stringify(unreadMap)).catch(() => {});
  }, [unreadMap, ready, user?.id]);

  /**
   * Build the conversation list from the current user's friends.
   * Each accepted friend = one conversation with id `friend_<friendId>`.
   * Brand-new friends (no chat history yet) show a friendly placeholder
   * preview so the conversation appears immediately after acceptance.
   */
  const convList = useMemo<Message[]>(() => {
    if (!user) return [];
    const out: Message[] = [];
    for (const fid of friends) {
      const friend = registeredUsers.find((u) => u.id === fid);
      if (!friend) continue;
      const convId = `friend_${fid}`;
      const history = chats[convId] ?? [];
      const last = history[history.length - 1];
      const msg: Message = {
        id: convId,
        senderId: fid,
        senderName: friend.name,
        preview: last ? last.text : "صديق جديد — ابدأ المحادثة 👋",
        timestamp: last ? last.time : "الآن",
        unread: unreadMap[convId] ?? 0,
        type: "user",
      };
      if (friend.avatar) msg.senderAvatar = friend.avatar;
      out.push(msg);
    }
    return out;
  }, [user, friends, registeredUsers, chats, unreadMap]);

  // Mark a conversation as read (clear unread badge)
  const markRead = useCallback((id: string) => {
    setUnreadMap(prev => (prev[id] ? { ...prev, [id]: 0 } : prev));
  }, []);

  /**
   * Append a new message to a conversation.
   * For outgoing messages (fromMe=true) we ALSO write a mirrored copy into
   * the recipient's AsyncStorage so they see it on their side. This mocks
   * a real backend message sync since the device is shared between users.
   */
  const appendMsg = useCallback((convId: string, msg: ChatMessage) => {
    setChats(prev => ({
      ...prev,
      [convId]: [...(prev[convId] ?? []), msg],
    }));
    if (!msg.fromMe) {
      setUnreadMap(prev => ({ ...prev, [convId]: (prev[convId] ?? 0) + 1 }));
    }
    // Mirror to recipient's storage (mock cross-user delivery)
    if (msg.fromMe && user && convId.startsWith("friend_")) {
      const recipientId = convId.slice("friend_".length);
      const mirroredConvId = `friend_${user.id}`;
      const mirroredMsg: ChatMessage = { ...msg, fromMe: false, seen: false };
      (async () => {
        try {
          const [chatsRaw, unreadRaw] = await Promise.all([
            AsyncStorage.getItem(chatsKey(recipientId)),
            AsyncStorage.getItem(unreadKey(recipientId)),
          ]);
          const recipChats: Record<string, ChatMessage[]> =
            chatsRaw ? JSON.parse(chatsRaw) : {};
          const recipUnread: Record<string, number> =
            unreadRaw ? JSON.parse(unreadRaw) : {};
          recipChats[mirroredConvId] = [
            ...(recipChats[mirroredConvId] ?? []),
            mirroredMsg,
          ];
          recipUnread[mirroredConvId] = (recipUnread[mirroredConvId] ?? 0) + 1;
          await Promise.all([
            AsyncStorage.setItem(chatsKey(recipientId), JSON.stringify(recipChats)),
            AsyncStorage.setItem(unreadKey(recipientId), JSON.stringify(recipUnread)),
          ]);
        } catch (_) {}
      })();
    }
  }, [user?.id]);

  // Mark a specific sent message as seen (✓✓)
  const markSeen = useCallback((convId: string, msgId: string) => {
    setChats(prev => ({
      ...prev,
      [convId]: (prev[convId] ?? []).map(m => m.id === msgId ? { ...m, seen: true } : m),
    }));
  }, []);

  /**
   * Manual refresh (e.g. on Messages tab focus) to pick up mirrored
   * messages from other users. This MERGES storage into in-memory chats
   * by message id rather than replacing — so a just-sent local message
   * that hasn't been flushed to storage yet won't disappear.
   */
  const refreshChats = useCallback(async () => {
    if (!user) return;
    try {
      const [chatsRaw, unreadRaw] = await Promise.all([
        AsyncStorage.getItem(chatsKey(user.id)),
        AsyncStorage.getItem(unreadKey(user.id)),
      ]);
      const stored: Record<string, ChatMessage[]> =
        chatsRaw ? JSON.parse(chatsRaw) : {};
      const storedUnread: Record<string, number> =
        unreadRaw ? JSON.parse(unreadRaw) : {};

      setChats(prev => {
        const merged: Record<string, ChatMessage[]> = { ...prev };
        for (const [convId, list] of Object.entries(stored)) {
          const memList = merged[convId] ?? [];
          const seen = new Set(memList.map(m => m.id));
          const additions = list.filter(m => !seen.has(m.id));
          merged[convId] = additions.length > 0
            ? [...memList, ...additions]
            : memList;
        }
        return merged;
      });

      setUnreadMap(prev => {
        const merged: Record<string, number> = { ...prev };
        for (const [convId, count] of Object.entries(storedUnread)) {
          // Take the larger count (storage may have new mirrored unreads)
          merged[convId] = Math.max(merged[convId] ?? 0, count);
        }
        return merged;
      });
    } catch (_) {}
  }, [user?.id]);

  return (
    <Ctx.Provider value={{ convList, chats, markRead, appendMsg, markSeen, refreshChats }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMessages must be inside MessagesProvider");
  return ctx;
}
