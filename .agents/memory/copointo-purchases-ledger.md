---
name: Copointo purchases ledger & cafe dues
description: copointoRedemptions is the single canonical ledger for EVERY coin purchase (code optional); how the super-admin store report and per-cafe monthly dues are derived from it.
---

# Copointo purchases ledger & cafe dues

## Single ledger for all coin purchases
`copointoRedemptions` is the ONE canonical record of every successful coin purchase — with OR without a Copointo referral code. Mobile `creditWithBonus` (buy-coins.tsx) logs to it on BOTH web and native after a successful charge.

- **Code optional.** `code`/`cafeId`/`cafeName` are nullable on the row. No code ⇒ commission 0, bonus 0; with code ⇒ +20% coin bonus and 10% cafe commission.
- **Idempotent via paymentRef.** Logging only happens when a payment ref exists (web=OMPay paymentId, native=RevenueCat transactionId) and the server dedupes globally on `platform+paymentRef` before insert. The pathological null-ref case intentionally skips logging — idempotency is required, so an un-dedupable purchase is not recorded. In practice every real purchase has a ref.
- **Why one ledger:** native IAP non-code purchases used to vanish (never logged). Funnelling all purchases through the same code-redeem endpoint means the super-admin "store purchases" view is complete and the per-cafe report stays correct because it filters by `cafeId` (code-less rows have `cafeId=null` so they don't pollute a cafe's report).

## Super-admin "Store Purchases" views (admin StorePurchasesPage)
Three views, all reading the ledger, all excluding `showcaseOnly` rows:
1. All purchases — profit = priceOmr − commission (full price when no code).
2. Per code-enabled cafe — its code purchases + accumulated commission due.
3. Per-cafe monthly dues + "تم الدفع" settle button.

## Cafe dues cycle math
- **Anchor = `copointoSettledAt || copointoCodeEnabledAt || createdAt`.** `copointoCodeEnabledAt` is stamped the first time a cafe's code is enabled (admin POST/PATCH /cafes), never overwritten on re-enable.
- `nextBill = anchor + 1 month`; `daysLeft = ceil((nextBill − now)/day)`; `overdue` when now ≥ nextBill.
- **Accumulated due** = sum of commission for that cafe's purchases since the anchor.
- **Settle** (`POST /admin/copointo-cafes/:id/settle`) sets `copointoSettledAt = now`, which moves the anchor forward and zeroes the accumulated due while keeping full purchase history.

## Auth caveat
These `/api/admin/*` financial+PII endpoints have NO server-side auth (same as `GET /admin/users` etc.) — only the admin custom-domain + super-admin password client gate. Only `/admin/wipe-everything` checks a `SESSION_SECRET` bearer. Tightening admin auth server-side is a known project-wide follow-up; do NOT bolt auth onto just the new routes (inconsistent).
