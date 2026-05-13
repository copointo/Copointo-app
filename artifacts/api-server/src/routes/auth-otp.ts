// Phone-OTP routes for new-user registration and password reset.
//
// Uses **Twilio Verify** (managed sender pool with pre-approved
// carrier routing for the GCC) instead of Programmable Messaging.
// Twilio Verify generates the code, picks the best sender for each
// destination country, and validates the code on its end — we only
// proxy the request and mint a short-lived verification token on
// success that the client attaches to its register / reset-password
// call.
//
// Required env: TWILIO_VERIFY_SERVICE_SID (set via Replit Secret).
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { getTwilioClient } from "../lib/twilio";

const router: IRouter = Router();

type Purpose = "register" | "reset";

interface PendingMeta {
  expiresAt: number;
  lastSentAt: number;
  purpose: Purpose;
}

interface VerifiedToken {
  phone: string;
  purpose: Purpose;
  expiresAt: number;
}

// In-memory stores. Survive only the process lifetime — that's intentional
// for OTP / short-lived verification tokens.
//   - `pending` is now used only to enforce our 45s resend cooldown locally
//     (Twilio also has cooldowns but ours gives a deterministic UX message).
//   - `verified` holds the single-use tokens we mint after Twilio confirms
//     the code, consumed by /users/register and /auth/reset-password.
const pending = new Map<string, PendingMeta>();   // key: `${purpose}:${phone}`
const verified = new Map<string, VerifiedToken>(); // key: opaque token

const OTP_TTL_MS         = 10 * 60_000;  // 10 min (Twilio Verify default)
const RESEND_COOLDOWN_MS = 45_000;       // 45s between sends
const TOKEN_TTL_MS       = 10 * 60_000;  // 10 min to use the verified token

function normalizePhone(raw: unknown): string {
  let s = String(raw ?? "").trim().replace(/\s+/g, "");
  // Keep digits + leading "+". Strip everything else (parentheses, dashes …).
  s = s.replace(/(?!^\+)\D/g, "");
  if (!s) return "";
  // International "00" prefix → "+".
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // Already E.164.
  if (s.startsWith("+")) return s;
  // Bare "968XXXXXXXX" → add the "+".
  if (s.startsWith("968") && s.length >= 11) return "+" + s;
  // Default to Oman (+968) for short local numbers (8 digits typical OM mobile).
  if (/^\d{7,9}$/.test(s)) return "+968" + s;
  // Anything else (e.g. 11+ digits without "+") — assume already has CC.
  return "+" + s;
}

function isPlausiblePhone(p: string): boolean {
  // Bare minimum: 8–15 digits (E.164 max 15), optional leading "+".
  return /^\+?\d{8,15}$/.test(p);
}

function purposeOf(raw: unknown): Purpose | null {
  return raw === "register" || raw === "reset" ? raw : null;
}

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
  for (const [k, v] of verified) if (v.expiresAt < now) verified.delete(k);
}

function getVerifyServiceSid(): string {
  const sid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!sid) {
    throw new Error(
      "TWILIO_VERIFY_SERVICE_SID not configured — create a Verify service " +
      "in Twilio Console (Verify → Services) and add the SID as a Replit Secret.",
    );
  }
  return sid;
}

// ─── Send OTP ─────────────────────────────────────────────────────────────
router.post("/send", async (req: Request, res: Response): Promise<any> => {
  purgeExpired();
  const phone = normalizePhone(req.body?.phone);
  const purpose = purposeOf(req.body?.purpose);
  if (!phone || !isPlausiblePhone(phone)) {
    return res.status(400).json({ ok: false, error: "رقم الهاتف غير صالح" });
  }
  if (!purpose) {
    return res.status(400).json({ ok: false, error: "purpose غير صالح" });
  }
  const key = `${purpose}:${phone}`;
  const existing = pending.get(key);
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
    return res.status(429).json({
      ok: false,
      error: `الرجاء الانتظار ${waitSec} ثانية قبل إعادة الإرسال`,
      retryAfterSec: waitSec,
    });
  }

  // Hand off to Twilio Verify — it generates the code, picks the optimal
  // sender for the destination, and tracks expiry on its end. If the call
  // fails we surface the error so the user can retry; we leave the cooldown
  // entry in place to prevent abuse of failed sends as a free oracle.
  try {
    const client = await getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    const to = phone.startsWith("+") ? phone : `+${phone}`;
    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications.create({ to, channel: "sms" });
    req.log?.info?.(
      { sid: verification.sid, to, status: verification.status, channel: verification.channel },
      "twilio verify started",
    );
  } catch (err: any) {
    req.log?.error?.(
      { err: err?.message ?? String(err), code: err?.code, status: err?.status, moreInfo: err?.moreInfo },
      "twilio verify failed",
    );
    return res.status(502).json({
      ok: false,
      error: "تعذر إرسال الرمز عبر SMS، حاول مجدداً بعد قليل",
    });
  }

  const now = Date.now();
  pending.set(key, {
    purpose,
    expiresAt: now + OTP_TTL_MS,
    lastSentAt: now,
  });

  return res.json({ ok: true, expiresInSec: Math.floor(OTP_TTL_MS / 1000) });
});

// ─── Verify OTP ───────────────────────────────────────────────────────────
router.post("/verify", async (req: Request, res: Response): Promise<any> => {
  purgeExpired();
  const phone = normalizePhone(req.body?.phone);
  const purpose = purposeOf(req.body?.purpose);
  const code = String(req.body?.code ?? "").trim();
  if (!phone || !purpose || !/^\d{4,10}$/.test(code)) {
    return res.status(400).json({ ok: false, error: "بيانات غير صالحة" });
  }
  const key = `${purpose}:${phone}`;
  const entry = pending.get(key);
  if (!entry) {
    return res.status(404).json({ ok: false, error: "لا يوجد رمز فعّال — أعد الإرسال" });
  }
  if (entry.expiresAt < Date.now()) {
    pending.delete(key);
    return res.status(410).json({ ok: false, error: "انتهت صلاحية الرمز — أعد الإرسال" });
  }

  // Ask Twilio Verify whether the code is correct. Twilio handles attempt
  // counting and lockouts on its end (after ~5 wrong tries the verification
  // is auto-cancelled). We surface failures with a generic message — Twilio
  // does not return remaining-attempts info on the verificationChecks endpoint.
  let approved = false;
  try {
    const client = await getTwilioClient();
    const serviceSid = getVerifyServiceSid();
    const to = phone.startsWith("+") ? phone : `+${phone}`;
    const check = await client.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to, code });
    approved = check.status === "approved";
    req.log?.info?.(
      { sid: check.sid, to, status: check.status, valid: check.valid },
      "twilio verify check",
    );
  } catch (err: any) {
    // Twilio returns 404 if the verification was already approved/cancelled
    // or never existed. Surface as wrong-code so the user can try again.
    req.log?.warn?.(
      { err: err?.message ?? String(err), code: err?.code, status: err?.status },
      "twilio verify check failed",
    );
    return res.status(401).json({ ok: false, error: "الرمز غير صحيح" });
  }

  if (!approved) {
    return res.status(401).json({ ok: false, error: "الرمز غير صحيح" });
  }

  // Success — drop the cooldown entry and mint a verification token the
  // client attaches to its register / reset-password call.
  pending.delete(key);
  const token = crypto.randomBytes(24).toString("hex");
  verified.set(token, { phone, purpose, expiresAt: Date.now() + TOKEN_TTL_MS });
  return res.json({ ok: true, token, expiresInSec: Math.floor(TOKEN_TTL_MS / 1000) });
});

/** Consume a verification token. Returns the phone+purpose if valid, else null.
 *  The token is single-use — calling this removes it. */
export function consumeOtpToken(token: string, expectedPurpose: Purpose): { phone: string } | null {
  if (!token) return null;
  const entry = verified.get(token);
  if (!entry) return null;
  if (entry.expiresAt < Date.now() || entry.purpose !== expectedPurpose) {
    verified.delete(token);
    return null;
  }
  verified.delete(token);
  return { phone: entry.phone };
}

export default router;
