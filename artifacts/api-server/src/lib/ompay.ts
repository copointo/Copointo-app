// ─── OMPay payment gateway adapter ──────────────────────────────────────
// Single integration seam for OMPay (Oman). Everything OMPay-specific lives
// here so the routes/store stay provider-agnostic.
//
// Chosen model: BANK HOSTED — the shopper is redirected to OMPay's secure
// hosted checkout page to enter their card, then returned to us. Card data
// never touches our servers (keeps us out of heavy PCI scope).
//
// What is KNOWN-correct (from OMPay official docs):
//   • Auth is HTTP Basic: Base64(CLIENT_ID:CLIENT_SECRET).
//       CLIENT_ID     ← OMPAY_API_KEY
//       CLIENT_SECRET ← OMPAY_API_SECRET
//   • Gateway base URLs: https://api.gateway.ompay.com (PROD),
//     https://api.uat.gateway.ompay.com (UAT / sandbox).
//   • Currency is OMR (3 decimals → amounts are sent in minor units / baisa, ×1000).
//   • A Hosted Payment Page (HPP) session is created server-side and returns
//     a URL the shopper is redirected to.
//
// What is CONFIRMED from the merchant docs:
//   • Create-order: POST {apiBase}/nac/api/v1/pg/orders/create-checkout (Basic auth)
//     body { amount (MAJOR units, NOT baisa), currency, uiMode:"checkout",
//            receiptId, description, redirectType, customerFields:{name,email,phone} }
//     → success { orderId, status:"success", resCode:200, errMessage:"" }.
//   • Checkout redirect (open this in the shopper's browser):
//       {checkoutBase}/cpbs/pg?actionType=checkout&orderId={orderId}
//         &redirectUrl={ourReturnUrl}&clientId={CLIENT_ID}
//     checkoutBase = https://merchant.gateway.ompay.com (PROD)
//                  / https://merchant.uat.gateway.ompay.com (UAT).
//
//   • Status check: GET {apiBase}/nac/api/v1/pg/orders/check-status?orderId=..
//     (Basic auth) → { orderId, status, paymentId, receiptId, amount,
//                      signature, timestamp, paymentDetails }.
//   • Webhook (configured out-of-band during onboarding) POSTs:
//     { orderId, paymentId, status:"success"|"failure", receiptId, amount,
//       signature, timestamp, paymentDetails }.
//
// What STILL needs the portal docs before going live:
//   • The payment-response SIGNATURE algorithm (to verify the `signature` field
//     returned on status/redirect/webhook) — "Verify Payment Signature" doc.
//     Until then we don't trust webhook payloads: the webhook handler re-confirms
//     every event via the authenticated Status Check API, so a forged webhook is
//     inert. (The status check itself is trusted as an authenticated S2S call.)
// The whole module is dormant (isOmpayConfigured() === false) until all four
// OMPAY_* secrets are set, so nothing here runs without credentials.

import crypto from "node:crypto";

export interface OmpayConfig {
  clientId: string;
  clientSecret: string;
  merchantId: string;
  webhookSecret: string;
  env: "sandbox" | "production";
  baseUrl: string;        // API host (create-order etc.)
  checkoutBaseUrl: string; // merchant host (shopper redirect)
}

/** Returns the resolved config, or null if any required secret is missing. */
export function getOmpayConfig(): OmpayConfig | null {
  const clientId = process.env.OMPAY_API_KEY;
  const clientSecret = process.env.OMPAY_API_SECRET;
  const merchantId = process.env.OMPAY_MERCHANT_ID;
  const webhookSecret = process.env.OMPAY_WEBHOOK_SECRET;
  if (!clientId || !clientSecret || !merchantId || !webhookSecret) return null;
  const env = process.env.OMPAY_ENV === "production" ? "production" : "sandbox";
  // Confirmed gateway hosts (sandbox === OMPay's UAT environment).
  const baseUrl =
    env === "production"
      ? "https://api.gateway.ompay.com"
      : "https://api.uat.gateway.ompay.com";
  // The shopper-facing checkout lives on the "merchant" host, not the API host.
  const checkoutBaseUrl =
    env === "production"
      ? "https://merchant.gateway.ompay.com"
      : "https://merchant.uat.gateway.ompay.com";
  return { clientId, clientSecret, merchantId, webhookSecret, env, baseUrl, checkoutBaseUrl };
}

export function isOmpayConfigured(): boolean {
  return getOmpayConfig() !== null;
}

function basicAuthHeader(c: OmpayConfig): string {
  return "Basic " + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64");
}

/** OMR has 3 decimal places → API expects minor units (baisa). 3.5 → 3500. */
export function toMinorUnits(amountOmr: number): number {
  return Math.round(Number(amountOmr) * 1000);
}

export interface CreateCheckoutInput {
  amount: number;        // OMR major units
  currency?: string;     // default "OMR"
  reference: string;     // our merchant reference (Payment.reference)
  description?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl: string;     // browser lands here after the hosted page
  webhookUrl: string;    // OMPay calls this server-to-server on completion
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  providerSessionId: string;
  raw: unknown;
}

/** Create an OMPay Hosted Payment Page session and return the redirect URL.
 *  Throws on any non-2xx or missing secrets. */
export async function createHostedCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const c = getOmpayConfig();
  if (!c) throw new Error("OMPAY_NOT_CONFIGURED");

  const currency = input.currency ?? "OMR";
  // ✅ CONFIRMED: OMPay create-checkout expects the amount in MAJOR units
  // (e.g. 3.5), NOT minor/baisa. (The generic doc example uses INR 500.00.)
  const amount = Number(input.amount);

  // ✅ CONFIRMED endpoint + body (OMPay "Create an Order" / Bank Hosted).
  const url = `${c.baseUrl}/nac/api/v1/pg/orders/create-checkout`;
  const body = {
    amount,
    currency,
    uiMode: "checkout",
    receiptId: input.reference, // our merchant reference (≤40 chars)
    description: input.description ?? input.reference,
    redirectType: "redirect",
    customerFields: {
      name: input.customerName ?? undefined,
      email: input.customerEmail ?? undefined,
      phone: input.customerPhone ?? undefined,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(c),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response handled below */
  }

  // ✅ CONFIRMED response shape:
  //   success → { orderId, amount, receiptId, status:"success", resCode:200, errMessage:"" }
  //   failure → { receiptId, status:"failure", resCode:400, errMessage:"..." }
  const ok =
    res.ok && json?.status === "success" && Number(json?.resCode) === 200 && !!json?.orderId;
  if (!ok) {
    const msg = json?.errMessage || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`OMPAY_CREATE_FAILED: ${msg}`);
  }

  const orderId: string = String(json.orderId);

  // ✅ CONFIRMED: build the shopper redirect URL on the "merchant" host. OMPay
  // hosts the card form there; after payment it sends the shopper back to our
  // `redirectUrl` (input.returnUrl), where the client then calls our poll/status
  // flow. `clientId` = OMPAY_API_KEY.
  const checkoutUrl =
    `${c.checkoutBaseUrl}/cpbs/pg?actionType=checkout` +
    `&orderId=${encodeURIComponent(orderId)}` +
    `&redirectUrl=${encodeURIComponent(input.returnUrl)}` +
    `&clientId=${encodeURIComponent(c.clientId)}`;

  return { checkoutUrl, providerSessionId: orderId, raw: json };
}

export interface OrderStatusResult {
  orderId: string;
  status: string;          // normalised lower-case: "success" | "failure" | ...
  paymentId?: string;
  receiptId?: string;
  amount?: number;         // MAJOR units, as returned by OMPay
  signature?: string;      // verify once the signature-algorithm doc lands
  timestamp?: string;
  paymentDetails?: unknown;
  raw: unknown;
}

/** Server-to-server status check for a previously created order (Bank Hosted).
 *  GET {apiBase}/nac/api/v1/pg/orders/check-status?orderId=.. (Basic auth).
 *  Throws on missing secrets / non-2xx / unparseable response. */
export async function checkOrderStatus(orderId: string): Promise<OrderStatusResult> {
  const c = getOmpayConfig();
  if (!c) throw new Error("OMPAY_NOT_CONFIGURED");

  const url =
    `${c.baseUrl}/nac/api/v1/pg/orders/check-status?orderId=${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(c),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* handled below */
  }

  if (!res.ok || !json) {
    const msg = json?.errMessage || json?.message || text || `HTTP ${res.status}`;
    throw new Error(`OMPAY_STATUS_FAILED: ${msg}`);
  }

  return {
    orderId: String(json.orderId ?? orderId),
    status: String(json.status ?? "").toLowerCase(),
    paymentId: json.paymentId,
    receiptId: json.receiptId,
    amount: typeof json.amount === "number" ? json.amount : Number(json.amount) || undefined,
    signature: json.signature,
    timestamp: json.timestamp,
    paymentDetails: json.paymentDetails,
    raw: json,
  };
}

/** Placeholder HMAC verifier — NOT currently wired. OMPay's real signature is a
 *  `signature` FIELD inside the payload (see the upcoming "Verify Payment
 *  Signature" doc), not an HMAC header — so the webhook handler instead
 *  re-confirms each event via checkOrderStatus(). Kept for when the signature
 *  algorithm lands so we can add payload-signature verification as
 *  defence-in-depth. HMAC-SHA256(rawBody, OMPAY_WEBHOOK_SECRET), constant-time. */
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  const c = getOmpayConfig();
  if (!c || !signature) return false;
  const expected = crypto
    .createHmac("sha256", c.webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
