---
name: Free-coffee ownership identity
description: Which phone identity validates free-coffee redemption ownership in copointo orders
---

# Free-coffee redemption ownership

A free coffee belongs to the signed-in ACCOUNT (the phone used to fetch/show the
codes, `GET /free-coffees?phone=user.phone`), NOT the contact phone the customer
types into the order form. The order endpoint must validate ownership against the
account identity the client sends as `freeCoffeeOwnerPhone` (fallback to
`customerPhone` for old clients).

**Why:** Validating ownership against the order-form `customerPhone` rejected
legitimate redemptions whenever the contact phone differed from the registration
phone — and it ALWAYS differs for the showcase login whose phone is the
non-numeric handle "Copointo" (normalizes to empty). The 403 aborted the whole
order.

**How to apply:** Match ownership with exact-OR-normalized-digit comparison so
non-numeric account handles (e.g. "Copointo") still match via the exact branch.
Keep the strict cafe-scope rule (`fc.earnedAtCafeId === cafeId`) and
award-at-print timing intact — those are intentional product rules, not bugs.
