---
name: Copointo coins payment split (IAP vs OMPay)
description: Why buying coins uses Apple/Google IAP on native but OMPay on web, and the invariants that keeps Apple happy.
---

# Coins purchase = platform-split payment

Buying coins must use **Apple/Google In-App Purchase on iOS/Android** (App Store
guideline 3.1.1 — digital goods consumed in-app cannot use an outside processor),
while **web keeps the OMPay hosted card checkout**. The buy-coins screen branches
on `Platform.OS` at the single entry point and never lets the two paths mix.

**Why:** Apple rejected the app for selling coins through OMPay on iOS. They allow
external payment only for physical goods / real-world services, not in-app digital
currency. Web has no such rule, and OMPay (Oman) is the only card option there.

**How to apply (invariants — keep all of these true on any change):**
- Native code path must NEVER call the OMPay session APIs. Web path must NEVER
  call RevenueCat `purchasePackage`.
- Coins are **consumable** RevenueCat products (no entitlement). The coin amount
  is parsed from the package/product identifier `coins_<n>` — single-sourced in
  RevenueCat, seeded by `scripts/src/seedRevenueCat.ts`. Do not reintroduce a
  hardcoded coins↔price table.
- On native, the displayed price comes ONLY from the live store
  (`package.product.priceString`). If offerings haven't loaded, show a loading
  state and disable the tile — never fall back to a hardcoded USD/OMR price.
- A "Restore Purchases" affordance is required by the App Store; keep it on native.
- User-cancelled store sheet (`userCancelled`) is not an error and must not credit.
- RevenueCat is still `configure()`d on web (Browser/Test mode) but is never used
  to purchase there — harmless; don't "clean it up" by gating init off web.

# Web OMPay = full-page nav + client-side credit on return

The web buy-coins flow navigates the SAME tab straight to the OMPay hosted page
(`window.location.href = checkoutUrl`) — no new tab, interstitial, or popup
fallback. Because coins are stored on-device (AsyncStorage, `addCoins`), crediting
MUST happen client-side after the browser returns. Before navigating, persist a
`{paymentId, token, coins, ts}` marker to `localStorage` (key
`copointo:pendingCoinPayment`); pass `returnUrl = window.location.href` so OMPay
returns to the same screen, where a web-only mount `useEffect` resumes polling and
credits.

**Why:** the full-page redirect unmounts the screen, killing any in-flight poll;
the marker is the only recovery handle once we come back.

**How to apply:**
- Clear the marker ONLY on a terminal status (`paid`/`failed`/`canceled`). NEVER
  clear it on poll timeout — a slow/late OMPay confirmation must still auto-credit
  on the next mount. The marker self-expires after 1h in `loadPendingPayment`.
- Server `/payments/session` honours `body.returnUrl`; `creditOnce` is idempotent;
  the server re-confirms with OMPay before reporting `paid`, so client polling is
  trusted only as a trigger, not as proof of payment.
