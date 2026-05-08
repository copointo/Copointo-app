import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

const communitiesKey = (uid: string) => `copointo_communities_v1:${uid}`;
const invitesKey     = (uid: string) => `copointo_community_invites_v1:${uid}`;

export type CommunityCreateResult =
  | { ok: true; community: Community }
  | { ok: false; error: string };

export type CommunityActionResult =
  | { ok: true }
  | { ok: false; error: string };

interface CommunityContextValue {
  /** Communities the current user is a confirmed member of (mirrored from creator). */
  myCommunities: Community[];
  /** The single community the user belongs to (or null). A user can only be in ONE. */
  myActiveCommunity: Community | null;
  /** Pending invitations for the current user. */
  incomingInvites: CommunityInvite[];

  /** Read-only lookup. */
  getCommunity: (id: string) => Community | undefined;

  /** Sum of totalOrders across all members. */
  getCommunityScore: (id: string) => number;

  /** All communities visible to the current user (their own + ones they were ever
   *  invited to / are part of), sorted by score desc. Used for the ranking screen. */
  rankingList: Array<{ community: Community; score: number }>;

  /** Mutators */
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
  removeMember:    (communityId: string, userId: string) => Promise<CommunityActionResult>;
  updateCommunity: (
    communityId: string,
    patch: Partial<Pick<Community, "name" | "avatar">>,
  ) => Promise<CommunityActionResult>;

  /** Promote / demote a member. Permission rules enforced server-side here. */
  setMemberRole: (
    communityId: string,
    userId: string,
    nextRole: CommunityRole,
  ) => Promise<CommunityActionResult>;

  /** Re-read storage to pick up cross-user changes. */
  refresh: () => Promise<void>;
}

const Ctx = createContext<CommunityContextValue | undefined>(undefined);

/** Helpers for cross-user storage writes. */
async function readCommunities(uid: string): Promise<Community[]> {
  try {
    const raw = await AsyncStorage.getItem(communitiesKey(uid));
    return raw ? (JSON.parse(raw) as Community[]) : [];
  } catch { return []; }
}
async function writeCommunities(uid: string, list: Community[]): Promise<void> {
  try { await AsyncStorage.setItem(communitiesKey(uid), JSON.stringify(list)); } catch {}
}
async function readInvites(uid: string): Promise<CommunityInvite[]> {
  try {
    const raw = await AsyncStorage.getItem(invitesKey(uid));
    return raw ? (JSON.parse(raw) as CommunityInvite[]) : [];
  } catch { return []; }
}
async function writeInvites(uid: string, list: CommunityInvite[]): Promise<void> {
  try { await AsyncStorage.setItem(invitesKey(uid), JSON.stringify(list)); } catch {}
}

/** Upsert a community into a user's mirrored list (replace if same id). */
function upsertCommunity(list: Community[], c: Community): Community[] {
  const i = list.findIndex(x => x.id === c.id);
  if (i === -1) return [...list, c];
  const next = [...list];
  next[i] = c;
  return next;
}

/** Strip a userId from a roles map (return new map). */
function withoutUserRole(
  roles: Record<string, CommunityRole> | undefined,
  userId: string,
): Record<string, CommunityRole> {
  const next: Record<string, CommunityRole> = { ...(roles || {}) };
  delete next[userId];
  return next;
}

/** Find the unique vice (or undefined). */
function findVice(c: Community): string | undefined {
  return c.members.find(m => getCommunityRole(c, m) === "vice");
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { user, registeredUsers } = useApp();

  const [myCommunities, setMyCommunities]   = useState<Community[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<CommunityInvite[]>([]);
  const [ready, setReady] = useState(false);

  // Reset on user change & load this user's data.
  // Cancellation guard prevents installing a stale read into a newly-active user's state.
  useEffect(() => {
    setReady(false);
    if (!user) {
      setMyCommunities([]);
      setIncomingInvites([]);
      return;
    }
    let cancelled = false;
    const uid = user.id;
    (async () => {
      const [comms, invs] = await Promise.all([
        readCommunities(uid),
        readInvites(uid),
      ]);
      if (cancelled) return;
      setMyCommunities(comms);
      setIncomingInvites(invs);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Persist on change (only after initial load to avoid wiping)
  useEffect(() => {
    if (!user || !ready) return;
    writeCommunities(user.id, myCommunities);
  }, [user?.id, ready, myCommunities]);

  useEffect(() => {
    if (!user || !ready) return;
    writeInvites(user.id, incomingInvites);
  }, [user?.id, ready, incomingInvites]);

  /** Persist a patched community to every member's mirror (and to local state if I'm a member). */
  const propagate = useCallback(async (community: Community) => {
    // Local mirror
    if (user && community.members.includes(user.id)) {
      setMyCommunities(prev => upsertCommunity(prev, community));
    }
    // Other members' mirrors via direct AsyncStorage write
    const targets = community.members.filter(m => m !== user?.id);
    for (const uid of targets) {
      const existing = await readCommunities(uid);
      const next = upsertCommunity(existing, community);
      await writeCommunities(uid, next);
    }
  }, [user?.id]);

  /** Remove a community from a single user's mirror. */
  const removeFromUser = useCallback(async (uid: string, communityId: string) => {
    if (uid === user?.id) {
      setMyCommunities(prev => prev.filter(c => c.id !== communityId));
    } else {
      const existing = await readCommunities(uid);
      await writeCommunities(uid, existing.filter(c => c.id !== communityId));
    }
  }, [user?.id]);

  /** ────────── createCommunity ────────── */
  const createCommunity = useCallback(
    async (name: string, inviteUserIds: string[], avatar?: string): Promise<CommunityCreateResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      if (myCommunities.length > 0) {
        return { ok: false, error: "أنت بالفعل في مجتمع. غادر المجتمع الحالي أولاً." };
      }
      const trimmed = name.trim();
      if (!trimmed) return { ok: false, error: "اسم المجتمع مطلوب" };
      // Final size after everyone accepts. Creator counts as a member.
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
        members: [user.id], // creator joins immediately; invitees join on accept
        createdBy: user.id,
        createdAt: Date.now(),
        roles: { [user.id]: "leader" },
      };

      // Save locally
      setMyCommunities(prev => upsertCommunity(prev, community));

      // Send invites to the chosen users
      const invite: Omit<CommunityInvite, "communityId"> = {
        communityName: community.name,
        communityAvatar: community.avatar,
        fromUserId: user.id,
        fromUserName: user.name,
        invitedAt: Date.now(),
      };
      for (const uid of inviteUserIds) {
        const existing = await readInvites(uid);
        // Skip duplicate invite for same community
        if (existing.some(i => i.communityId === community.id)) continue;
        await writeInvites(uid, [
          ...existing,
          { ...invite, communityId: community.id },
        ]);
      }

      return { ok: true, community };
    },
    [user?.id, user?.name, myCommunities],
  );

  /** ────────── inviteToCommunity (add later) — leader/vice can invite ────────── */
  const inviteToCommunity = useCallback(
    async (communityId: string, userIds: string[]): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = myCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      const myRole = getCommunityRole(community, user.id);
      if (myRole !== "leader" && myRole !== "vice") {
        return { ok: false, error: "القائد أو القائد المساعد فقط يمكنه إرسال الدعوات" };
      }

      // Dedupe input + drop existing members FIRST, then check the cap.
      const targets = Array.from(new Set(userIds))
        .filter(uid => !community.members.includes(uid));

      const projected = community.members.length + targets.length;
      if (projected > COMMUNITY_MAX_MEMBERS) {
        return { ok: false, error: `الحد الأقصى ${COMMUNITY_MAX_MEMBERS} عضواً` };
      }
      const invite: Omit<CommunityInvite, "communityId"> = {
        communityName: community.name,
        communityAvatar: community.avatar,
        fromUserId: user.id,
        fromUserName: user.name,
        invitedAt: Date.now(),
      };
      for (const uid of targets) {
        const existing = await readInvites(uid);
        // Skip if there's already a pending invite for this community
        if (existing.some(i => i.communityId === community.id)) continue;
        await writeInvites(uid, [
          ...existing,
          { ...invite, communityId: community.id },
        ]);
      }
      return { ok: true };
    },
    [user?.id, user?.name, myCommunities],
  );

  /** ────────── acceptInvite ────────── */
  const acceptInvite = useCallback(
    async (communityId: string): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      // One-community-per-user rule
      if (myCommunities.length > 0) {
        return { ok: false, error: "أنت بالفعل في مجتمع. غادر المجتمع الحالي أولاً لقبول دعوة جديدة." };
      }
      const invite = incomingInvites.find(i => i.communityId === communityId);
      if (!invite) return { ok: false, error: "الدعوة غير موجودة" };

      // Find the freshest community by checking the inviter first, then any
      // other registered user's mirror. This survives the inviter leaving
      // and creator promotion to another member.
      const candidates = [
        invite.fromUserId,
        ...registeredUsers.map(u => u.id).filter(uid => uid !== invite.fromUserId),
      ];
      let community: Community | undefined;
      for (const uid of candidates) {
        const list = await readCommunities(uid);
        const found = list.find(c => c.id === communityId);
        if (found) {
          // Pick the version with the most members (latest known state)
          if (!community || found.members.length > community.members.length) {
            community = found;
          }
        }
      }

      if (!community) {
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: false, error: "المجتمع لم يعد موجوداً" };
      }
      if (community.members.length >= COMMUNITY_MAX_MEMBERS) {
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: false, error: "المجتمع ممتلئ" };
      }
      if (community.members.includes(user.id)) {
        // Already a member somehow — just clear the invite
        setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
        return { ok: true };
      }

      const updated: Community = {
        ...community,
        members: [...community.members, user.id],
        roles: { ...(community.roles || {}), [user.id]: "member" },
      };
      // Mirror to all members (including me, via local state)
      await propagate(updated);
      // Remove the invite locally
      setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
      return { ok: true };
    },
    [user?.id, incomingInvites, propagate, registeredUsers, myCommunities],
  );

  /** ────────── declineInvite ────────── */
  const declineInvite = useCallback(async (communityId: string) => {
    setIncomingInvites(prev => prev.filter(i => i.communityId !== communityId));
  }, []);

  /** ────────── leaveCommunity ────────── */
  const leaveCommunity = useCallback(
    async (communityId: string) => {
      if (!user) return;
      const community = myCommunities.find(c => c.id === communityId);
      if (!community) return;
      const remaining = community.members.filter(m => m !== user.id);

      if (remaining.length < COMMUNITY_MIN_MEMBERS) {
        // Below the minimum (≤1 member) → dissolve the community across every mirror
        for (const uid of remaining) {
          await removeFromUser(uid, communityId);
        }
        await removeFromUser(user.id, communityId);
        return;
      }

      // If the leader leaves, promote vice (if any) → leader, otherwise oldest remaining member.
      const leaverIsLeader = getCommunityRole(community, user.id) === "leader";
      let nextRoles = withoutUserRole(community.roles, user.id);
      let newCreator = community.createdBy;
      if (leaverIsLeader) {
        const vice = findVice(community);
        const promoted = vice && remaining.includes(vice) ? vice : remaining[0];
        nextRoles[promoted] = "leader";
        newCreator = promoted;
      }
      const updated: Community = {
        ...community,
        members: remaining,
        createdBy: newCreator,
        roles: nextRoles,
      };
      // Update mirrors for remaining members
      for (const uid of remaining) {
        const existing = await readCommunities(uid);
        await writeCommunities(uid, upsertCommunity(existing, updated));
      }
      // Drop from my own list
      await removeFromUser(user.id, communityId);
    },
    [user?.id, myCommunities, removeFromUser],
  );

  /** ────────── removeMember (leader only) ────────── */
  const removeMember = useCallback(
    async (communityId: string, userId: string): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = myCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      if (getCommunityRole(community, user.id) !== "leader") {
        return { ok: false, error: "القائد فقط يمكنه إزالة الأعضاء" };
      }
      if (userId === user.id) {
        return { ok: false, error: "استخدم زر المغادرة" };
      }
      const remaining = community.members.filter(m => m !== userId);

      if (remaining.length < COMMUNITY_MIN_MEMBERS) {
        // Removing this member would put us below the minimum → dissolve everywhere
        for (const uid of remaining) {
          await removeFromUser(uid, communityId);
        }
        await removeFromUser(userId, communityId);
        await removeFromUser(user.id, communityId);
        return { ok: true };
      }

      const updated: Community = {
        ...community,
        members: remaining,
        roles: withoutUserRole(community.roles, userId),
      };
      // Update remaining mirrors
      for (const uid of remaining) {
        const existing = await readCommunities(uid);
        await writeCommunities(uid, upsertCommunity(existing, updated));
      }
      // Remove community from the kicked user's mirror
      await removeFromUser(userId, communityId);
      // Update local state
      setMyCommunities(prev => upsertCommunity(prev, updated));
      return { ok: true };
    },
    [user?.id, myCommunities, removeFromUser],
  );

  /** ────────── setMemberRole ────────── */
  const setMemberRole = useCallback(
    async (
      communityId: string,
      userId: string,
      nextRole: CommunityRole,
    ): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = myCommunities.find(c => c.id === communityId);
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

      // Permission matrix
      if (myRole === "leader") {
        // Leader can set member ↔ senior ↔ vice (cap one vice).
        if (targetRole === "leader") {
          return { ok: false, error: "لا يمكن تخفيض القائد" };
        }
      } else if (myRole === "vice") {
        // Vice can ONLY promote member → senior.
        if (!(targetRole === "member" && nextRole === "senior")) {
          return { ok: false, error: "القائد المساعد يستطيع فقط ترقية الأعضاء إلى أعضاء كبار" };
        }
      } else {
        return { ok: false, error: "لا تملك صلاحية تغيير الرتب" };
      }

      // Build new roles map
      const newRoles: Record<string, CommunityRole> = { ...(community.roles || {}) };

      // If promoting to vice, demote any existing vice → senior (only one vice).
      if (nextRole === "vice") {
        for (const m of community.members) {
          if (m !== userId && getCommunityRole(community, m) === "vice") {
            newRoles[m] = "senior";
          }
        }
      }
      newRoles[userId] = nextRole;

      const updated: Community = { ...community, roles: newRoles };
      await propagate(updated);
      return { ok: true };
    },
    [user?.id, myCommunities, propagate],
  );

  /** ────────── updateCommunity (leader only) ────────── */
  const updateCommunity = useCallback(
    async (
      communityId: string,
      patch: Partial<Pick<Community, "name" | "avatar">>,
    ): Promise<CommunityActionResult> => {
      if (!user) return { ok: false, error: "غير مسجل دخول" };
      const community = myCommunities.find(c => c.id === communityId);
      if (!community) return { ok: false, error: "المجتمع غير موجود" };
      if (getCommunityRole(community, user.id) !== "leader") {
        return { ok: false, error: "القائد فقط يمكنه التعديل" };
      }
      const updated: Community = {
        ...community,
        ...(patch.name !== undefined ? { name: patch.name.trim() || community.name } : {}),
        ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
      };
      await propagate(updated);
      return { ok: true };
    },
    [user?.id, myCommunities, propagate],
  );

  /** ────────── refresh ────────── */
  const refresh = useCallback(async () => {
    if (!user) return;
    const [comms, invs] = await Promise.all([
      readCommunities(user.id),
      readInvites(user.id),
    ]);
    setMyCommunities(comms);
    setIncomingInvites(invs);
  }, [user?.id]);

  /** ────────── derived: scores + ranking ────────── */
  const getCommunity = useCallback(
    (id: string) => myCommunities.find(c => c.id === id),
    [myCommunities],
  );

  const getCommunityScore = useCallback(
    (id: string) => {
      const c = myCommunities.find(x => x.id === id);
      if (!c) return 0;
      let sum = 0;
      for (const m of c.members) {
        const u = registeredUsers.find(x => x.id === m);
        if (u) sum += u.totalOrders ?? 0;
      }
      return sum;
    },
    [myCommunities, registeredUsers],
  );

  const rankingList = useMemo(() => {
    return myCommunities
      .map(community => {
        let score = 0;
        for (const m of community.members) {
          const u = registeredUsers.find(x => x.id === m);
          if (u) score += u.totalOrders ?? 0;
        }
        return { community, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [myCommunities, registeredUsers]);

  const myActiveCommunity = myCommunities[0] ?? null;

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
