---
name: Copointo loyalty/level award timing
description: When customer game level + drink progress is credited in the order lifecycle.
---

# Loyalty/level progress is awarded ONLY at invoice print

**Rule:** A customer's game level + drink progress (and free-coffee
milestones) are credited exclusively when the cashier PRINTS the invoice
(`POST /orders/:orderId/print` → `awardOrderProgress`). Confirming receipt
of the order / moving it out of "pending" (`PATCH /orders/:orderId/status`)
must NOT award anything — it only creates the invoice record.

**Why:** the cafe owner explicitly does not want confirmation alone to
advance the customer's level; progress should reflect a printed/finalised
order. (Earlier behaviour awarded at confirmation and was reverted.)

**How to apply:** keep `awardOrderProgress` idempotent (guards on
`order.pointsAwarded`) so reprints never double-credit. Both admin print
paths (official `printInvoice` and free-coffee `printAndRedeem`) call
`api.cafeOrderPrint`; the customer-copy receipt intentionally does NOT.
Direct in-cafe orders without a matched registered phone never award.

# Drink price threshold for leveling

**Rule:** Only drinks priced STRICTLY ABOVE 0.800 OMR per cup raise the
level / drink tally / free-coffee milestone. A cup at ≤ 0.800 counts for
nothing (level, totalOrders, and the every-7-drinks free coffee all share
the same tally, so excluding cheap cups excludes them from all three).

**Why:** cafe-owner product decision — cheap drinks must not let customers
farm levels.

**How to apply:** the gate lives in two mirrored spots and any NEW order or
progress path must replicate it: (1) server `awardOrderProgress` (authoritative,
fires at print) skips a line when its effective per-unit price ≤ 0.8; (2) client
`cart.tsx` `drinkQty` reduce requires unit price > 0.8 (this feeds
`activeOrder.drinkQty`, the order-timer `drinks` param, and `addCafeOrder`). Use
the effective per-unit price (already reflects size extras + discounts).

**Known gap:** `POST /users/progress` is client-authoritative (Math.max merge,
no server reconciliation) — part of the app-wide client-trusted-progress pattern
(see replit.md). The price gate is fully enforced for normal app usage, but a
hand-crafted request could still inflate progress. Real enforcement needs that
endpoint hardened — a separate, larger task; do not silently undertake it.
