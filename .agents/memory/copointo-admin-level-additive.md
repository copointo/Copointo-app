---
name: Admin level/progress edits are purely additive
description: Super-admin adjusting a user's level/drink count must NOT wipe coins, cosmetics, or free coffees.
---

# Admin progress-adjustment is purely additive

**Rule:** The super-admin "adjust progress" endpoint
(`POST /api/admin/users/:id/adjust-progress`, both "set" and legacy "delta"
modes) sets a user's level / per-cafe drink count and may AWARD milestone
free coffees, but must NEVER zero their coins, empty their owned cosmetics,
or delete their existing free coffees. Only the explicit
`POST /users/:id/wipe-earnings` route (the "تصفير كل الأرباح" button) is
allowed to wipe — keep `wipeUserEarnings` reachable from there alone.

**Why:** A super-admin increasing someone's level used to call
`wipeUserEarnings` on every edit, so leveling a user up silently wiped all
their coins, items, and free coffees. The cafe owner wants leveling to only
ADD rewards (new free coffee on crossing a 6-drink milestone, new
rank/cosmetics applied client-side by `useLevelRewards`).

**How to apply:** Level/orders changes reach the device via the
`progressAdjustments` record + `/progress-adjustments` poll, NOT via
`syncVersion`. Do NOT bump `syncVersion` on a level edit — `syncVersion`
exists only to push down coin/cosmetic edits (`set-coins` / `set-items`) and
bumping it ships the (now-unchanged) inventory snapshot down via
`reconcileInventory`, overwriting local AsyncStorage. If you ever need a
level edit to also change coins/items, do it through the dedicated
set-coins/set-items routes, not by reintroducing a wipe.
