import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import { ChatMessage, Community, Group, Message } from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { API_BASE } from "@/constants/api";
import { playReceiveMessageSound } from "@/lib/notification-sound";

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
  giftId?: string;
  giftQty?: number;
  deletedForAll?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  mediaDuration?: number;
}

const STORAGE_KEY_CHATS    = "copointo_chats_v2";
const STORAGE_KEY_UNREAD   = "copointo_unread_v2";
const STORAGE_KEY_GROUPS   = "copointo_groups_v2";
const STORAGE_KEY_CLEARED  = "copointo_chat_cleared_v1";
const STORAGE_KEY_HIDDEN   = "copointo_hidden_convs_v1";
const STORAGE_KEY_DELMSGS  = "copointo_deleted_msgs_v1";
const STORAGE_KEY_TOMBMSGS = "copointo_tombstoned_msgs_v1";

// Reserved sender id used by the super-admin direct-message endpoint
// (`POST /api/admin/users/:id/message`). Conversations whose convId is
// `friend_${COPOINTO_ADMIN_ID}` are rendered as coming from "كوبوينتو".
export const COPOINTO_ADMIN_ID = "copointo-admin";
const COPOINTO_ADMIN_CONV      = `friend_${COPOINTO_ADMIN_ID}`;
const COPOINTO_ADMIN_NAME      = "Copointo";
const COPOINTO_ADMIN_AVATAR    = "☕";

const chatsKey   = (uid: string) => `${STORAGE_KEY_CHATS}:${uid}`;
const unreadKey  = (uid: string) => `${STORAGE_KEY_UNREAD}:${uid}`;
const groupsKey  = (uid: string) => `${STORAGE_KEY_GROUPS}:${uid}`;
const clearedKey = (uid: string) => `${STORAGE_KEY_CLEARED}:${uid}`;
const hiddenKey  = (uid: string) => `${STORAGE_KEY_HIDDEN}:${uid}`;
const delMsgsKey = (uid: string) => `${STORAGE_KEY_DELMSGS}:${uid}`;
const tombMsgsKey = (uid: string) => `${STORAGE_KEY_TOMBMSGS}:${uid}`;

interface MessagesCtx {
  convList:    Message[];
  chats:       Record<string, ChatMessage[]>;
  groups:      Group[];
  markRead:    (id: string) => void;
  appendMsg:   (convId: string, msg: ChatMessage) => void;
  markSeen:    (convId: string, msgId: string) => void;
  refreshChats: () => Promise<void>;
  /** Tell the provider which conversation is currently open so the poll
   *  loop can skip the unread-badge bump for it and auto-flip ✓✓. */
  setActiveConv: (convId: string | null) => void;
  /** Group helpers */
  getGroup:        (groupId: string) => Group | undefined;
  createGroup:     (name: string, memberIds: string[], avatar?: string) => Promise<Group>;
  updateGroup:     (groupId: string, patch: Partial<Pick<Group, "name" | "avatar">>) => Promise<void>;
  addGroupMember:  (groupId: string, memberId: string) => Promise<void>;
  removeGroupMember: (groupId: string, memberId: string) => Promise<void>;
  leaveGroup:      (groupId: string) => Promise<void>;
  /** Community-bound group helpers — keep a chat group in lock-step with a community. */
  syncCommunityGroup: (community: Community, removedMemberIds?: string[]) => Promise<void>;
  dissolveCommunityGroup: (communityId: string, formerMemberIds: string[]) => Promise<void>;
  /** Delete the entire conversation FOR ME ONLY. Hides the row in the
   *  Messages tab, clears history+unread locally, and (for groups) drops
   *  the group from my memberships so I stop polling it. The other
   *  participants keep their copy. If a brand-new message arrives later,
   *  the conversation auto-unhides so I never miss anything important. */
  deleteConversation: (convId: string) => Promise<void>;
  /** Delete one message. mode="forMe" removes it from my local view only.
   *  mode="forEveryone" is allowed only for messages I sent — it tells
   *  the server to mark the row as deleted so every device renders a
   *  "🚫 تم حذف الرسالة" placeholder on the next poll. */
  deleteMessage: (convId: string, msgId: string, mode: "forMe" | "forEveryone") => Promise<void>;
  /** Locally mark someone else's message as deleted ("forMe" with a
   *  visible placeholder). The other side is unaffected. Survives
   *  app restarts and server replays. */
  tombstoneMessage: (convId: string, msgId: string) => Promise<void>;
}

/** Deterministic chat-group id for a community-bound group. */
export const COMMUNITY_GROUP_PREFIX = "g_community_";
export const communityGroupId = (communityId: string) =>
  `${COMMUNITY_GROUP_PREFIX}${communityId}`;

const Ctx = createContext<MessagesCtx | null>(null);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { user, friends, registeredUsers } = useApp();

  const [chats, setChats]         = useState<Record<string, ChatMessage[]>>({});
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [groups, setGroups]       = useState<Group[]>([]);
  // ISO timestamp per convId — server messages older than this are filtered
  // out by the poll loop, so a "delete chat for me" stays deleted even if
  // the cursor resets (e.g. account switch) and the server replays history.
  const [clearedAt, setClearedAt] = useState<Record<string, string>>({});
  // Conv ids the user explicitly hid via "delete chat". Friend rows in
  // particular always derive from the friends list, so we need an explicit
  // hide set to keep them off the Messages tab. Auto-cleared when a fresh
  // incoming message arrives so important chats can never go missing.
  const [hiddenConvs, setHiddenConvs] = useState<Set<string>>(new Set());
  // Per-user tombstones for "delete message for me" — message ids the user
  // explicitly hid locally. Persisted so they stay deleted across app
  // restarts even when the poll cursor resets and the server replays them.
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string>>(new Set());
  // Per-user tombstones for "delete message (placeholder)" — message ids
  // the user explicitly tombstoned. Renders "🚫 تم حذف الرسالة" in place
  // instead of removing the row. Persisted across restarts.
  const [tombstonedMsgIds, setTombstonedMsgIds] = useState<Set<string>>(new Set());
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
      setClearedAt({});
      setHiddenConvs(new Set());
      setDeletedMsgIds(new Set());
      setTombstonedMsgIds(new Set());
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [chatsRaw, unreadRaw, groupsRaw, clearedRaw, hiddenRaw, delMsgsRaw, tombMsgsRaw] = await Promise.all([
          AsyncStorage.getItem(chatsKey(user.id)),
          AsyncStorage.getItem(unreadKey(user.id)),
          AsyncStorage.getItem(groupsKey(user.id)),
          AsyncStorage.getItem(clearedKey(user.id)),
          AsyncStorage.getItem(hiddenKey(user.id)),
          AsyncStorage.getItem(delMsgsKey(user.id)),
          AsyncStorage.getItem(tombMsgsKey(user.id)),
        ]);
        if (cancelled) return;
        setChats(chatsRaw ? JSON.parse(chatsRaw) : {});
        setUnreadMap(unreadRaw ? JSON.parse(unreadRaw) : {});
        setGroups(groupsRaw ? JSON.parse(groupsRaw) : []);
        setClearedAt(clearedRaw ? JSON.parse(clearedRaw) : {});
        setHiddenConvs(new Set(hiddenRaw ? JSON.parse(hiddenRaw) : []));
        setDeletedMsgIds(new Set(delMsgsRaw ? JSON.parse(delMsgsRaw) : []));
        setTombstonedMsgIds(new Set(tombMsgsRaw ? JSON.parse(tombMsgsRaw) : []));
      } catch (_) {
        if (cancelled) return;
        setChats({});
        setUnreadMap({});
        setGroups([]);
        setClearedAt({});
        setHiddenConvs(new Set());
        setDeletedMsgIds(new Set());
        setTombstonedMsgIds(new Set());
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

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(clearedKey(user.id), JSON.stringify(clearedAt)).catch(() => {});
  }, [clearedAt, ready, user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(hiddenKey(user.id), JSON.stringify(Array.from(hiddenConvs))).catch(() => {});
  }, [hiddenConvs, ready, user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(delMsgsKey(user.id), JSON.stringify(Array.from(deletedMsgIds))).catch(() => {});
  }, [deletedMsgIds, ready, user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(tombMsgsKey(user.id), JSON.stringify(Array.from(tombstonedMsgIds))).catch(() => {});
  }, [tombstonedMsgIds, ready, user?.id]);

  /**
   * Build the conversation list:
   *   1. one row per accepted friend (id = `friend_<friendId>`)
   *   2. one row per group I belong to (id = `group_<groupId>`)
   * Brand-new chats with no messages get a friendly placeholder preview.
   */
  const convList = useMemo<Message[]>(() => {
    if (!user) return [];
    const out: Message[] = [];

    // System "Copointo" conversation: appears whenever the super-admin has
    // ever sent a direct message to this user. Pinned to the top so the
    // brand message is impossible to miss.
    const adminHistory = chats[COPOINTO_ADMIN_CONV] ?? [];
    if (adminHistory.length > 0) {
      const last = adminHistory[adminHistory.length - 1];
      out.push({
        id: COPOINTO_ADMIN_CONV,
        senderId: COPOINTO_ADMIN_ID,
        senderName: COPOINTO_ADMIN_NAME,
        senderAvatar: COPOINTO_ADMIN_AVATAR,
        preview: last ? last.text : "رسالة من كوبوينتو",
        timestamp: last ? last.time : "الآن",
        unread: unreadMap[COPOINTO_ADMIN_CONV] ?? 0,
        type: "user",
      });
    }

    // Friends
    for (const fid of friends) {
      const friend = registeredUsers.find((u) => u.id === fid);
      if (!friend) continue;
      const convId = `friend_${fid}`;
      const history = chats[convId] ?? [];
      // Honor "delete chat for me" — hide the row entirely until a brand
      // new message arrives (the poll loop auto-clears the hide flag).
      if (hiddenConvs.has(convId) && history.length === 0) continue;
      const last = history[history.length - 1];
      const previewText = last
        ? (last.deletedForAll ? "🚫 رسالة محذوفة" : last.text)
        : "صديق جديد — ابدأ المحادثة 👋";
      const msg: Message = {
        id: convId,
        senderId: fid,
        senderName: friend.name,
        preview: previewText,
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
      if (hiddenConvs.has(convId) && history.length === 0) continue;
      const last = history[history.length - 1];
      const lastText = last?.deletedForAll ? "🚫 رسالة محذوفة" : last?.text;
      const previewBase = last
        ? (last.fromMe ? `أنت: ${lastText}` : (last.senderName ? `${last.senderName}: ${lastText}` : lastText ?? ""))
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

    // Sort by latest activity (newest message first) so any conversation
    // that just received/sent a message bubbles to the top, WhatsApp-style.
    // The Copointo system row stays pinned at the very top regardless.
    // Precompute the last-ts per conv once so the comparator is O(1).
    const lastTsCache = new Map<string, number>();
    for (const m of out) {
      const list = chats[m.id];
      let ts = 0;
      if (list && list.length > 0) {
        for (let i = list.length - 1; i >= 0; i--) {
          const id = list[i]?.id ?? "";
          const ms = parseInt(id.split("_")[0] ?? "", 10);
          if (Number.isFinite(ms) && ms > 0) { ts = ms; break; }
        }
        if (ts === 0) ts = list.length;
      }
      lastTsCache.set(m.id, ts);
    }
    out.sort((a, b) => {
      if (a.id === COPOINTO_ADMIN_CONV) return -1;
      if (b.id === COPOINTO_ADMIN_CONV) return 1;
      return (lastTsCache.get(b.id) ?? 0) - (lastTsCache.get(a.id) ?? 0);
    });

    return out;
  }, [user, friends, registeredUsers, chats, unreadMap, groups, hiddenConvs]);

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
    if (msg.giftId) {
      body.giftId = msg.giftId;
      body.giftQty = String(msg.giftQty ?? 1);
      // Carry the real usernames so the global gift-feed ticker can show
      // "@sender أهدى @recipient" instead of falling back to "مستخدم".
      const senderName = (user as any).gameUsername || user.name;
      if (senderName) body.senderName = String(senderName);
      if (msg.recipientName) body.recipientName = String(msg.recipientName);
    }
    // Media attachments — image / video / audio voice notes. We send the
    // raw `gcs:<key>` reference; the recipient resolves it to a stream URL
    // via `resolveChatMediaUrl()`.
    if (msg.imageUrl)      body.imageUrl      = msg.imageUrl;
    if (msg.videoUrl)      body.videoUrl      = msg.videoUrl;
    if (msg.audioUrl)      body.audioUrl      = msg.audioUrl;
    if (msg.mediaDuration) body.mediaDuration = String(Math.round(msg.mediaDuration));
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
  const activeConvRef      = useRef<string | null>(null);
  const clearedAtRef       = useRef<Record<string, string>>({});
  const deletedMsgIdsRef   = useRef<Set<string>>(new Set());
  const tombstonedMsgIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { groupsRef.current          = groups;          }, [groups]);
  useEffect(() => { registeredUsersRef.current = registeredUsers; }, [registeredUsers]);
  useEffect(() => { clearedAtRef.current       = clearedAt;       }, [clearedAt]);
  useEffect(() => { deletedMsgIdsRef.current   = deletedMsgIds;   }, [deletedMsgIds]);
  useEffect(() => { tombstonedMsgIdsRef.current = tombstonedMsgIds; }, [tombstonedMsgIds]);

  // Public setter for the conversation screen to register itself as "open".
  const setActiveConv = useCallback((convId: string | null) => {
    activeConvRef.current = convId;
  }, []);

  useEffect(() => {
    if (!user || !ready) return;
    // Reset the cursor on every account switch so the new user gets the
    // FULL visible history, not just messages newer than the previous
    // user's last sync timestamp.
    lastSyncRef.current = "";
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    // Track whether we've completed at least one sync — used to suppress
    // the receive sound/haptic on initial hydration so historical incoming
    // messages don't blast a chime when the user first opens the app or
    // switches accounts.
    let hasSynced = false;

    const sync = async () => {
      const isFirstSync = !hasSynced;
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

        // Bucket server messages by client convId. Drop anything older than
        // the user's "delete chat for me" cutoff for that conversation so
        // cleared chats don't reappear when the cursor resets.
        const byConv: Record<string, ServerMsg[]> = {};
        const clearedSnap = clearedAtRef.current;
        const tombSnap    = deletedMsgIdsRef.current;
        const placeSnap   = tombstonedMsgIdsRef.current;
        for (const m of data.messages) {
          // Per-user "delete for me" tombstone — never re-render this id.
          if (tombSnap.has(m.id)) continue;
          let convId: string;
          if (m.kind === "friend") {
            const [a, b] = m.scope.split("|");
            const other = a === user.id ? (b ?? a) : a;
            convId = `friend_${other}`;
          } else {
            convId = `group_${m.scope}`;
          }
          const cutoff = clearedSnap[convId];
          if (cutoff && m.createdAt <= cutoff) continue;
          (byConv[convId] ||= []).push(m);
        }

        const unreadInc: Record<string, number> = {};
        // Conv ids with brand-new additions — used to auto-unhide a chat
        // the user previously deleted "for me" the moment a fresh message
        // arrives, so important conversations can never go missing.
        const newAdditionsIn = new Set<string>();
        // Conversations that received a brand-new incoming message AND are
        // currently open on screen → auto-mark seen on the server so the
        // sender's ✓✓ updates without forcing the recipient to leave/reopen.
        const autoSeenScopes = new Set<string>();

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
              const isTombstoned = placeSnap.has(sm.id);
              if (old) {
                // Existing — flip ✓✓ when it just flipped, and replace
                // text with the deleted placeholder when the sender used
                // "delete for everyone" since the last sync.
                let nextOld: ChatMessage | null = null;
                if (seen && !old.seen) {
                  nextOld = { ...(nextOld ?? old), seen: true };
                }
                if ((sm.deletedForAll || isTombstoned) && !old.deletedForAll) {
                  nextOld = { ...(nextOld ?? old), text: "🚫 تم حذف الرسالة", deletedForAll: true };
                }
                if (nextOld) updatesById.set(sm.id, nextOld);
              } else {
                const cm: ChatMessage = {
                  id:     sm.id,
                  text:   (sm.deletedForAll || isTombstoned) ? "🚫 تم حذف الرسالة" : sm.text,
                  fromMe: isMine,
                  time:   formatTime(sm.createdAt),
                  seen,
                };
                if (sm.deletedForAll || isTombstoned) cm.deletedForAll = true;
                if (sm.giftId && !sm.deletedForAll) { cm.giftId = sm.giftId; cm.giftQty = sm.giftQty ?? 1; }
                if (!sm.deletedForAll && !isTombstoned) {
                  if (sm.imageUrl)      cm.imageUrl      = sm.imageUrl;
                  if (sm.videoUrl)      cm.videoUrl      = sm.videoUrl;
                  if (sm.audioUrl)      cm.audioUrl      = sm.audioUrl;
                  if (sm.mediaDuration) cm.mediaDuration = sm.mediaDuration;
                }
                if (!isMine) {
                  cm.senderId = sm.senderId;
                  const sender = registeredUsersRef.current.find(u => u.id === sm.senderId);
                  if (sender) {
                    cm.senderName = sender.name;
                    if (sender.avatar) cm.senderAvatar = sender.avatar;
                  }
                  if (activeConvRef.current === convId) {
                    // The user is reading this chat right now — don't bump
                    // the unread badge, and tell the server we've seen it.
                    autoSeenScopes.add(convId);
                  } else {
                    unreadInc[convId] = (unreadInc[convId] ?? 0) + 1;
                  }
                }
                additions.push(cm);
              }
            }
            if (updatesById.size === 0 && additions.length === 0) continue;
            if (additions.length > 0) newAdditionsIn.add(convId);
            const next = existing.map(m => updatesById.get(m.id) ?? m);
            merged[convId] = additions.length > 0 ? [...next, ...additions] : next;
          }
          return merged;
        });

        if (newAdditionsIn.size > 0) {
          setHiddenConvs(prev => {
            if (prev.size === 0) return prev;
            let changed = false;
            const next = new Set(prev);
            for (const id of newAdditionsIn) {
              if (next.delete(id)) changed = true;
            }
            return changed ? next : prev;
          });
        }

        if (Object.keys(unreadInc).length > 0) {
          setUnreadMap(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(unreadInc)) next[k] = (next[k] ?? 0) + v;
            return next;
          });
          // Notify on incoming: short receive chime (web) + light haptic
          // (native) so the user feels a new message arrive even when not
          // looking at the conversation. Skipped on the very first sync so
          // historical messages don't blast a chime on app launch / account
          // switch, and skipped when the message lands in the currently-open
          // chat (handled by autoSeenScopes above).
          if (!isFirstSync) {
            try { playReceiveMessageSound(); } catch { /* ignore */ }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
        for (const convId of autoSeenScopes) {
          let body: Record<string, string> | null = null;
          if (convId.startsWith("friend_")) {
            body = { userId: user.id, kind: "friend", otherId: convId.slice("friend_".length) };
          } else if (convId.startsWith("group_")) {
            body = { userId: user.id, kind: "group", groupId: convId.slice("group_".length) };
          }
          if (body) {
            fetch(`${API_BASE}/messages/seen`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).catch(() => {});
          }
        }
      } catch { /* network blip — try again next tick */ }
      finally { hasSynced = true; }
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

  /** Idempotently create / update the chat group bound to `community` and
   *  mirror it to every current member's storage so the group shows up in
   *  their Messages tab on next refresh. Pass `removedMemberIds` to also
   *  drop the group from people who just left/were kicked. */
  const syncCommunityGroup = useCallback(
    async (community: Community, removedMemberIds: string[] = []) => {
      if (!user) return;
      const gid = communityGroupId(community.id);
      const groupData: Group = {
        id: gid,
        name: community.name,
        members: [...community.members],
        createdBy: community.createdBy,
        createdAt: community.createdAt,
        communityId: community.id,
        ...(community.avatar ? { avatar: community.avatar } : {}),
      };

      if (community.members.includes(user.id)) {
        setGroups(prev => {
          const idx = prev.findIndex(g => g.id === gid);
          if (idx === -1) return [...prev, groupData];
          const next = [...prev];
          next[idx] = { ...next[idx], ...groupData };
          return next;
        });
      } else {
        setGroups(prev => prev.filter(g => g.id !== gid));
      }

      const tasks: Promise<void>[] = [];
      for (const mid of community.members) {
        if (mid === user.id) continue;
        tasks.push(writeGroupToUser(mid, groupData));
      }
      for (const mid of removedMemberIds) {
        tasks.push(removeGroupFromUser(mid, gid));
      }
      await Promise.all(tasks);
    },
    [user?.id],
  );

  /** Wipe the community-bound group entirely (used when the community is
   *  dissolved). Removes the group from every former member's storage and
   *  from the current user's in-memory list. */
  const dissolveCommunityGroup = useCallback(
    async (communityIdArg: string, formerMemberIds: string[]) => {
      const gid = communityGroupId(communityIdArg);
      setGroups(prev => prev.filter(g => g.id !== gid));
      await Promise.all(formerMemberIds.map(mid => removeGroupFromUser(mid, gid)));
    },
    [],
  );

  // Hide a whole conversation FOR ME ONLY. Sets a clearedAt cutoff so the
  // poll loop won't replay history, drops local cache + unread counter,
  // hides the row in the Messages tab, and (for groups) leaves my local
  // membership so the poll stops asking the server for it. Other devices
  // are completely unaffected.
  const deleteConversation = useCallback(async (convId: string) => {
    const now = new Date().toISOString();
    setClearedAt(prev => ({ ...prev, [convId]: now }));
    setHiddenConvs(prev => {
      if (prev.has(convId)) return prev;
      const next = new Set(prev);
      next.add(convId);
      return next;
    });
    setChats(prev => {
      if (!(convId in prev)) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    setUnreadMap(prev => {
      if (!(convId in prev)) return prev;
      const next = { ...prev };
      delete next[convId];
      return next;
    });
    if (convId.startsWith("group_")) {
      const gid = convId.slice("group_".length);
      setGroups(prev => prev.filter(g => g.id !== gid));
    }
  }, []);

  // Delete a single message. forMe = local only. forEveryone = sender-only,
  // tells the server to mark deletedForAll so every recipient renders the
  // placeholder on their next poll.
  // Mark someone else's message as deleted locally with a visible
   // placeholder. The other side is unaffected.
  const tombstoneMessage = useCallback(
    async (convId: string, msgId: string) => {
      setTombstonedMsgIds(prev => {
        if (prev.has(msgId)) return prev;
        const next = new Set(prev);
        next.add(msgId);
        return next;
      });
      setChats(prev => {
        const arr = prev[convId];
        if (!arr) return prev;
        let changed = false;
        const next = arr.map(m => {
          if (m.id !== msgId || m.deletedForAll) return m;
          changed = true;
          return { ...m, text: "🚫 تم حذف الرسالة", deletedForAll: true };
        });
        return changed ? { ...prev, [convId]: next } : prev;
      });
    },
    [],
  );

  const deleteMessage = useCallback(
    async (convId: string, msgId: string, mode: "forMe" | "forEveryone") => {
      if (mode === "forMe") {
        setDeletedMsgIds(prev => {
          if (prev.has(msgId)) return prev;
          const next = new Set(prev);
          next.add(msgId);
          return next;
        });
        setChats(prev => {
          const arr = prev[convId];
          if (!arr) return prev;
          const next = arr.filter(m => m.id !== msgId);
          if (next.length === arr.length) return prev;
          return { ...prev, [convId]: next };
        });
        return;
      }
      if (!user) return;
      setChats(prev => {
        const arr = prev[convId];
        if (!arr) return prev;
        return {
          ...prev,
          [convId]: arr.map(m =>
            m.id === msgId && m.fromMe
              ? { ...m, text: "🚫 تم حذف الرسالة", deletedForAll: true }
              : m,
          ),
        };
      });
      try {
        await fetch(`${API_BASE}/messages/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: msgId, senderId: user.id }),
        });
      } catch { /* will retry naturally on next user action */ }
    },
    [user?.id],
  );

  return (
    <Ctx.Provider value={{
      convList, chats, groups,
      markRead, appendMsg, markSeen, refreshChats, setActiveConv,
      getGroup, createGroup, updateGroup,
      addGroupMember, removeGroupMember, leaveGroup,
      syncCommunityGroup, dissolveCommunityGroup,
      deleteConversation, deleteMessage, tombstoneMessage,
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
