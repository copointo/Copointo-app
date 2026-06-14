---
name: Order-timer re-entry source of truth
description: Why app/order-timer.tsx must read from activeOrder context, not just nav params
---

The post-order waiting screen (`app/order-timer.tsx`) is reached from 3 places, and one of
them — the café `history.tsx` "active order" banner — pushes `/order-timer` with **NO params**.

**Rule:** order-timer must resolve orderId/cafeId/cafeName/minutes/drinks from nav params
FIRST, then fall back to the persisted `activeOrder` context. Polling must be guarded for
empty ids. Reading params-only silently breaks re-entry (no polling, blank rich UI).

**Why:** params don't survive the param-less history re-entry; `activeOrder` does.

**How to apply:** any rich receipt data (line items, total, pickup method/table/plate) lives
on the `ActiveOrder` snapshot (set in `cart.tsx` `setActiveOrder`), and order-timer should
only trust it when `activeOrder.orderId === effectiveOrderId`. Keep the fields optional so
older persisted active-orders still load.
