---
name: Copointo Code settlement integrity
description: Why the per-cafe referral redeem endpoint derives price server-side and dedupes on a payment ref.
---

# Copointo Code (per-cafe referral) settlement integrity

The redeem endpoint (`POST /api/copointo-code/redeem`) writes a **money ledger** the
cafe gets paid from (10% commission per coin purchase made with their 3-char code).
Unlike the rest of this client-trusting app (coins are device-local, mock auth), this
row is real OMR owed, so it must NOT trust client math.

**Rule 1 — price is server-authoritative.** Commission base (`priceOmr`) is derived from
a server-pinned coin-package table, keyed by `coinsBase`, NOT from the client's posted
`priceOmr`. An unknown `coinsBase` is rejected. The package USD prices + USD→OMR rate are
duplicated server-side and MUST mirror the mobile `PACKS` + `USD_TO_OMR`; change both sides
together.
**Why:** a buyer could otherwise post an inflated `priceOmr` and run up the platform's debt
to a cafe.

**Rule 2 — one purchase settles once (idempotency).** Redeem dedupes on a client-supplied
`paymentRef` (OMPay paymentId on web, store transactionId on native) per cafe; a replay
returns the existing row (`deduped:true`) instead of appending a second commission.
**Why:** payment retries, late-confirmation re-credits, and reopened web tabs would otherwise
double-count. Client-side credit dedup alone does not protect the server ledger.
**How to apply:** native transactionId can be null (then only client dedup applies); web
always has a paymentId. Keep `paymentRef` flowing from `creditWithBonus`'s dedupeKey.
