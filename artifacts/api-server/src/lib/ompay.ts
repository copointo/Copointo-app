// ─── OMPay payment gateway adapter ──────────────────────────────────────
// Single integration seam for OMPay (Oman). Everything OMPay-specific lives
// here so the routes/store stay provider-agnostic.
//
// What is KNOWN-correct (from OMPay public docs):
//   • Auth is HTTP Basic: Base64(CLIENT_ID:CLIENT_SECRET).
//       CLIENT_ID     ← OMPAY_API_KEY
//       CLIENT_SECRET ← OMPAY_API_SECRET
//   • Base URLs: https://api.ompay.com/v1 (prod), https://api.sandbox.ompay.com/v1 (sandbox).
//   • Currency is OMR (3 decimals → amounts are sent in minor units / baisa, ×1000).
//   • A Hosted Payment Page (HPP) session is created server-side and returns
//     a URL the shopper is redirected to.
//
// What MUST be confirmed against the merchant portal before going live:
//   • The exact HPP create-session endpoint path + request body field names.
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
  const baseUrl =
    env === "production" ? "https://api.ompay.com/v1" : "https://api.sandbox.ompay.com/v1";
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
  const amountMinor = toMinorUnits(input.amount);

  // ⚠️ CONFIRM-AGAINST-PORTAL #1: exact endpoint + body for the HPP session.
  // Shaped to OMPay's documented HPP concept (amount/currency/reference +
  // redirect & webhook URLs). Adjust the path/field names here once verified
  // with sandbox credentials — this is the single place that needs editing.
  const url = `${c.baseUrl}/merchants/${c.merchantId}/payment`;
  const body = {
    intent: "sale",
    payment_method: { type: "hosted" },
    order: {
      amount: amountMinor,
      currency,
      reference: input.reference,
      description: input.description ?? input.reference,
    },
    customer: {
      name: input.customerName ?? undefined,
      email: input.customerEmail ?? undefined,
      phone: input.customerPhone ?? undefined,
    },
    redirect_url: input.returnUrl,
    webhook_url: input.webhookUrl,
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

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    throw new Error(`OMPAY_CREATE_FAILED: ${msg}`);
  }

  // Hosted-page URL is commonly returned under one of these keys; accept the
  // first present so a minor schema difference doesn't break the flow.
  const checkoutUrl: string | undefined =
    json?.redirect_url || json?.payment_url || json?.url || json?.links?.redirect;
  const providerSessionId: string =
    json?.id || json?.session_id || json?.payment_id || input.reference;

  if (!checkoutUrl) {
    throw new Error("OMPAY_NO_CHECKOUT_URL");
  }

  return { checkoutUrl, providerSessionId, raw: json };
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
