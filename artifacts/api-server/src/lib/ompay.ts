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
// What is CONFIRMED from the merchant docs ("Create an Order"):
//   • Create-order: POST {base}/nac/api/v1/pg/orders/create-checkout (Basic auth)
//     body { amount (MAJOR units, NOT baisa), currency, uiMode:"checkout",
//            receiptId, description, redirectType, customerFields:{name,email,phone} }
//     → success { orderId, status:"success", resCode:200, errMessage:"" }.
//
// What STILL needs the portal docs before going live:
//   • How to turn the returned orderId into the hosted-checkout redirect URL
//     (the "checkout form" / "pay by link" step) + return/redirect handling.
//   • The webhook payload shape + signature header/scheme.
// Those two spots are clearly marked below — they are the only places to
// touch when wiring real sandbox credentials. The whole module is dormant
// (isOmpayConfigured() === false) until all four OMPAY_* secrets are set,
// so nothing here runs in environments without credentials.

import crypto from "node:crypto";

export interface OmpayConfig {
  clientId: string;
  clientSecret: string;
  merchantId: string;
  webhookSecret: string;
  env: "sandbox" | "production";
  baseUrl: string;
}

/** Returns the resolved config, or null if any required secret is missing. */
export function getOmpayConfig(): OmpayConfig | null {
  const clientId = process.env.OMPAY_API_KEY;
  const clientSecret = process.env.OMPAY_API_SECRET;
  const merchantId = process.env.OMPAY_MERCHANT_ID;
  const webhookSecret = process.env.OMPAY_WEBHOOK_SECRET;
  if (!clientId || !clientSecret || !merchantId || !webhookSecret) return null;
  const env = process.env.OMPAY_ENV === "production" ? "production" : "sandbox";
  // Confirmed gateway hosts (sandbox === OMPay's UAT environment). The exact
  // Bank-Hosted endpoint PATH appended to this host is still a portal-confirm
  // seam (see createHostedCheckout below).
  const baseUrl =
    env === "production"
      ? "https://api.gateway.ompay.com"
      : "https://api.uat.gateway.ompay.com";
  return { clientId, clientSecret, merchantId, webhookSecret, env, baseUrl };
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

  // ⚠️ STILL NEEDED (CONFIRM-AGAINST-PORTAL): create-checkout returns only the
  // orderId — NOT the hosted-page URL. The doc says the orderId must be "passed
  // to the checkout", but the exact way to turn orderId → redirect URL (hosted
  // checkout form / pay-by-link endpoint) is not yet documented to us. Accept
  // an inline URL if the gateway returns one; otherwise fail loudly so we never
  // hand the client a bogus payment link.
  const checkoutUrl: string | undefined =
    json?.checkoutUrl ||
    json?.redirectUrl ||
    json?.paymentUrl ||
    json?.url ||
    json?.links?.redirect;
  if (!checkoutUrl) {
    throw new Error(
      "OMPAY_NO_CHECKOUT_URL: need the checkout-form / pay-by-link step (orderId → redirect URL)",
    );
  }

  return { checkoutUrl, providerSessionId: orderId, raw: json };
}

/** Verify an OMPay webhook signature.
 *  ⚠️ CONFIRM-AGAINST-PORTAL #2: header name + signature scheme. We default
 *  to HMAC-SHA256(rawBody, OMPAY_WEBHOOK_SECRET) compared in constant time,
 *  which is the common convention; adjust once the portal docs confirm. */
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
