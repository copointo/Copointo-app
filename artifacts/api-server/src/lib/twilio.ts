// Twilio client wired through Replit's connector proxy.
// Source: blueprint id=twilio (Replit integration).
// Never cache the client across requests — credentials may rotate.
import twilio from "twilio";

interface ConnectionItem {
  settings: {
    account_sid?: string;
    api_key?: string;
    api_key_secret?: string;
    phone_number?: string;
  };
}

let cachedSettings: ConnectionItem["settings"] | null = null;
let cachedAt = 0;
const SETTINGS_TTL_MS = 60_000;

async function fetchCredentials(): Promise<ConnectionItem["settings"]> {
  // Allow full override via env secrets — used when the connector form is hard to fix.
  const envSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const envKey = process.env.TWILIO_API_KEY?.trim();
  const envSecret = process.env.TWILIO_API_KEY_SECRET?.trim();
  const envPhone = process.env.TWILIO_FROM_NUMBER?.trim();
  if (envSid && envKey && envSecret) {
    return { account_sid: envSid, api_key: envKey, api_key_secret: envSecret, phone_number: envPhone };
  }
  if (cachedSettings && Date.now() - cachedAt < SETTINGS_TTL_MS) return cachedSettings;
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
  if (!hostname || !xReplitToken) {
    throw new Error("Replit connector env vars missing (REPLIT_CONNECTORS_HOSTNAME / REPL_IDENTITY)");
  }
  const r = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=twilio`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } },
  );
  const data: any = await r.json();
  const item: ConnectionItem | undefined = data?.items?.[0];
  if (!item || !item.settings.account_sid || !item.settings.api_key || !item.settings.api_key_secret) {
    throw new Error("Twilio not connected");
  }
  cachedSettings = item.settings;
  cachedAt = Date.now();
  return item.settings;
}

export async function getTwilioClient() {
  const s = await fetchCredentials();
  return twilio(s.api_key!, s.api_key_secret!, { accountSid: s.account_sid! });
}

export async function getTwilioFromPhoneNumber(): Promise<string | undefined> {
  // Allow overriding the connector's stored From number via env secret.
  // Useful when the connector form value is stale or wrong.
  const envOverride = process.env.TWILIO_FROM_NUMBER?.trim();
  if (envOverride) return envOverride;
  const s = await fetchCredentials();
  return s.phone_number;
}
