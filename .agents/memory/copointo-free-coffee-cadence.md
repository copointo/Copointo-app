---
name: Copointo free-coffee cadence is duplicated across surfaces
description: Where the "free coffee every N drinks" rule lives and what must change together
---

# Changing the free-coffee reward cadence touches many files

The "free coffee every N qualifying drinks/levels" rule is NOT centralized in
one shared constant — it is duplicated across server, admin, mobile, and copy.
Changing the cadence (e.g. every-7 → every-6) means updating ALL of:

- **Server award (source of truth):** `awardMilestoneCoffees` in
  `api-server/.../cafe-dashboard.ts` — the `floor(total/N)` gate and
  `earnedAtLevel = (i+1)*N`.
- **Admin award gates:** BOTH the delta-mode and set-mode milestone gates in
  `api-server/.../admin.ts` (`floor(totalOrders/N)`).
- **Mobile:** `copointo/app/(tabs)/game.tsx` — level-ladder marker
  (`lvl % N === 0`) and in-cycle progress (`level % N`, `N - …`).
- **Counts/copy:** profile free-coffee count (`floor(total/N)`), the AR hint
  strings (Arabic numeral, e.g. ٧/٦), and i18n `ranks.footer` (AR **and** EN).
- **Admin UI:** cashier tooltip in `admin/.../CafeDashboardPage.tsx`.

**Why:** these surfaces were caught only on a second review pass; missing one
leaves the reward logic and the displayed promise out of sync.

**Beware a false friend:** `DRINKS_PER_LEVEL = 7` in admin.ts / AppContext.tsx
/ UsersPage.tsx is the admin level↔totalOrders **coupling ratio**, NOT the
free-coffee cadence. Do not change it when changing the reward cadence.

**Existing-data safety:** the award gate is count-based (already-issued codes
vs `floor(total/N)`), so changing N never duplicates old codes — users only get
catch-up codes when their total crosses new multiples of the smaller N.
