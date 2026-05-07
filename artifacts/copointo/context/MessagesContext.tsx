import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import { ChatMessage, Group, Message } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/constants/api";

/** Format an ISO timestamp as the same Arabic "h:mm ص/م" used elsewhere. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const period = h >= 12 ? "م" : "ص";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${period}`;
}

interface ServerMsg {
  id: string;
  kind: "friend" | "group";
  scope: string;
  senderId: string;
  text: string;
  createdAt: string;
  seenBy: string[];
}

const STORAGE_KEY_CHATS  = "copointo_chats_v2";
const STORAGE_KEY_UNREAD = "copointo_unread_v2";
const STORAGE_KEY_GROUPS = "copointo_groups_v2";

const chatsKey  = (uid: string) => `${STORAGE_KEY_CHATS}:${uid}`;
const unreadKey = (uid: string) => `${STORAGE_KEY_UNREAD}:${uid}`;
const groupsKey = (uid: string) => `${STORAGE_KEY_GROUPS}:${uid}`;

interface MessagesCtx {
  convList:    Message[];
  chats:       Record<string, ChatMessage[]>;
  groups:      Group[];
  markRead:    (id: string) => void;
  appendMsg:   (convId: string, msg: ChatMessage) => void;
  markSeen:    (convId: string, msgId: string) => void;
  refreshChats: () => Promise<void>;
  /** Group helpers */
  getGroup:        (groupId: string) => Group | undefined;
  createGroup:     (name: string, memberIds: string[], avatar?: string) => Promise<Group>;
  updateGroup:     (groupId: string, patch: Partial<Pick<Group, "name" | "avatar">>) => Promise<void>;
  addGroupMember:  (groupId: string, memberId: string) => Promise<void>;
  removeGroupMember: (groupId: string, memberId: string) => Promise<void>;
  leaveGroup:      (groupId: string) => Promise<void>;
}

const Ctx = createContext<MessagesCtx | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, friends, registeredUsers } = useApp();

  const [chats, setChats]         = useState<Record<string, ChatMessage[]>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [groups, setGroups]       = useState<Group[]>([]);
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
      setGroups([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [chatsRaw, unreadRaw, groupsRaw] = await Promise.all([
          AsyncStorage.getItem(chatsKey(user.id)),
          AsyncStorage.getItem(unreadKey(user.id)),
          AsyncStorage.getItem(groupsKey(user.id)),
        ]);
        if (cancelled) return;
        setChats(chatsRaw ? JSON.parse(chatsRaw) : {});
        setUnreadMap(unreadRaw ? JSON.parse(unreadRaw) : {});
        setGroups(groupsRaw ? JSON.parse(groupsRaw) : []);
      } catch (_) {
        if (cancelled) return;
        setChats({});
        setUnreadMap({});
        setGroups([]);
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

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(groupsKey(user.id), JSON.stringify(groups)).catch(() => {});
  }, [groups, ready, user?.id]);

  /**
   * Build the conversation list:
   *   1. one row per accepted friend (id = `friend_<friendId>`)
   *   2. one row per group I belong to (id = `group_<groupId>`)
   * Brand-new chats with no messages get a friendly placeholder preview.
   */
  const convList = useMemo<Message[]>(() => {
    if (!user) return [];
    const out: Message[] = [];

    // Friends
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

    // Groups
    for (const g of groups) {
      const convId = `group_${g.id}`;
      const history = chats[convId] ?? [];
      const last = history[history.length - 1];
      const previewBase = last
        ? (last.fromMe ? `أنت: ${last.text}` : (last.senderName ? `${last.senderName}: ${last.text}` : last.text))
        : `مجموعة جديدة · ${g.members.length} أعضاء`;
      const msg: Message = {
        id: convId,
        senderId: g.id,
        senderName: g.name,
        preview: previewBase,
        timestamp: last ? last.time : "الآن",
        unread: unreadMap[convId] ?? 0,
        type: "group",
      };
      if (g.avatar) msg.senderAvatar = g.avatar;
      out.push(msg);
    }

    return out;
  }, [user, friends, registeredUsers, chats, unreadMap, groups]);

  // Mark a conversation as read (clear unread badge) AND tell the server
  // I've seen every message in it so the original sender's bubble flips
  // from ✓ to ✓✓ on their next poll.
  const markRead = useCallback((id: string) => {
    setUnreadMap(prev => (prev[id] ? { ...prev, [id]: 0 } : prev));
    if (!user) return;
    let body: Record<string, string> | null = null;
    if (id.startsWith("friend_")) {
      body = { userId: user.id, kind: "friend", otherId: id.slice("friend_".length) };
    } else if (id.startsWith("group_")) {
      body = { userId: user.id, kind: "group", groupId: id.slice("group_".length) };
    }
    if (!body) return;
    fetch(`${API_BASE}/messages/seen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [user?.id]);

  /**
   * Append a new message to a conversation. Outgoing messages (fromMe=true)
   * are POSTed to the server so OTHER devices receive them via their poll
   * loop — this is the real-time, cross-device path that replaces the old
   * AsyncStorage mirror. Incoming messages (fromMe=false) are appended
   * locally only (the server already stored them; the poll added them here).
   */
  const appendMsg = useCallback((convId: string, msg: ChatMessage) => {
    setChats(prev => {
      const existing = prev[convId] ?? [];
      // Idempotency guard: poll might have already inserted this id.
      if (existing.some(m => m.id === msg.id)) return prev;
      return { ...prev, [convId]: [...existing, msg] };
    });
    if (!msg.fromMe) {
      setUnreadMap(prev => ({ ...prev, [convId]: (prev[convId] ?? 0) + 1 }));
    }
    if (!msg.fromMe || !user) return;

    // Push to the server so the recipient(s) see it on their next poll.
    let body: Record<string, string> | null = null;
    if (convId.startsWith("friend_")) {
      const recipientId = convId.slice("friend_".length);
      body = { id: msg.id, senderId: user.id, kind: "friend", recipientId, text: msg.text };
    } else if (convId.startsWith("group_")) {
      const groupId = convId.slice("group_".length);
      body = { id: msg.id, senderId: user.id, kind: "group", groupId, text: msg.text };
    }
    if (!body) return;
    fetch(`${API_BASE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [user?.id]);

  // Mark a specific sent message as seen (✓✓) — local-only fallback. The
  // authoritative ✓✓ flip happens via the server poll below when the
  // recipient calls markRead on their device.
  const markSeen = useCallback((convId: string, msgId: string) => {
    setChats(prev => ({
      ...prev,
      [convId]: (prev[convId] ?? []).map(m => m.id === msgId ? { ...m, seen: true } : m),
    }));
  }, []);

  // ─── Real-time poll loop ────────────────────────────────────────────────
  // Pulls every message visible to me from the server and merges into the
  // local chat state. New messages from other users appear within ~3 s and
  // ✓✓ ticks update on the sender's side once the recipient opens the chat.
  // We dedupe by message id so locally-appended sends never duplicate.
  const groupsRef          = useRef<Group[]>([]);
  const registeredUsersRef = useRef(registeredUsers);
  const lastSyncRef        = useRef<string>("");
  useEffect(() => { groupsRef.current          = groups;          }, [groups]);
  useEffect(() => { registeredUsersRef.current = registeredUsers; }, [registeredUsers]);

  useEffect(() => {
    if (!user || !ready) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const sync = async () => {
      try {
        const groupIds = groupsRef.current.map(g => g.id).join(",");
        const params = new URLSearchParams({ userId: user.id });
        if (groupIds) params.set("groupIds", groupIds);
        if (lastSyncRef.current) params.set("since", lastSyncRef.current);
        const res = await fetch(`${API_BASE}/messages?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data: { messages: ServerMsg[]; now?: string } = await res.json();
        if (cancelled) return;
        if (data.now) lastSyncRef.current = data.now;
        if (!Array.isArray(data.messages) || data.messages.length === 0) return;

        // Bucket server messages by client convId.
        const byConv: Record<string, ServerMsg[]> = {};
        for (const m of data.messages) {
          let convId: string;
          if (m.kind === "friend") {
            const [a, b] = m.scope.split("|");
            const other = a === user.id ? (b ?? a) : a;
            convId = `friend_${other}`;
          } else {
            convId = `group_${m.scope}`;
          }
          (byConv[convId] ||= []).push(m);
        }

        const unreadInc: Record<string, number> = {};

        setChats(prev => {
          const merged: Record<string, ChatMessage[]> = { ...prev };
          for (const [convId, msgs] of Object.entries(byConv)) {
            const existing = merged[convId] ?? [];
            const idMap = new Map(existing.map(m => [m.id, m]));
            const additions: ChatMessage[] = [];
            const updatesById = new Map<string, ChatMessage>();
            for (const sm of msgs) {
              const isMine = sm.senderId === user.id;
              const seen   = isMine
                ? sm.seenBy.some(uid => uid !== user.id)
                : true;
              const old = idMap.get(sm.id);
              if (old) {
                // Existing — only update the ✓✓ tick if it just flipped.
                if (seen && !old.seen) {
                  updatesById.set(sm.id, { ...old, seen: true });
                }
              } else {
                const cm: ChatMessage = {
                  id:     sm.id,
                  text:   sm.text,
                  fromMe: isMine,
                  time:   formatTime(sm.createdAt),
                  seen,
                };
                if (!isMine) {
                  cm.senderId = sm.senderId;
                  const sender = registeredUsersRef.current.find(u => u.id === sm.senderId);
                  if (sender) {
                    cm.senderName = sender.name;
                    if (sender.avatar) cm.senderAvatar = sender.avatar;
                  }
                  unreadInc[convId] = (unreadInc[convId] ?? 0) + 1;
                }
                additions.push(cm);
              }
            }
            if (updatesById.size === 0 && additions.length === 0) continue;
            const next = existing.map(m => updatesById.get(m.id) ?? m);
            merged[convId] = additions.length > 0 ? [...next, ...additions] : next;
          }
          return merged;
        });

        if (Object.keys(unreadInc).length > 0) {
          setUnreadMap(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(unreadInc)) next[k] = (next[k] ?? 0) + v;
            return next;
          });
        }
      } catch { /* network blip — try again next tick */ }
    };

    sync();
    timer = setInterval(sync, 3500);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [user?.id, ready]);

  /**
   * Manual refresh (e.g. on Messages tab focus) to pick up mirrored
   * messages and group changes from other users. MERGES storage into
   * in-memory state by id so a just-sent local message that hasn't been
   * flushed to storage yet won't disappear.
   */
  const refreshChats = useCallback(async () => {
    if (!user) return;
    try {
      const [chatsRaw, unreadRaw, groupsRaw] = await Promise.all([
        AsyncStorage.getItem(chatsKey(user.id)),
        AsyncStorage.getItem(unreadKey(user.id)),
        AsyncStorage.getItem(groupsKey(user.id)),
      ]);
      const stored: Record<string, ChatMessage[]> =
        chatsRaw ? JSON.parse(chatsRaw) : {};
      const storedUnread: Record<string, number> =
        unreadRaw ? JSON.parse(unreadRaw) : {};
      const storedGroups: Group[] =
        groupsRaw ? JSON.parse(groupsRaw) : [];

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
          merged[convId] = Math.max(merged[convId] ?? 0, count);
        }
        return merged;
      });

      // Merge groups by id; storage wins for shared fields (handles updates
      // pushed by other members) but we don't drop locally-known groups.
      setGroups(prev => {
        const map = new Map<string, Group>();
        for (const g of prev) map.set(g.id, g);
        for (const g of storedGroups) map.set(g.id, g);
        return Array.from(map.values());
      });
    } catch (_) {}
  }, [user?.id]);

  // ─── Group helpers ────────────────────────────────────────────────────────

  const getGroup = useCallback(
    (groupId: string) => groups.find(g => g.id === groupId),
    [groups],
  );

  /** Write/replace a group in another user's storage (mock cross-device). */
  const writeGroupToUser = async (uid: string, group: Group) => {
    try {
      const raw = await AsyncStorage.getItem(groupsKey(uid));
      const list: Group[] = raw ? JSON.parse(raw) : [];
      const idx = list.findIndex(g => g.id === group.id);
      if (idx >= 0) list[idx] = group;
      else list.push(group);
      await AsyncStorage.setItem(groupsKey(uid), JSON.stringify(list));
    } catch (_) {}
  };

  /** Remove a group from another user's storage. */
  const removeGroupFromUser = async (uid: string, groupId: string) => {
    try {
      const raw = await AsyncStorage.getItem(groupsKey(uid));
      const list: Group[] = raw ? JSON.parse(raw) : [];
      const filtered = list.filter(g => g.id !== groupId);
      await AsyncStorage.setItem(groupsKey(uid), JSON.stringify(filtered));
    } catch (_) {}
  };

  const createGroup = useCallback(
    async (name: string, memberIds: string[], avatar?: string): Promise<Group> => {
      if (!user) throw new Error("not signed in");
      const trimmed = name.trim() || "مجموعة جديدة";
      const dedupedMembers = Array.from(new Set([user.id, ...memberIds]));
      const group: Group = {
        id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        members: dedupedMembers,
        createdBy: user.id,
        createdAt: Date.now(),
      };
      if (avatar) group.avatar = avatar;

      setGroups(prev => [...prev, group]);
      // Mirror to every other member's storage
      await Promise.all(
        dedupedMembers
          .filter(mid => mid !== user.id)
          .map(mid => writeGroupToUser(mid, group)),
      );
      return group;
    },
    [user?.id],
  );

  const updateGroup = useCallback(
    async (groupId: string, patch: Partial<Pick<Group, "name" | "avatar">>) => {
      if (!user) return;
      let updated: Group | null = null;
      setGroups(prev =>
        prev.map(g => {
          if (g.id !== groupId) return g;
          const next: Group = { ...g, ...patch };
          if (patch.name !== undefined) next.name = patch.name.trim() || g.name;
          updated = next;
          return next;
        }),
      );
      if (!updated) return;
      const grp: Group = updated;
      await Promise.all(
        grp.members
          .filter(mid => mid !== user.id)
          .map(mid => writeGroupToUser(mid, grp)),
      );
    },
    [user?.id],
  );

  const addGroupMember = useCallback(
    async (groupId: string, memberId: string) => {
      if (!user) return;
      let updated: Group | null = null;
      setGroups(prev =>
        prev.map(g => {
          if (g.id !== groupId) return g;
          if (g.members.includes(memberId)) { updated = g; return g; }
          const next: Group = { ...g, members: [...g.members, memberId] };
          updated = next;
          return next;
        }),
      );
      if (!updated) return;
      const grp: Group = updated;
      // Push to every member (so the new member also sees the group)
      await Promise.all(
        grp.members
          .filter(mid => mid !== user.id)
          .map(mid => writeGroupToUser(mid, grp)),
      );
    },
    [user?.id],
  );

  const removeGroupMember = useCallback(
    async (groupId: string, memberId: string) => {
      if (!user) return;
      let updated: Group | null = null;
      setGroups(prev =>
        prev.map(g => {
          if (g.id !== groupId) return g;
          const next: Group = { ...g, members: g.members.filter(m => m !== memberId) };
          updated = next;
          return next;
        }),
      );
      if (!updated) return;
      const grp: Group = updated;
      // Remove from the kicked member; update everyone else
      await Promise.all([
        removeGroupFromUser(memberId, groupId),
        ...grp.members
          .filter(mid => mid !== user.id && mid !== memberId)
          .map(mid => writeGroupToUser(mid, grp)),
      ]);
    },
    [user?.id],
  );

  const leaveGroup = useCallback(
    async (groupId: string) => {
      if (!user) return;
      const grp = groups.find(g => g.id === groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (!grp) return;
      const remaining = grp.members.filter(m => m !== user.id);
      const updated: Group = { ...grp, members: remaining };
      // Push the slimmer member list to remaining members
      await Promise.all(
        remaining.map(mid => writeGroupToUser(mid, updated)),
      );
    },
    [user?.id, groups],
  );

  return (
    <Ctx.Provider value={{
      convList, chats, groups,
      markRead, appendMsg, markSeen, refreshChats,
      getGroup, createGroup, updateGroup,
      addGroupMember, removeGroupMember, leaveGroup,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMessages must be inside MessagesProvider");
  return ctx;
}
