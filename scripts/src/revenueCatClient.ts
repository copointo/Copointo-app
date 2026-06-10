// Authenticated @replit/revenuecat-sdk client, wired through Replit's connector.
// Source: blueprint id=revenuecat (Replit integration). The OAuth access token is
// fetched fresh from the Replit connectors API each call (it may rotate), then
// passed as a Bearer token to the RevenueCat REST v2 SDK. Never cache it long-term.
import { createClient } from "@replit/revenuecat-sdk/client";

interface ConnectionItem {
  settings?: {
    access_token?: string;
    oauth?: { credentials?: { access_token?: string } };
  };
}

async function fetchAccessToken(): Promise<string> {
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
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } },
  );
  const data: { items?: ConnectionItem[] } = await r.json();
  const item = data?.items?.[0];
  const token = item?.settings?.access_token ?? item?.settings?.oauth?.credentials?.access_token;
  if (!token) throw new Error("RevenueCat not connected (no access token)");
  return token;
}

export async function getUncachableRevenueCatClient() {
  const accessToken = await fetchAccessToken();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
