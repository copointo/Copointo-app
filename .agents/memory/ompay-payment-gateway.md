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
- Auth = HTTP Basic `Base64(CLIENT_ID:CLIENT_SECRET)` — CONFIRMED, already in `basicAuthHeader`. This is ALL our Bank Hosted calls need.
- ⚠️ The auth doc also shows `X-Signature`, `X-MERCHANT-BROWSER-FINGERPRINT`, `X-MERCHANT-USER-AGENT`, `X-MERCHANT-DOMAIN`, `X-MERCHANT-IP` headers + a "Card Encryption Key" → these are **Merchant Hosted ONLY** (the `/order` endpoint, in-app card collection). We chose Bank Hosted, so do NOT add them.
- Gateway base URLs: `https://api.gateway.ompay.com` (PROD), `https://api.uat.gateway.ompay.com` (UAT/sandbox). Selected via `OMPAY_ENV` (default sandbox→UAT). **NOTE: earlier code guessed `api.ompay.com/v1` — that was WRONG; the real host is the `*.gateway.ompay.com` API env. No `/v1` suffix is documented for Bank Hosted; the exact endpoint PATH is still unconfirmed.**
- Currency OMR has **3 decimals** → amounts sent in minor units (×1000 baisa). `toMinorUnits()` + server-side amount validation rejects >3-decimal values.

## ✅ CONFIRMED: Create-Order ("Create an Order" doc)
- `POST {base}/nac/api/v1/pg/orders/create-checkout`, HTTP Basic auth.
- Body: `amount` (**MAJOR units, e.g. 3.5 — NOT baisa/×1000**; generic doc example uses INR 500.00, "up to 2 decimals"), `currency`, `uiMode:"checkout"`, `receiptId` (our ref, ≤40 chars), `description`, `redirectType:"redirect"|"post"`, `customerFields:{name,email,phone}`.
- Response success: `{ orderId, amount, receiptId, status:"success", resCode:200, errMessage:"" }`; failure: `{ status:"failure", resCode:400, errMessage }`.
- **Gotcha:** create-checkout returns ONLY `orderId` — no hosted-page URL (the redirect URL is built client-side, see below).

## ✅ CONFIRMED: Checkout redirect ("Integrate Checkout" doc)
- Open in shopper browser: `{checkoutBase}/cpbs/pg?actionType=checkout&orderId={orderId}&redirectUrl={ourReturnUrl}&clientId={CLIENT_ID}`.
- **checkoutBase is a DIFFERENT host** (`merchant.*`, not `api.*`): `https://merchant.gateway.ompay.com` (PROD) / `https://merchant.uat.gateway.ompay.com` (UAT). `OmpayConfig.checkoutBaseUrl` holds it; `clientId`=OMPAY_API_KEY.
- Flow: create order (server) → redirect to checkout URL → shopper pays → redirected back to `redirectUrl` → **call Status Check API for final status**.

## ✅ CONFIRMED + WIRED: Status Check API ("Verify Payment Status" doc)
- `GET {apiBase}/nac/api/v1/pg/orders/check-status?orderId=..`, Basic auth.
- Response: `{ orderId, status:"success", paymentId, receiptId, amount, signature, timestamp, paymentDetails:{paymentMethod,cardNetwork,cardType} }`.
- `checkOrderStatus(orderId)` in `lib/ompay.ts`. The poll route `GET /api/payments/:id` now actively calls it when the payment is still pending + has a providerSessionId (the order's orderId) → flips status to paid/failed. This is the PRIMARY post-redirect confirmation; webhook is secondary. Amount-mismatch guard refuses to mark paid if confirmed amount ≠ created amount (tolerance 0.0005).
- Status-string sets shared as `SUCCESS_STATES` / `FAILED_STATES` consts in `routes/payments.ts` (used by both poll + webhook).

## ✅ CONFIRMED + WIRED: Webhook ("Handle Payment Success and Failure" doc)
- Webhook URL is configured OUT-OF-BAND during onboarding (we give OMPay our `{base}/api/payments/ompay/webhook`); NOT sent per-order in create-checkout.
- Payload (success & failure identical shape, only `status` differs): `{ orderId, paymentId, status:"success"|"failure", receiptId, amount, signature, timestamp, paymentDetails:{paymentMethod,cardNetwork,cardType} }`. NOTE: docs show stray leading spaces in `orderId`/`signature` values — we `.trim()` defensively.
- **Design decision (security):** webhook handler does NOT trust the payload's status/amount (signature scheme not yet verified). It matches the payment by `providerSessionId===orderId` OR `reference===receiptId`, then calls `confirmPaymentWithProvider()` which RE-FETCHES via Status Check API and applies paid/failed with the amount guard. → forged webhook is inert (unknown order = no OMPay call; known order only flips to OMPay's own check-status result). Shared helper `confirmPaymentWithProvider(p, log)` in `routes/payments.ts` is used by BOTH the poll route and the webhook.
- `verifyWebhookSignature` (HMAC-over-rawBody) is now UNUSED/placeholder — OMPay's signature is a payload FIELD, not an HMAC header. Kept in lib for when the JS signature doc lands (add as defence-in-depth, not gate).

## ⚠️ Remaining UNVERIFIED seams (need more portal docs + sandbox creds)
1. **Payment-response signature algorithm** ("Verify Payment Signature using JavaScript" doc) — to verify the `signature` field on status/webhook payloads. Currently we don't verify it; we rely on authenticated S2S Status Check re-fetch instead.
2. **Test card details** for UAT (doc not yet provided).
3. The 4 OMPAY_* secrets still unset → module dormant.

## Security/correctness notes baked in
- Raw body for webhook HMAC is captured via `express.json({ verify })` in `app.ts` → `req.rawBody`.
- Webhook URL is built from a **trusted** base (`PUBLIC_API_BASE_URL` → `REPLIT_DOMAINS` → `REPLIT_DEV_DOMAIN`), never from request host headers (spoofable).
- `GET /payments/:id` requires a per-payment capability `token` (returned once at create) — prevents id-enumeration without full auth.
- Webhook does `await flushNow()` before acking (durable status flip).
- `payments` rows carry PII + a metadata draft → hard-removed in `purgeUserData()`.

## Status
Server backbone only. Mobile wiring (cart.tsx orders, cafe/[id]/book.tsx bookings, buy-coins.tsx) NOT done yet — deferred pending credentials + UX sign-off (open hosted page in WebView/browser, poll status, then run existing flow).
