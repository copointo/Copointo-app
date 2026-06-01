---
name: Copointo invoices browser data source
description: Why the cafe-dashboard "Printed Invoices" browser must read the persistent invoices collection, not live orders
---

The cafe-dashboard "Printed Invoices" browser must source rows from the
server-side `invoices` collection, NOT from the live `orders` collection.

**Why:** An invoice is finalised server-side the moment an order leaves
"pending", and the invoices collection SURVIVES the "بدء يوم جديد" (new day)
action that wipes the orders panel. Sourcing the browser from `orders` (e.g.
filtered by `printedAt`) makes every prior-day invoice silently disappear once a
new day is started, and also misses confirmed-but-not-printed orders. Users read
this as "not all daily invoices show up".

**How to apply:** Build the row list from every invoice, keyed by `orderId`, and
enrich each with its live order (matched by orderId) when it still exists — that
restores full phone/table/source/notes and a complete receipt. Fall back to the
invoice's own `customerName/items/total/createdAt` when the order was wiped. Use
a unified date (`order.printedAt ?? invoice.createdAt`) for day filtering, count,
and total so per-day accounting is complete. Note `order.type` (dine/car) and
`invoice.type` (order/booking) are different fields — keep them separate
(`invoiceType`) or the receipt renders a car/location fallback for bookings and
wiped orders.
