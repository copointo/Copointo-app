---
name: OMPay payment gateway
description: How online payments (OMPay, Oman) are wired in the api-server, and the unverified seams that need real credentials.
---

# OMPay payment gateway

There is NO Replit integration/connector for OMPay (only Stripe exists). OMPay is integrated manually against its REST API.

## Architecture decisions
- **Provider-agnostic backbone + isolated adapter.** All OMPay HTTP specifics live in `artifacts/api-server/src/lib/ompay.ts`. Routes (`routes/payments.ts`, mounted `/api/payments`) and the `Payment` store model stay provider-neutral.
- **Fully gated behind 4 secrets** (`OMPAY_API_KEY`=client_id, `OMPAY_API_SECRET`=client_secret, `OMPAY_MERCHANT_ID`, `OMPAY_WEBHOOK_SECRET`). When any is unset, `isOmpayConfigured()` is false and `/session` + `/webhook` return explicit `503 PAYMENTS_NOT_CONFIGURED` (NO silent mock). Nothing calls OMPay in environments without credentials.
- **Client-driven fulfilment.** Server payment is only a *gate*: client creates a session → opens hosted `checkoutUrl` → polls `GET /payments/:id?token=...` → on `status:"paid"` runs the app's existing order/booking/coins flow. The webhook is the authoritative status flip. This avoids duplicating the complex order/loyalty/invoice logic on the server and matches the app's existing client-driven (mock-auth) pattern.
  - **Why:** order creation (loyalty award, invoice sync, stock decrement) is large and lives in the cafe-dashboard router; re-implementing it in a webhook would drift. Coins are credited client-side via AsyncStorage anyway.

## Known-correct OMPay facts (from public docs)
- Auth = HTTP Basic `Base64(CLIENT_ID:CLIENT_SECRET)`.
- Base URLs: `https://api.ompay.com/v1` (prod), `https://api.sandbox.ompay.com/v1` (sandbox). Selected via `OMPAY_ENV` (default sandbox).
- Currency OMR has **3 decimals** → amounts sent in minor units (×1000 baisa). `toMinorUnits()` + server-side amount validation rejects >3-decimal values.

## ⚠️ Two UNVERIFIED seams (need merchant-portal docs + sandbox creds)
Both are clearly commented `CONFIRM-AGAINST-PORTAL` in `lib/ompay.ts` / `routes/payments.ts`:
1. Exact Hosted-Payment-Page create endpoint path + request body field names (currently `POST /merchants/{mid}/payment` with a best-interpretation body; response checkoutUrl/id read from several candidate keys).
2. Webhook signature header name + scheme (defaults to `HMAC-SHA256(rawBody, webhookSecret)` hex, constant-time compared) and the webhook payload field names for reference + status.

## Security/correctness notes baked in
- Raw body for webhook HMAC is captured via `express.json({ verify })` in `app.ts` → `req.rawBody`.
- Webhook URL is built from a **trusted** base (`PUBLIC_API_BASE_URL` → `REPLIT_DOMAINS` → `REPLIT_DEV_DOMAIN`), never from request host headers (spoofable).
- `GET /payments/:id` requires a per-payment capability `token` (returned once at create) — prevents id-enumeration without full auth.
- Webhook does `await flushNow()` before acking (durable status flip).
- `payments` rows carry PII + a metadata draft → hard-removed in `purgeUserData()`.

## Status
Server backbone only. Mobile wiring (cart.tsx orders, cafe/[id]/book.tsx bookings, buy-coins.tsx) NOT done yet — deferred pending credentials + UX sign-off (open hosted page in WebView/browser, poll status, then run existing flow).
