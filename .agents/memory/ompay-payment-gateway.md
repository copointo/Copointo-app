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
## ✅ CONFIRMED + WIRED: Signature verification ("Verify Payment Signature using JavaScript" doc)
- `signature = HMAC-SHA256(key=clientSecret, data=`${orderId}|${paymentId}`)` → hex. key is OMPAY_API_SECRET (clientSecret); separator is a literal pipe `|`; paymentId comes from the success/failure (status) response.
- `verifyPaymentSignature(orderId, paymentId, signature)` in `lib/ompay.ts` (constant-time compare, trims inputs — doc examples have stray leading spaces). REPLACED the old wrong `verifyWebhookSignature` (which assumed HMAC-over-rawBody with webhookSecret).
- Wired as defence-in-depth INSIDE `confirmPaymentWithProvider()`: after `checkOrderStatus`, if the response carries a `signature`, verify it and **fail-closed** (skip the status flip, log error) on mismatch. Genuine events re-verify on the next poll tick. Note OMPAY_WEBHOOK_SECRET is now effectively unused by the signature path (kept as a configured secret / future use).

## ✅ CONFIRMED via live UAT: create-checkout customerFields are ALL required + validated
- `customerFields.name` (required), `.email` (required), `.phone` (required) — OMPay 400s if any is missing/blank.
- `name` must be **Latin** — Arabic-only names → `"Invalid name"`. `phone` must be the **8-digit local Omani** number (no country code) — `96890000000` → `"Invalid mobile number"`, `90000000` works.
- The adapter sanitises before sending: strip name to Latin (`[^A-Za-z .'-]`) else fall back `"Copointo Customer"`; validate email regex else derive `${localPhone}@copointo.app`; strip phone to trailing 8 digits (drop `+968`/`968`). Mock-auth accounts are phone-only / Arabic-named, so these fallbacks are load-bearing, not edge cases.
- **Phone fallback is MANDATORY for phone-less flows.** Buy-coins sends NO phone → OMPay 400s `"customerFields.phone" is required` → the hosted gateway never opens. Fix: when no usable 8-digit phone, the adapter substitutes a placeholder `"90000000"` so create-checkout always succeeds. Any new flow that calls `createHostedCheckout` without a phone relies on this.
- **check-status returns a FAILED-state status for a freshly-created, not-yet-paid order.** So the client must NOT poll while the shopper is still on the hosted page on native — it polls only AFTER the WebView hits `/payments/return`. On web (checkout in a separate tab, navigation unobservable) the poller is started immediately but runs with `abortOnFailure=false` so a transient "failed" doesn't abort; it waits for "paid" or the 4-min deadline.

## ⚠️ "Payment page doesn't open" had TWO client-side causes (both fixed)
- **Client fetch timeout too short.** The mobile API client's shared 12s `REQUEST_TIMEOUT_MS` aborted the slow create-checkout (UAT ~30-40s) → `request aborted, statusCode:null, responseTime:11998` in server logs, app got an error, no checkoutUrl. Fix: payment calls (create-session + status poll) pass a separate `PAYMENT_TIMEOUT_MS` (60s). **Why:** OMPay create + check-status are far slower than our own endpoints; don't lengthen the global timeout (chat freeze guard depends on it).
- **Web popup blocked + slow-prep UX.** `window.open(checkoutUrl)` ran AFTER `await createPaymentSession` → no longer in the click gesture → silently blocked. **Final fix:** on the pack tap, synchronously `window.open("about:blank","_blank")` FIRST (inside the gesture), write `CHECKOUT_LOADING_HTML` (RTL amber spinner page) into it, THEN `await createPaymentSession` in the background, then `win.location.href = checkoutUrl` to redirect the already-open tab + start polling. Tab appears instantly so the ~40s OMPay create latency happens *inside* the opened tab, not as a blocking in-app overlay (user explicitly complained the prep wait was too long). Fallback: if `win` is null/closed (popup blocked), show the explicit "ادفع الآن" tap-to-open modal (`openWebCheckout`, which also same-tab-navigates if its `window.open` returns null). **Why:** programmatic popups not tied to a direct click are blocked; opening synchronously in the gesture is the only dependable trigger, and pre-opening with a loading page hides the slow session-create. Native uses the in-app WebView modal, unaffected.

## ⚠️ Remaining seams
1. Creds are **UAT** — production go-live needs PROD OMPAY_* creds + OMPay-side webhook URL registration (`{base}/api/payments/ompay/webhook`) during onboarding.
2. Orders (cart.tsx) + bookings (cafe/[id]/book.tsx) payment NOT wired — by user's scope decision these stay OPTIONAL alongside cash, to be added later. Only buy-coins is wired.
3. UAT check-status latency is high (seen ~30-40s/call); production may differ. The verifying overlay + 3s poll interval absorb it.

## Security/correctness notes baked in
- Raw body for webhook HMAC is captured via `express.json({ verify })` in `app.ts` → `req.rawBody`.
- Webhook URL is built from a **trusted** base (`PUBLIC_API_BASE_URL` → `REPLIT_DOMAINS` → `REPLIT_DEV_DOMAIN`), never from request host headers (spoofable).
- `GET /payments/:id` requires a per-payment capability `token` (returned once at create) — prevents id-enumeration without full auth.
- Webhook does `await flushNow()` before acking (durable status flip).
- `payments` rows carry PII + a metadata draft → hard-removed in `purgeUserData()`.

## Status
Live on UAT. Buy-coins is fully wired end-to-end (mobile `app/buy-coins.tsx` → hosted checkout in WebView/new tab → poll → client credits coins via `creditOnce` idempotency guard). Orders + bookings payment intentionally NOT wired yet (will be OPTIONAL alongside cash). buy-coins pack prices are **displayed in USD** (0.99–99.99) but **converted to OMR** before being sent to OMPay via `USD_TO_OMR` rate (0.384) + `usdToOmr()` in `buy-coins.tsx` (so $0.99 → 0.380 ﷼ at checkout); tiles show a small "≈ X.XXX ﷼" hint. Rate is a single editable constant — update it if the peg/markup changes.
