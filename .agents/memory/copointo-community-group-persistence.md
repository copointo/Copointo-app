---
name: Copointo community group chat persistence
description: Why the community→group reconcile must be additive-only and never poll-dissolve
---

# Community-bound group chats must never be removed by a background poll

The chat group bound to a community (`g_community_<communityId>` /
`group_<communityId>`) must NOT be dissolved/removed by the periodic
reconcile effect in `CommunityContext.tsx`. That effect is ADDITIVE-ONLY:
it may call `syncCommunityGroup` to add/update a group, but must never call
`dissolveCommunityGroup`.

**Why:** Cross-device group mirroring (`writeGroupToUser`/`removeGroupFromUser`
in `MessagesContext.tsx`) only writes to the LOCAL device's AsyncStorage —
it cannot reach other devices. So for non-creator members the bound group is
populated *and* removed solely by the 4s server-poll reconcile. When the poll
returned a stale/empty snapshot, the community briefly dropped out of
`myCommunities`, the reconcile auto-dissolved the group, and the whole
conversation + visible history disappeared. The user's hard requirement is
that NO message/conversation ever disappears on its own (between users, in a
group, or in a community).

**Accepted tradeoff (intended, not a bug):** a member kicked/removed from
another device keeps the past conversation visible locally instead of it
vanishing. The server is authoritative for posting, so a removed member
simply can't send new messages; they retain history. A code review will
flag this as a "gap" — it is deliberate per the user's directive. Do NOT
re-add poll-driven removal to "fix" it.

**How to apply:** Genuine removals are handled only by explicit user actions
(`leaveCommunity`, `removeMember`, last-member dissolve). If stale rows for
kicked users ever need cleanup, do it via a server-authoritative removal
signal (membership version / explicit removed event) — never by treating raw
poll-snapshot absence as a removal.
