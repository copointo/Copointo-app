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
//   • Signature: verifyPaymentSignature() checks the `signature` field as
//     HMAC-SHA256(clientSecret, `${orderId}|${paymentId}`) hex. Applied as
//     defence-in-depth on the Status Check response inside the confirm helper.
//
// What STILL needs the portal docs before going live:
//   • UAT test card details (to run an end-to-end sandbox payment).
//   • The four OMPAY_* secrets (module is dormant until then).
// The whole module is dormant (isOmpayConfigured() === false) until all four
// OMPAY_* secrets are set, so nothing here runs without credentials.

import crypto from "node:crypto";

export interface OmpayConfig {
  clientId: string;
  clientSecret: string;
  merchantId: string;
  webhookSecret?: string;
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
  // webhookSecret is optional: OMPay's Bank Hosted flow verifies signatures with
  // clientSecret (OMPAY_API_SECRET), so it is not required to activate the module.
  if (!clientId || !clientSecret || !merchantId) return null;
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

  // ✅ CONFIRMED: OMPay validates the mobile number as an 8-digit local Omani
  // number (no country code). Stored phones may carry a +968 / 968 prefix, so
  // strip non-digits and the country code down to the trailing 8 digits.
  const phoneDigits = String(input.customerPhone ?? "").replace(/\D+/g, "");
  const localPhoneRaw =
    phoneDigits.length > 8
      ? (phoneDigits.startsWith("968") ? phoneDigits.slice(3) : phoneDigits).slice(-8)
      : phoneDigits;
  // OMPay marks the mobile number as REQUIRED, so some flows (e.g. buying coins)
  // that don't collect a phone must still send a valid 8-digit Omani number.
  // Fall back to a stable placeholder when the account has no usable phone.
  const localPhone = localPhoneRaw.length === 8 ? localPhoneRaw : "90000000";

  // OMPay rejects non-Latin names ("Invalid name"), so keep only Latin letters /
  // spaces / basic punctuation; fall back when nothing usable remains (the app's
  // accounts are commonly Arabic-only or name-less).
  const latinName = (input.customerName ?? "").replace(/[^A-Za-z .'-]/g, "").trim();
  const name = latinName || "Copointo Customer";

  // Use the supplied email only if it's a plausible address; otherwise derive a
  // stable placeholder so OMPay's required-email validation always passes.
  const rawEmail = input.customerEmail?.trim() ?? "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
    ? rawEmail
    : localPhone
      ? `${localPhone}@copointo.app`
      : "guest@copointo.app";

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
      // OMPay requires a non-empty Latin name + a valid email + an 8-digit
      // Omani mobile (all sanitised above) so create-checkout never 400s on
      // Arabic-only / name-less / country-coded accounts.
      name,
      email,
      phone: localPhone || undefined,
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

/** Verify the `signature` field OMPay returns on status / webhook / redirect
 *  payloads (per the "Verify Payment Signature" doc):
 *    signature = HMAC-SHA256(clientSecret, `${orderId}|${paymentId}`) → hex
 *  compared in constant time. `clientSecret` is OMPAY_API_SECRET.
 *  Returns false when secrets or any input are missing, or on mismatch.
 *  Inputs are trimmed because OMPay's doc examples carry stray leading spaces;
 *  if UAT verification ever fails, the leading-space handling is the first
 *  thing to revisit. */
export function verifyPaymentSignature(
  orderId: string | undefined,
  paymentId: string | undefined,
  signature: string | undefined,
): boolean {
  const c = getOmpayConfig();
  if (!c || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", c.clientSecret)
    .update(`${String(orderId).trim()}|${String(paymentId).trim()}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature).trim());
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
