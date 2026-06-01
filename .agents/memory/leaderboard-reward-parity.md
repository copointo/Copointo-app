---
name: Leaderboard reward / ranking parity
description: Any server-side ranking that pays out or mirrors the mobile leaderboard must use the identical comparator AND the identical visibility filters as /users/public.
---

# Leaderboard reward & ranking parity

When a reward (monthly season top-10 coins, etc.) is meant to "follow the
position shown in the mobile leaderboard", the server ranking and every client
rank map MUST agree on **two** things, or the reward lands on the wrong user:

1. **Same tiebreaker.** The visible leaderboard rows sort by
   `(totalOrders desc, hashId(id))` using an FNV-1a `hashId`. Any other rank
   computation (client reward-chip map, server payout, `/season/monthly`
   preview) must use the *same* FNV-1a hashId tiebreaker. `id.localeCompare`
   and `level desc` are NOT equivalent and cause the chip to land on a
   different row than the one that gets paid.

2. **Same population filter.** `/users/public` (routes/index.ts) hides
   `banned`, `gameBanned`, AND `showcaseOnly` users from normal viewers. A
   payout ranking that forgets `!showcaseOnly` will rank the seeded demo
   accounts (`copointo-showcase-user`, `sc-user-*`) into the paid top-10
   server-side while real users — who never see those rows — still display
   reward chips. In dev the DB is 100% showcaseOnly, so a correct season
   preview returns an EMPTY list there; that empty result is the proof the
   filter is applied, not a bug.

**Why:** these three rankings drifted independently and the season reward
"stuck" to users who had dropped out of the visible top-10.

**How to apply:** the FNV-1a hashId is duplicated in
`artifacts/copointo/app/leaderboard.tsx` and
`artifacts/api-server/src/lib/monthlySeason.ts` with no shared module — if you
touch either, keep them byte-for-byte identical (UTF-16 code units, `Math.imul`,
`>>> 0`). Consider a shared lib + parity test if this drifts again.
