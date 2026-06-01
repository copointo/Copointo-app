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

## Chosen model: BANK HOSTED
User picked "recommend best" → Bank Hosted (redirect to OMPay's hosted checkout page; card data never touches our servers; avoids PCI scope). Merchant Hosted (in-app card form, base path `/nac/api/v1/merchant-host`) was rejected as overkill for a coffee app.

## Known-correct OMPay facts (from official docs)
- Auth = HTTP Basic `Base64(CLIENT_ID:CLIENT_SECRET)`.
- Gateway base URLs: `https://api.gateway.ompay.com` (PROD), `https://api.uat.gateway.ompay.com` (UAT/sandbox). Selected via `OMPAY_ENV` (default sandbox→UAT). **NOTE: earlier code guessed `api.ompay.com/v1` — that was WRONG; the real host is the `*.gateway.ompay.com` API env. No `/v1` suffix is documented for Bank Hosted; the exact endpoint PATH is still unconfirmed.**
- Currency OMR has **3 decimals** → amounts sent in minor units (×1000 baisa). `toMinorUnits()` + server-side amount validation rejects >3-decimal values.

## ✅ CONFIRMED: Create-Order ("Create an Order" doc)
- `POST {base}/nac/api/v1/pg/orders/create-checkout`, HTTP Basic auth.
- Body: `amount` (**MAJOR units, e.g. 3.5 — NOT baisa/×1000**; generic doc example uses INR 500.00, "up to 2 decimals"), `currency`, `uiMode:"checkout"`, `receiptId` (our ref, ≤40 chars), `description`, `redirectType:"redirect"|"post"`, `customerFields:{name,email,phone}`.
- Response success: `{ orderId, amount, receiptId, status:"success", resCode:200, errMessage:"" }`; failure: `{ status:"failure", resCode:400, errMessage }`.
- **Gotcha:** create-checkout returns ONLY `orderId` — no hosted-page URL. Doc says orderId "should be passed to the checkout". The orderId→redirect-URL step (checkout form / pay-by-link) is STILL not documented to us; `createHostedCheckout` throws `OMPAY_NO_CHECKOUT_URL` if no inline URL is present.

## ⚠️ Remaining UNVERIFIED seams (need more portal docs + sandbox creds)
Commented `CONFIRM-AGAINST-PORTAL` in `lib/ompay.ts` / `routes/payments.ts`:
1. Orphan: how to turn the returned `orderId` into the hosted-checkout redirect URL (the "checkout form" / "pay by link" step) + return/redirect handling.
2. Webhook signature header name + scheme (defaults to `HMAC-SHA256(rawBody, webhookSecret)` hex, constant-time compared) and the webhook payload field names for reference + status.

## Security/correctness notes baked in
- Raw body for webhook HMAC is captured via `express.json({ verify })` in `app.ts` → `req.rawBody`.
- Webhook URL is built from a **trusted** base (`PUBLIC_API_BASE_URL` → `REPLIT_DOMAINS` → `REPLIT_DEV_DOMAIN`), never from request host headers (spoofable).
- `GET /payments/:id` requires a per-payment capability `token` (returned once at create) — prevents id-enumeration without full auth.
- Webhook does `await flushNow()` before acking (durable status flip).
- `payments` rows carry PII + a metadata draft → hard-removed in `purgeUserData()`.

## Status
Server backbone only. Mobile wiring (cart.tsx orders, cafe/[id]/book.tsx bookings, buy-coins.tsx) NOT done yet — deferred pending credentials + UX sign-off (open hosted page in WebView/browser, poll status, then run existing flow).
