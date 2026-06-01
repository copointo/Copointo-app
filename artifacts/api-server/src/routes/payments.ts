// ─── Online payments (OMPay) ────────────────────────────────────────────
// Provider-agnostic payment gating endpoints. All OMPay HTTP specifics live
// in ../lib/ompay. Mounted at /api/payments.
//
//   POST /api/payments/session        → create a hosted-checkout session
//   GET  /api/payments/:id?token=...  → poll status (client waits for "paid")
//   POST /api/payments/ompay/webhook  → OMPay server-to-server confirmation
//
// Flow: the client creates a session, opens `checkoutUrl` (OMPay hosted page),
// then polls GET /:id with the capability `token` from the create response.
// The webhook is the authoritative source of truth that flips status to
// "paid"/"failed". Fulfilment (creating the order/booking or crediting coins)
// is driven by the client AFTER it sees "paid", matching the app's existing
// client-driven order/booking flow.

import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import { payments, flushNow, type Payment, type PaymentPurpose } from "../store";
import {
  isOmpayConfigured,
  createHostedCheckout,
  checkOrderStatus,
  verifyPaymentSignature,
  toMinorUnits,
} from "../lib/ompay";

const SUCCESS_STATES = ["paid", "captured", "success", "successful", "completed", "approved"];
const FAILED_STATES = ["failed", "declined", "error", "canceled", "cancelled", "voided", "failure"];

const router: IRouter = Router();

const VALID_PURPOSES: PaymentPurpose[] = ["order", "booking", "coins"];

function newPaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Trusted public base URL for the server-to-server webhook. Never derived
 *  from request headers (host/x-forwarded-host are spoofable). */
function getPublicApiBaseUrl(): string | null {
  const explicit = process.env.PUBLIC_API_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (prod) return `https://${prod}`;
  const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (dev) return `https://${dev}`;
  return null;
}

function publicPayment(p: Payment) {
  // Never leak the capture metadata or the access token back to readers.
  return {
    id: p.id,
    reference: p.reference,
    purpose: p.purpose,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    checkoutUrl: p.checkoutUrl ?? null,
    resultOrderId: p.resultOrderId ?? null,
    resultBookingId: p.resultBookingId ?? null,
    coinsCredited: p.coinsCredited ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    paidAt: p.paidAt ?? null,
  };
}

/** Authoritatively confirm a still-pending payment against OMPay's Status Check
 *  API and apply the result (paid / failed / canceled). Safe to call from both
 *  the client poll and the webhook: we NEVER trust a client- or webhook-supplied
 *  status — we re-fetch from OMPay over authenticated HTTPS, so a forged webhook
 *  is inert. No-ops unless OMPay is configured and the payment is still pending. */
async function confirmPaymentWithProvider(p: Payment, log?: any): Promise<void> {
  if (!isOmpayConfigured() || p.status !== "pending" || !p.providerSessionId) return;
  try {
    const st = await checkOrderStatus(p.providerSessionId);

    // Defence-in-depth: when OMPay returns a signature, verify it before acting
    // on the status — HMAC-SHA256(clientSecret, `${orderId}|${paymentId}`).
    // Fail closed (skip the flip) on mismatch so a spoofed/garbled payload can
    // never advance a payment; a genuine event re-verifies on the next tick.
    if (st.signature) {
      const sigOk = verifyPaymentSignature(st.orderId, st.paymentId, st.signature);
      if (!sigOk) {
        log?.error?.(
          { paymentId: p.id, orderId: st.orderId },
          "ompay signature verification FAILED — not applying status",
        );
        return;
      }
    }

    if (SUCCESS_STATES.includes(st.status)) {
      // Defence-in-depth: refuse to mark paid if the confirmed amount does not
      // match what we created the order for (tamper / wrong-order guard).
      const amountOk =
        st.amount == null || Math.abs(Number(st.amount) - Number(p.amount)) < 0.0005;
      if (amountOk) {
        p.status = "paid";
        p.paidAt = new Date().toISOString();
        p.updatedAt = p.paidAt;
        await flushNow();
      } else {
        log?.error?.(
          { paymentId: p.id, expected: p.amount, got: st.amount },
          "ompay status: amount mismatch — NOT marking paid",
        );
      }
    } else if (FAILED_STATES.includes(st.status)) {
      p.status = st.status.startsWith("cancel") ? "canceled" : "failed";
      p.updatedAt = new Date().toISOString();
      await flushNow();
    }
  } catch (err: any) {
    log?.warn?.({ err: String(err?.message ?? err) }, "ompay check-status failed");
  }
}

// ─── Create a hosted-checkout session ───────────────────────────────────
router.post("/session", async (req: any, res): Promise<any> => {
  if (!isOmpayConfigured()) {
    return res.status(503).json({
      error: "PAYMENTS_NOT_CONFIGURED",
      message: "بوابة الدفع غير مفعّلة بعد. الرجاء إضافة مفاتيح OMPay.",
    });
  }

  const body = req.body ?? {};
  const purpose = String(body.purpose ?? "") as PaymentPurpose;
  const amount = Number(body.amount);
  const returnUrl = String(body.returnUrl ?? "").trim();

  if (!VALID_PURPOSES.includes(purpose)) {
    return res.status(400).json({ error: "BAD_PURPOSE" });
  }
  // OMR has 3 decimal places. Reject NaN/≤0 and anything with sub-baisa
  // precision so the ×1000 rounding in the provider call can't silently
  // change the charged amount (or round a tiny value down to 0).
  const minor = toMinorUnits(amount);
  if (!Number.isFinite(amount) || amount <= 0 || minor <= 0) {
    return res.status(400).json({ error: "BAD_AMOUNT" });
  }
  if (Math.abs(amount * 1000 - minor) > 1e-6) {
    return res.status(400).json({ error: "BAD_AMOUNT", message: "max 3 decimal places (OMR)" });
  }
  if (!returnUrl) {
    return res.status(400).json({ error: "BAD_RETURN_URL" });
  }

  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) {
    req.log?.error?.("cannot build webhook url: no trusted public base url");
    return res.status(500).json({ error: "SERVER_MISCONFIGURED" });
  }
  const webhookUrl = `${baseUrl}/api/payments/ompay/webhook`;

  const now = new Date().toISOString();
  const reference = `${purpose}-${newPaymentId()}`;
  const accessToken = crypto.randomBytes(24).toString("hex");
  const payment: Payment = {
    id: newPaymentId(),
    reference,
    purpose,
    status: "pending",
    amount,
    currency: "OMR",
    cafeId: body.cafeId ?? null,
    userId: body.userId ?? null,
    customerName: body.customerName ?? null,
    customerPhone: body.customerPhone ?? null,
    description: body.description ?? null,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    accessToken,
    providerSessionId: null,
    checkoutUrl: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await createHostedCheckout({
      amount,
      currency: "OMR",
      reference,
      description: payment.description ?? undefined,
      customerName: payment.customerName ?? undefined,
      customerPhone: payment.customerPhone ?? undefined,
      returnUrl,
      webhookUrl,
    });
    payment.providerSessionId = result.providerSessionId;
    payment.checkoutUrl = result.checkoutUrl;
    payments.push(payment);
    await flushNow();
    // `token` is returned ONCE here; the client stores it to poll status.
    return res.json({ payment: publicPayment(payment), token: accessToken });
  } catch (err: any) {
    req.log?.error?.({ err, code: err?.message }, "ompay session create failed");
    return res
      .status(502)
      .json({ error: "PAYMENT_PROVIDER_ERROR", message: String(err?.message ?? err) });
  }
});

// ─── Poll status (capability-token protected) ───────────────────────────
// The client calls this after the shopper returns from the hosted checkout.
// If the payment is still pending, we actively confirm it against OMPay's
// Status Check API (the documented post-redirect step) — this is authoritative
// even when no webhook is configured. The webhook below is a secondary path.
router.get("/:id", async (req: any, res): Promise<any> => {
  const p = payments.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "NOT_FOUND" });
  const token = String(req.query.token ?? "");
  if (!p.accessToken || !token || !safeEqual(token, p.accessToken)) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  // A transient provider failure self-heals: the client keeps polling, so the
  // next tick re-confirms. confirmPaymentWithProvider swallows its own errors.
  await confirmPaymentWithProvider(p, req.log);

  return res.json({ payment: publicPayment(p) });
});

// ─── OMPay webhook (authoritative status) ───────────────────────────────
router.post("/ompay/webhook", async (req: any, res): Promise<any> => {
  if (!isOmpayConfigured()) {
    return res.status(503).json({ error: "PAYMENTS_NOT_CONFIGURED" });
  }

  // OMPay POSTs { orderId, paymentId, status, receiptId, amount, signature, ... }.
  // We deliberately do NOT trust the payload's status/amount (its signature
  // scheme isn't verified yet). Instead we match the payment, then RE-CONFIRM via
  // the authenticated Status Check API. Result: a forged webhook is inert — an
  // unknown order never triggers an OMPay call, and a known one is only flipped
  // to match OMPay's own check-status response (with the amount guard).
  const evt = req.body ?? {};
  // OMPay's examples sometimes include stray leading spaces — trim defensively.
  const orderId = evt.orderId ? String(evt.orderId).trim() : undefined;
  const receiptId = evt.receiptId ? String(evt.receiptId).trim() : undefined;

  const p = payments.find(
    x =>
      (!!orderId && x.providerSessionId === orderId) ||
      (!!receiptId && x.reference === receiptId),
  );
  if (!p) {
    // Ack 200 so OMPay doesn't retry forever for an order we don't recognise.
    req.log?.warn?.({ orderId, receiptId }, "ompay webhook: unknown payment");
    return res.json({ ok: true, matched: false });
  }

  await confirmPaymentWithProvider(p, req.log);
  return res.json({ ok: true, matched: true, status: p.status });
});

export default router;
