import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Community,
  CommunityInvite,
  CommunityRole,
  COMMUNITY_MIN_MEMBERS,
  COMMUNITY_MAX_MEMBERS,
  getCommunityRole,
} from "@/data/mockData";
import { useApp } from "@/context/AppContext";
import { useMessages } from "@/context/MessagesContext";
import { API_BASE } from "@/constants/api";

// AsyncStorage keys are kept as a per-user OFFLINE CACHE only. The server
// is the source of truth so cross-device invites and a global ranking
// actually work. The cache lets the UI paint immediately on cold start.
const cacheCommunitiesKey = (uid: string) => `copointo_communities_v2:${uid}`;
const cacheInvitesKey     = (uid: string) => `copointo_community_invites_v2:${uid}`;
const cacheAllKey         = "copointo_all_communities_v2";
// Local-only list of community IDs the user has voluntarily left.
// Used to surface a "rejoin" shortcut on the communities screen so the
// user doesn't have to wait for a fresh invite. Cleared per-id when the
// user actually rejoins (or the community no longer exists).
const cacheLeftKey        = (uid: string) => `copointo_left_communities_v1:${uid}`;

export type CommunityCreateResult =
  | { ok: true; community: Community }
  | { ok: false; error: string };

export type CommunityActionResult =
  | { ok: true }
  | { ok: false; error: string };

interface CommunityContextValue {
  /** Communities the current user is a confirmed member of. */
  myCommunities: Community[];
  /** The single community the user belongs to (or null). One per user. */
  myActiveCommunity: Community | null;
  /** Pending invitations for the current user. */
  incomingInvites: CommunityInvite[];

  /** Read-only lookup against the GLOBAL list (so any user can resolve any community by id). */
  getCommunity: (id: string) => Community | undefined;

  /** Sum of totalOrders across all members. */
  getCommunityScore: (id: string) => number;

  /** Every community in the system, sorted by score desc. Used for the
   *  leaderboard "communities" tab — visible to ALL users. */
  rankingList: Array<{ community: Community; score: number }>;

  createCommunity: (
    name: string,
    inviteUserIds: string[],
    avatar?: string,
  ) => Promise<CommunityCreateResult>;

  inviteToCommunity: (
    communityId: string,
    userIds: string[],
  ) => Promise<CommunityActionResult>;

  acceptInvite:  (communityId: string) => Promise<CommunityActionResult>;
  declineInvite: (communityId: string) => Promise<void>;

  leaveCommunity:  (communityId: string) => Promise<void>;
  /** Communities the user has voluntarily left (and that still exist + the user is not currently a member of). */
  leftCommunities: Community[];
  /** Re-add the user to a community they previously left. Subject to capacity & one-community rule. */
  rejoinCommunity: (communityId: string) => Promise<CommunityActionResult>;
  removeMember:    (communityId: string, userId: string) => Promise<CommunityActionResult>;
  updateCommunity: (
    communityId: string,
    patch: Partial<Pick<Community, "name" | "avatar">>,
  ) => Promise<CommunityActionResult>;

  setMemberRole: (
    communityId: string,
    userId: string,
    nextRole: CommunityRole,
  ) => Promise<CommunityActionResult>;

  /** Pull the latest server snapshot now. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<CommunityContextValue | undefined>(undefined);

/** Strip a userId from a roles map (return new map). */
function withoutUserRole(
  roles: Record<string, CommunityRole> | undefined,
  userId: string,
): Record<string, CommunityRole> {
  const next: Record<string, CommunityRole> = { ...(roles || {}) };
  delete next[userId];
  return next;
}

function findVice(c: Community): string | undefined {
  return c.members.find(m => getCommunityRole(c, m) === "vice");
}

/** Server I/O helpers — all swallow errors and return null on failure so
 *  the UI keeps showing the cached snapshot. */
async function serverSync(userId: string | undefined): Promise<{ communities: Community[]; invites: CommunityInvite[] } | null> {
  try {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`${API_BASE}/communities${qs}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      communities: Array.isArray(data?.communities) ? data.communities : [],
      invites:     Array.isArray(data?.invites)     ? data.invites     : [],
    };
  } catch { return null; }
}

async function serverPutCommunity(c: Community): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/communities/${encodeURIComponent(c.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    return res.ok;
  } catch { return false; }
}

async function serverDeleteCommunity(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/communities/${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch { return false; }
}

async function serverPostInvites(payload: {
  communityId: string;
  communityName: string;
  communityAvatar?: string;
  fromUserId: string;
  fromUserName: string;
  toUserIds: string[];
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/community-invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch { return false; }
}

async function serverDeleteInvite(communityId: string, userId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${API_BASE}/community-invites/${encodeURIComponent(communityId)}?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
    return res.ok;
  } catch { return false; }
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { user, registeredUsers } = useApp();
  const { syncCommunityGroup, dissolveCommunityGroup } = useMessages();

  const [allCommunities,  setAllCommunities]  = useState<Community[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<CommunityInvite[]>([]);
  const [leftIds,         setLeftIds]         = useState<string[]>([]);
  const [ready,           setReady]           = useState(false);

  // Hydrate from cache first (instant paint) then trigger a server sync.
  useEffect(() => {
    setReady(false);
    let cancelled = false;
    (async () => {
      try {
        const allRaw = await AsyncStorage.getItem(cacheAllKey);
        const cachedAll: Community[] = allRaw ? JSON.parse(allRaw) : [];
        let cachedInv: CommunityInvite[] = [];
        let cachedLeft: string[] = [];
        if (user) {
          const invRaw  = await AsyncStorage.getItem(cacheInvitesKey(user.id));
          cachedInv     = invRaw ? JSON.parse(invRaw) : [];
          const leftRaw = await AsyncStorage.getItem(cacheLeftKey(user.id));
          cachedLeft    = leftRaw ? JSON.parse(leftRaw) : [];
        }
        if (cancelled) return;
        setAllCommunities(cachedAll);
        setIncomingInvites(cachedInv);
        setLeftIds(cachedLeft);
      } catch { /* ignore cache errors */ }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Persist the left-list per user.
  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(cacheLeftKey(user.id), JSON.stringify(leftIds)).catch(() => {});
  }, [ready, leftIds, user?.id]);

  // Persist cache whenever state changes (after initial hydrate).
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(cacheAllKey, JSON.stringify(allCommunities)).catch(() => {});
    if (user) {
      const myList = allCommunities.filter(c => c.members.includes(user.id));
      AsyncStorage.setItem(cacheCommunitiesKey(user.id), JSON.stringify(myList)).catch(() => {});
    }
  }, [ready, allCommunities, user?.id]);

  useEffect(() => {
    if (!ready || !user) return;
    AsyncStorage.setItem(cacheInvitesKey(user.id), JSON.stringify(incomingInvites)).catch(() => {});
  }, [ready, incomingInvites, user?.id]);

  // Server poll — pulls global communities + my invites every 4s.
  const userIdRef = useRef<string | undefined>(user?.id);
  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);

  // Tracks community IDs that have an in-flight PUT to the server.
  // Refcount map handles overlapping PUTs on the same community safely.
  // While a community is pending, the periodic sync preserves the local
  // version for that community instead of overwriting it with stale server
  // data. Prevents the "avatar appears then disappears" race where the
  // 4s poll returns the pre-update snapshot before the upload completes.
  const pendingPutsRef = useRef<Map<string, number>>(new Map());
  const beginPending = (id: string) => {
    pendingPutsRef.current.set(id, (pendingPutsRef.current.get(id) ?? 0) + 1);
  };
  const endPending = (id: string) => {
    const n = (pendingPutsRef.current.get(id) ?? 0) - 1;
    if (n <= 0) pendingPutsRef.current.delete(id);
    else pendingPutsRef.current.set(id, n);
  };

  const sync = useCallback(async () => {
    const data = await serverSync(userIdRef.current);
    if (!data) return;
    if (pendingPutsRef.current.size === 0) {
      setAllCommunities(data.communities);
    } else {
      setAllCommunities(prev => {
        const pending = pendingPutsRef.current;
        const serverIds = new Set(data.communities.map(c => c.id));
        // Start from server snapshot, but preserve local copy for pending IDs.
        const merged = data.communities.map(serverC => {
          if (pending.has(serverC.id)) {
            const localC = prev.find(c => c.id === serverC.id);
            return localC ?? serverC;
          }
          return serverC;
        });
        // Re-add any local-only pending communities (e.g. optimistic creates
        // that the server snapshot does not yet include).
        for (const localC of prev) {
          if (pending.has(localC.id) && !serverIds.has(localC.id)) {
            merged.push(localC);
          }
        }
        return merged;
      });
    }
    setIncomingInvites(data.invites);
  }, []);

  useEffect(() => {
    if (!ready) return;
    sync();
    const t = setInterval(() => { sync(); }, 4000);
    return () => clearInterval(t);
  }, [ready, sync, user?.id]);

  /** Local optimistic upsert on the global list. */
  const upsertLocal = useCallback((c: Community) => {
    setAllCommunities(prev => {
      const i = prev.findIndex(x => x.id === c.id);
      if (i === -1) return [...prev, c];
      const next = prev.slice();
      next[i] = c;
      return next;
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    setAllCommunities(prev => prev.filter(c => c.id !== id));
  }, []);

  // Derived: communities the active user is a member of.
  const myCommunities = useMemo(
    () => (user ? allCommunities.filter(c => c.members.includes(user.id)) : []),
    [allCommunities, user?.id],
  );

  // ── Reconcile bound chat groups against the latest community snapshot.
  // The 4s server poll updates `allCommunities`, but it does not call the
  // local mutators. Without this effect, cross-device membership/name/avatar
  // changes would never reach the bound group on this device.
  const lastBoundSigRef = useRef<Map<string, string>>(new Map());
  const lastMyIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ready || !user) return;
    const prevIds = lastMyIdsRef.current;
    const sigs = lastBoundSigRef.current;
    const currentIds = new Set<string>();
    const allIds = new Set(allCommunities.map(c => c.id));

    for (const c of myCommunities) {
      currentIds.add(c.id);
      const sig = `${c.name}|${c.avatar ?? ""}|${[...c.members].sort().join(",")}|${Object.entries(c.roles ?? {}).sort().map(([k, v]) => `${k}:${v}`).join(",")}`;
      if (sigs.get(c.id) !== sig) {
        sigs.set(c.id, sig);
        syncCommunityGroup(c).catch(() => {});
      }
    }
    // Communities I am no longer a member of (left / kicked / dissolved).
    for (const oldId of prevIds) {
      if (!currentIds.has(oldId)) {
        sigs.delete(oldId);
        if (!allIds.has(oldId)) {
          // Fully gone server-side → dissolve for everyone we can reach.
          dissolveCommunityGroup(oldId, [user.id]).catch(() => {});
        } else {
          // Still exists but I'm no longer in it → drop it from my storage only.
          dissolveCommunityGroup(oldId, [user.id]).catch(() => {});
        }
      }
    }
    lastMyIdsRef.current = currentIds;
  }, [ready, user?.id, myCommunities, allCommunities, syncCommunityGroup, dissolveCommunityGroup]);

  /** ────────── createCommunity ────────── */
  const createCommunity = useCallback(
    async (name: string, inviteUserIds: string[], avatar?: string): Promise<CommunityCreateResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      if (myCommunities.length > 0) {
        return { ok: false, error: "أنت بالفعل في مجتمع. غادر المجتمع الحالي أولاً." };
      }
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: "اسم المجتمع مطلوب" };
      const projected = inviteUserIds.length + 1;
      if (projected < COMMUNITY_MIN_MEMBERS) {
        return { ok: false, error: `يجب اختيار ${COMMUNITY_MIN_MEMBERS - 1} عضو على الأقل` };
      }
      if (projected > COMMUNITY_MAX_MEMBERS) {
        return { ok: false, error: `الحد الأقصى ${COMMUNITY_MAX_MEMBERS} عضواً` };
      }

      const community: Community = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        avatar,
        members: [user.id],
        createdBy: user.id,
        createdAt: Date.now(),
        roles: { [user.id]: "leader" },
      };

      // Optimistic + push to server
      upsertLocal(community);
      beginPending(community.id);
      let ok = false;
      try {
        ok = await serverPutCommunity(community);
      } finally {
        endPending(community.id);
      }
      if (!ok) {
        // Rollback if the server didn't accept the new community.
        removeLocal(community.id);
        return { ok: false, error: "تعذر إنشاء المجتمع. حاول مجدداً." };
      }

      // Send invites via server (recipients pick them up on next poll).
      const targets = Array.from(new Set(inviteUserIds.filter(uid => uid && uid !== user.id)));
      if (targets.length > 0) {
        await serverPostInvites({
          communityId:     community.id,
          communityName:   community.name,
          communityAvatar: community.avatar,
          fromUserId:      user.id,
          fromUserName:    user.name,
          toUserIds:       targets,
        });
      }

      // Spin up the community-bound chat group and mirror it to invited
      // members (they'll see it the moment they accept and refresh).
      await syncCommunityGroup(community).catch(() => {});

      return { ok: true, community };
    },
    [user?.id, user?.name, myCommunities, upsertLocal, removeLocal, syncCommunityGroup],
  );

  /** ────────── inviteToCommunity ────────── */
  const inviteToCommunity = useCallback(
    async (communityId: string, userIds: string[]): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = allCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      const myRole = getCommunityRole(community, user.id);
      if (myRole !== "leader" && myRole !== "vice") {
        return { ok: false, error: "القائد أو القائد المساعد فقط يمكنه إرسال الدعوات" };
      }
      const targets = Array.from(new Set(userIds))
        .filter(uid => uid && uid !== user.id && !community.members.includes(uid));
      const projected = community.members.length + targets.length;
      if (projected > COMMUNITY_MAX_MEMBERS) {
        return { ok: false, error: `الحد الأقصى ${COMMUNITY_MAX_MEMBERS} عضواً` };
      }
      if (targets.length === 0) return { ok: true };
      const ok = await serverPostInvites({
        communityId:     community.id,
        communityName:   community.name,
        communityAvatar: community.avatar,
        fromUserId:      user.id,
        fromUserName:    user.name,
        toUserIds:       targets,
      });
      if (!ok) return { ok: false, error: "تعذر إرسال الدعوات. حاول مجدداً." };
      return { ok: true };
    },
    [user?.id, user?.name, allCommunities],
  );

  /** ────────── acceptInvite ────────── */
  const acceptInvite = useCallback(
    async (communityId: string): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      if (myCommunities.length > 0) {
        return { ok: false, error: "أنت بالفعل في مجتمع. غادر المجتمع الحالي أولاً لقبول دعوة جديدة." };
      }
      const invite = incomingInvites.find(i => i.communityId === communityId);
      if (!invite) return { ok: false, error: "الدعوة غير موجودة" };

      // Pull the latest server snapshot to grab the freshest community state.
      const snap = await serverSync(user.id);
      const liveAll = snap?.communities ?? allCommunities;
      const community = liveAll.find(c => c.id === communityId);
      if (!community) {
        await serverDeleteInvite(communityId, user.id);
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: false, error: "المجتمع لم يعد موجوداً" };
      }
      if (community.members.length >= COMMUNITY_MAX_MEMBERS) {
        await serverDeleteInvite(communityId, user.id);
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: false, error: "المجتمع ممتلئ" };
      }
      if (community.members.includes(user.id)) {
        await serverDeleteInvite(communityId, user.id);
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: true };
      }

      const updated: Community = {
        ...community,
        members: [...community.members, user.id],
        roles: { ...(community.roles || {}), [user.id]: "member" },
      };
      const ok = await serverPutCommunity(updated);
      if (!ok) return { ok: false, error: "تعذر قبول الدعوة. حاول مجدداً." };
      upsertLocal(updated);
      await serverDeleteInvite(communityId, user.id);
      setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
      // Add me to the community-bound chat group and mirror to all members.
      await syncCommunityGroup(updated).catch(() => {});
      return { ok: true };
    },
    [user?.id, incomingInvites, myCommunities, allCommunities, upsertLocal, syncCommunityGroup],
  );

  /** ────────── declineInvite ────────── */
  const declineInvite = useCallback(async (communityId: string) => {
    if (!user) return;
    setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
    await serverDeleteInvite(communityId, user.id);
  }, [user?.id]);

  /** ────────── leaveCommunity ────────── */
  const leaveCommunity = useCallback(
    async (communityId: string) => {
      if (!user) return;
      const community = allCommunities.find(c => c.id === communityId);
      if (!community || !community.members.includes(user.id)) return;
      const remaining = community.members.filter(m => m !== user.id);

      if (remaining.length === 0) {
        // Last member out — community has no one left, dissolve it.
        // Don't add to leftIds since the community no longer exists to rejoin.
        removeLocal(communityId);
        await serverDeleteCommunity(communityId);
        await dissolveCommunityGroup(communityId, community.members).catch(() => {});
        return;
      }
      // Remember this community so the user can re-enter quickly later.
      setLeftIds(prev => (prev.includes(communityId) ? prev : [...prev, communityId]));

      const leaverIsLeader = getCommunityRole(community, user.id) === "leader";
      const nextRoles = withoutUserRole(community.roles, user.id);
      let newCreator = community.createdBy;
      if (leaverIsLeader) {
        const vice = findVice(community);
        const promoted = (vice && remaining.includes(vice)) ? vice : remaining[0]!;
        nextRoles[promoted] = "leader";
        newCreator = promoted;
      }
      const updated: Community = {
        ...community,
        members: remaining,
        createdBy: newCreator,
        roles: nextRoles,
      };
      upsertLocal(updated);
      beginPending(communityId);
      let serverOk = false;
      try {
        serverOk = await serverPutCommunity(updated);
      } finally {
        endPending(communityId);
      }
      // Only mirror the bound-group change once the server has confirmed
      // the membership update — otherwise we'd desync from server truth.
      if (serverOk) {
        await syncCommunityGroup(updated, [user.id]).catch(() => {});
      }
    },
    [user?.id, allCommunities, upsertLocal, removeLocal, syncCommunityGroup, dissolveCommunityGroup],
  );

  /** ────────── rejoinCommunity ──────────
   *  Re-add the current user (as a regular member) to a community they
   *  previously left. Mirrors the "accept invite" path but without an invite. */
  const rejoinCommunity = useCallback(
    async (communityId: string): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      if (myCommunities.length > 0) {
        return { ok: false, error: "أنت بالفعل في مجتمع. غادر المجتمع الحالي أولاً." };
      }
      // Pull freshest snapshot to avoid acting on stale capacity / membership.
      const snap = await serverSync(user.id);
      const liveAll = snap?.communities ?? allCommunities;
      const community = liveAll.find(c => c.id === communityId);
      if (!community) {
        // Community no longer exists — drop it from the rejoin list.
        setLeftIds(prev => prev.filter(x => x !== communityId));
        return { ok: false, error: "المجتمع لم يعد موجوداً" };
      }
      if (community.members.length >= COMMUNITY_MAX_MEMBERS) {
        return { ok: false, error: "المجتمع ممتلئ" };
      }
      if (community.members.includes(user.id)) {
        setLeftIds(prev => prev.filter(x => x !== communityId));
        return { ok: true };
      }
      const updated: Community = {
        ...community,
        members: [...community.members, user.id],
        roles: { ...(community.roles || {}), [user.id]: "member" },
      };
      const ok = await serverPutCommunity(updated);
      if (!ok) return { ok: false, error: "تعذر الانضمام. حاول مجدداً." };
      upsertLocal(updated);
      setLeftIds(prev => prev.filter(x => x !== communityId));
      await syncCommunityGroup(updated).catch(() => {});
      return { ok: true };
    },
    [user?.id, myCommunities.length, allCommunities, upsertLocal, syncCommunityGroup],
  );

  /** ────────── removeMember (leader only) ────────── */
  const removeMember = useCallback(
    async (communityId: string, userId: string): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = allCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      if (getCommunityRole(community, user.id) !== "leader") {
        return { ok: false, error: "القائد فقط يمكنه إزالة الأعضاء" };
      }
      if (userId === user.id) {
        return { ok: false, error: "استخدم زر المغادرة" };
      }
      const remaining = community.members.filter(m => m !== userId);

      if (remaining.length < COMMUNITY_MIN_MEMBERS) {
        removeLocal(communityId);
        await serverDeleteCommunity(communityId);
        await dissolveCommunityGroup(communityId, community.members).catch(() => {});
        return { ok: true };
      }
      const updated: Community = {
        ...community,
        members: remaining,
        roles: withoutUserRole(community.roles, userId),
      };
      upsertLocal(updated);
      beginPending(communityId);
      try {
        const ok = await serverPutCommunity(updated);
        if (!ok) return { ok: false, error: "تعذر إزالة العضو. حاول مجدداً." };
        await syncCommunityGroup(updated, [userId]).catch(() => {});
        return { ok: true };
      } finally {
        endPending(communityId);
      }
    },
    [user?.id, allCommunities, upsertLocal, removeLocal, syncCommunityGroup, dissolveCommunityGroup],
  );

  /** ────────── setMemberRole ────────── */
  const setMemberRole = useCallback(
    async (
      communityId: string,
      userId: string,
      nextRole: CommunityRole,
    ): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = allCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      if (!community.members.includes(userId)) {
        return { ok: false, error: "العضو غير موجود" };
      }
      if (userId === user.id) {
        return { ok: false, error: "لا يمكنك تغيير رتبتك" };
      }

      const myRole     = getCommunityRole(community, user.id);
      const targetRole = getCommunityRole(community, userId);

      if (nextRole === targetRole) return { ok: true };
      if (nextRole === "leader") {
        return { ok: false, error: "لا يمكن تعيين قائد آخر" };
      }
      if (myRole === "leader") {
        if (targetRole === "leader") {
          return { ok: false, error: "لا يمكن تخفيض القائد" };
        }
      } else if (myRole === "vice") {
        // Vice can promote member → senior, and demote senior → member.
        // No other transitions allowed (cannot touch leader/vice ranks).
        const allowed =
          (targetRole === "member" && nextRole === "senior") ||
          (targetRole === "senior" && nextRole === "member");
        if (!allowed) {
          return { ok: false, error: "القائد المساعد يستطيع فقط ترقية الأعضاء إلى أعضاء كبار أو تخفيضهم" };
        }
      } else {
        return { ok: false, error: "لا تملك صلاحية تغيير الرتب" };
      }

      const newRoles: Record<string, CommunityRole> = { ...(community.roles || {}) };
      if (nextRole === "vice") {
        for (const m of community.members) {
          if (m !== userId && getCommunityRole(community, m) === "vice") {
            newRoles[m] = "senior";
          }
        }
      }
      newRoles[userId] = nextRole;

      const updated: Community = { ...community, roles: newRoles };
      upsertLocal(updated);
      beginPending(communityId);
      try {
        const ok = await serverPutCommunity(updated);
        if (!ok) return { ok: false, error: "تعذر تحديث الرتبة. حاول مجدداً." };
        return { ok: true };
      } finally {
        endPending(communityId);
      }
    },
    [user?.id, allCommunities, upsertLocal],
  );

  /** ────────── updateCommunity (leader only) ────────── */
  const updateCommunity = useCallback(
    async (
      communityId: string,
      patch: Partial<Pick<Community, "name" | "avatar">>,
    ): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = allCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      if (getCommunityRole(community, user.id) !== "leader") {
        return { ok: false, error: "القائد فقط يمكنه التعديل" };
      }
      const updated: Community = {
        ...community,
        ...(patch.name !== undefined ? { name: patch.name.trim() || community.name } : {}),
        ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
      };
      upsertLocal(updated);
      beginPending(communityId);
      try {
        const ok = await serverPutCommunity(updated);
        if (!ok) return { ok: false, error: "تعذر حفظ التعديلات. حاول مجدداً." };
        // Mirror the new name/avatar to the bound chat group so the
        // Messages list and conversation header stay in sync.
        await syncCommunityGroup(updated).catch(() => {});
        return { ok: true };
      } finally {
        endPending(communityId);
      }
    },
    [user?.id, allCommunities, upsertLocal, syncCommunityGroup],
  );

  const refresh = useCallback(async () => { await sync(); }, [sync]);

  /** ────────── derived: scores + ranking ────────── */
  const getCommunity = useCallback(
    (id: string) => allCommunities.find(c => c.id === id),
    [allCommunities],
  );

  const getCommunityScore = useCallback(
    (id: string) => {
      const c = allCommunities.find(x => x.id === id);
      if (!c) return 0;
      let sum = 0;
      for (const m of c.members) {
        const u = registeredUsers.find(x => x.id === m);
        if (u) sum += u.totalOrders ?? 0;
      }
      return sum;
    },
    [allCommunities, registeredUsers],
  );

  // Global ranking — every community in the system, visible to ALL users.
  const rankingList = useMemo(() => {
    return allCommunities
      .map(community => {
        let score = 0;
        for (const m of community.members) {
          const u = registeredUsers.find(x => x.id === m);
          if (u) score += u.totalOrders ?? 0;
        }
        return { community, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [allCommunities, registeredUsers]);

  const myActiveCommunity = myCommunities[0] ?? null;

  // Resolve left-ids → live Community objects, filtering out any that no
  // longer exist (dissolved) or that the user is somehow already in again.
  const leftCommunities = useMemo<Community[]>(() => {
    if (!user) return [];
    const myIds = new Set(myCommunities.map(c => c.id));
    return leftIds
      .map(id => allCommunities.find(c => c.id === id))
      .filter((c): c is Community => !!c && !myIds.has(c.id));
  }, [user?.id, leftIds, allCommunities, myCommunities]);

  // Garbage-collect leftIds whenever the underlying list of communities
  // changes — drop ids whose community has been dissolved.
  useEffect(() => {
    if (!ready) return;
    setLeftIds(prev => {
      const exists = new Set(allCommunities.map(c => c.id));
      const next = prev.filter(id => exists.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [ready, allCommunities]);

  const value: CommunityContextValue = {
    myCommunities,
    myActiveCommunity,
    incomingInvites,
    getCommunity,
    getCommunityScore,
    rankingList,
    createCommunity,
    inviteToCommunity,
    acceptInvite,
    declineInvite,
    leaveCommunity,
    leftCommunities,
    rejoinCommunity,
    removeMember,
    updateCommunity,
    setMemberRole,
    refresh,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCommunities(): CommunityContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCommunities must be used inside CommunityProvider");
  return v;
}
