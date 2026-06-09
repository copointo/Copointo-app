---
name: Cafe endpoints must replicate the showcase visibility guard
description: Any /cafes/:id/* route (and its mobile caller) must gate showcaseOnly cafes
---

# Showcase visibility must be enforced on every cafe sub-endpoint

Any server route under `/cafes/:id/...` that reads or writes cafe-scoped data
must replicate the same guard used by `GET /cafes/:id`:

`if (!cafe || (cafe.showcaseOnly && !isShowcaseViewer(userId))) -> 404`

where `userId` comes from the query (GET) or body (POST). Adding a new
cafe sub-endpoint WITHOUT this guard leaks/lets-write hidden showcase cafes
by direct ID — this was caught as a security FAIL when the cafe ratings
list/comment endpoints were first added.

**Mobile counterpart:** the client caller must pass
`?userId=${user.id}` on those GETs, or a legitimate **showcase viewer** gets a
false 404 on showcase cafes (the guard can't recognize them without the id).
Mirror the existing `/cafes/:id` and `/my-rating` call pattern.

**Why:** showcase rows are filtered from real users everywhere; a missing
guard on one endpoint breaks that invariant, and a missing client userId
breaks the showcase demo flow.
