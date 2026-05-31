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
