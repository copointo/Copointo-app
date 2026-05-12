// Phone-OTP routes for new-user registration and password reset.
// Sends a 6-digit code via Twilio SMS, verifies with rate limiting,
// then issues a short-lived "verification token" the client must
// present when finishing register / reset-password.
import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { getTwilioClient, getTwilioFromPhoneNumber } from "../lib/twilio";

const router: IRouter = Router();

type Purpose = "register" | "reset";

interface PendingOtp {
  code: string;
  expiresAt: number;
  attempts: number;
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
const pending = new Map<string, PendingOtp>();      // key: `${purpose}:${phone}`
const verified = new Map<string, VerifiedToken>();  // key: opaque token

const OTP_TTL_MS         = 5 * 60_000;   // 5 min
const RESEND_COOLDOWN_MS = 45_000;       // 45s between sends
const MAX_ATTEMPTS       = 5;
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

function genCode(): string {
  // Cryptographic RNG so codes can't be guessed via Math.random seeding.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function purposeOf(raw: unknown): Purpose | null {
  return raw === "register" || raw === "reset" ? raw : null;
}

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
  for (const [k, v] of verified) if (v.expiresAt < now) verified.delete(k);
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

  const code = genCode();
  const now = Date.now();
  pending.set(key, {
    code,
    purpose,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastSentAt: now,
  });

  // Send SMS via Twilio. If Twilio fails we surface that to the caller —
  // the user can retry, and the pending entry stays so resend cooldown
  // applies (prevents abuse of failed sends as a free oracle).
  try {
    const client = await getTwilioClient();
    const from = await getTwilioFromPhoneNumber();
    if (!from) throw new Error("Twilio sender number missing");
    const body = `كوبوينتو Copointo — رمز التحقق: ${code}\nصلاحية 5 دقائق. لا تشاركه مع أحد.`;
    const to = phone.startsWith("+") ? phone : `+${phone}`;
    await client.messages.create({ to, from, body });
  } catch (err: any) {
    req.log?.error?.({ err: err?.message ?? String(err) }, "twilio send failed");
    return res.status(502).json({
      ok: false,
      error: "تعذر إرسال الرمز عبر SMS، حاول مجدداً بعد قليل",
    });
  }

  return res.json({ ok: true, expiresInSec: Math.floor(OTP_TTL_MS / 1000) });
});

// ─── Verify OTP ───────────────────────────────────────────────────────────
router.post("/verify", (req: Request, res: Response): any => {
  purgeExpired();
  const phone = normalizePhone(req.body?.phone);
  const purpose = purposeOf(req.body?.purpose);
  const code = String(req.body?.code ?? "").trim();
  if (!phone || !purpose || !/^\d{6}$/.test(code)) {
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
  entry.attempts += 1;
  if (entry.attempts > MAX_ATTEMPTS) {
    pending.delete(key);
    return res.status(429).json({ ok: false, error: "تجاوزت محاولات التحقق — أعد الإرسال" });
  }
  if (entry.code !== code) {
    return res.status(401).json({
      ok: false,
      error: "الرمز غير صحيح",
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - entry.attempts),
    });
  }

  // Success — burn the code and mint a verification token the client
  // attaches to its register / reset-password call.
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
