---
name: Copointo Code settlement integrity
description: Trust rules for the per-cafe referral commission ledger (real OMR owed to cafes).
---

# Copointo Code (per-cafe referral) settlement integrity

The redeem flow writes a **money ledger** the cafe gets paid from (10% commission per
coin purchase made with their 3-char code). Unlike the rest of this client-trusting app
(coins are device-local, mock auth), this row is real OMR owed, so it must NOT trust
client math — and code review will reject anything that lets a client fabricate or
inflate commission.

**Rule 1 — money figures are server-authoritative, per platform.**
- Web: bind the redemption to a real `payments` row that is `purpose:"coins"` AND
  `status:"paid"`; take `priceOmr` from that record's `amount` (already verified against
  the OMPay-confirmed amount). Never the client's posted price.
- Native (store IAP): there is no server payment row and the coin balance is device-local
  by design, so derive `priceOmr` from the server-pinned coin-package table keyed by
  `coinsBase`; reject unknown packs. The package USD prices + USD→OMR rate are duplicated
  on the mobile side and MUST be changed in lockstep.
**Why:** otherwise a buyer posts an inflated price (web) or a bogus pack (native) and runs
up the platform's debt to a cafe.

**Rule 2 — one purchase settles exactly once, globally.** `paymentRef` is MANDATORY and
dedup is global (per platform+ref), not per cafe — so a replay, or an attempt to settle
the same purchase against a second cafe, returns the existing row instead of a second
commission.
**Why:** payment retries, late re-credits, reopened tabs, and cross-cafe replay would
double-count; client-side credit dedup does not protect the server ledger.

**Rule 3 — the cafe settlement report is an open read (like its sibling cafe-dashboard
GETs), so minimize PII in it.** Buyer phone is masked to its last 3 digits before leaving
the server. Route-level authz for cafe-dashboard reads is an app-wide mock-auth follow-up,
not specific to this endpoint.

**Known gap:** native store-receipt verification is NOT implemented anywhere in the app;
native redemptions rely on Rule 1's pack validation + Rule 2 idempotency only. Real
RevenueCat receipt verification is an app-wide hardening tracked separately.
