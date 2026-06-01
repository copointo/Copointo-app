// ─── Monthly leaderboard reward season ─────────────────────────────────
// Every 30 days the top-10 players (sorted by lifetime totalOrders desc,
// with level as a tiebreaker — matching the in-app leaderboard) are
// automatically credited with free coins via the existing CoinGift
// pipeline. Rewards (in coins):
//
//   1st = 50,000   2nd = 45,000   3rd = 40,000   4th = 35,000
//   5th = 30,000   6th = 25,000   7th = 20,000   8th = 15,000
//   9th = 10,000  10th =  5,000
//
// The season is "lazy" — there is no background timer. Every call to
// `checkAndProcessSeasonEnd()` (which the mobile leaderboard endpoint
// triggers on each poll) checks whether the latest season has expired
// and, if so, awards the winners + starts a brand-new 30-day season.
// This works because the leaderboard screen polls every 6 s when open,
// guaranteeing at least one trigger per active session.
import {
  users, coinGifts, monthlySeasons, persistStore,
  type CoinGift, type MonthlySeason,
} from "../store";
import { sendPushToUser } from "./push";

export const MONTHLY_REWARDS = [
  50000, 45000, 40000, 35000, 30000, 25000, 20000, 15000, 10000, 5000,
] as const;
export const SEASON_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function makeSeason(now: number): MonthlySeason {
  return {
    id:        `season_${now}`,
    startedAt: new Date(now).toISOString(),
    endsAt:    new Date(now + SEASON_DURATION_MS).toISOString(),
    awardedAt: null,
    winners:   [],
  };
}

/** Return the latest season, creating the first one if the array is empty. */
export function ensureCurrentSeason(): MonthlySeason {
  const latest = monthlySeasons[monthlySeasons.length - 1];
  if (latest) return latest;
  const s = makeSeason(Date.now());
  monthlySeasons.push(s);
  persistStore();
  return s;
}

/** Deterministic FNV-1a hash of a string. MUST match the client's `hashId`
 *  in artifacts/copointo/app/leaderboard.tsx so the season payout ranks
 *  players in the EXACT same order the mobile leaderboard displays them. */
function hashId(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Same ranking the mobile leaderboard uses (totalOrders desc, then a stable
 *  hashId(id) tiebreaker — identical to the client's `sortDesc`). Level is
 *  intentionally NOT a tiebreaker: the reward must follow the position the
 *  player actually occupies in the displayed ranking, so whoever is visibly
 *  in the top-10 at season end is exactly who gets paid.
 *  Banned/game-banned players are excluded so they can't claim rewards. */
export function rankPlayersForSeason() {
  return users
    // Mirror the public leaderboard population (routes/index.ts /users/public):
    // banned/game-banned AND showcase-only demo users are excluded. Without the
    // showcaseOnly filter the seeded demo accounts (copointo-showcase-user,
    // sc-user-*) would occupy the paid top-10 slots server-side while real
    // users — who never see showcase rows — show the reward chips client-side.
    .filter(u => !u.banned && !u.gameBanned && !u.showcaseOnly)
    .sort((a, b) =>
      ((b.totalOrders ?? 0) - (a.totalOrders ?? 0)) ||
      (hashId(a.id) - hashId(b.id))
    )
    .slice(0, MONTHLY_REWARDS.length);
}

/** Check whether the current season has expired and, if so, award the
 *  top-10 players + start a fresh 30-day season. Always returns the
 *  ACTIVE season (i.e. the newly-created one after a rollover). */
export function checkAndProcessSeasonEnd(): MonthlySeason {
  const current = ensureCurrentSeason();
  const now = Date.now();
  if (now < new Date(current.endsAt).getTime()) return current;

  // Award winners exactly once per season.
  if (!current.awardedAt) {
    const ranked = rankPlayersForSeason();
    const winners: NonNullable<MonthlySeason["winners"]> = [];
    for (let i = 0; i < ranked.length; i++) {
      const u = ranked[i]!;
      const amount = MONTHLY_REWARDS[i]!;
      const rank   = i + 1;
      const message = `🏆 مبروك! حصلت على المركز ${rank} في تصنيف كوبوينتو الشهري — استلمت ${amount} عملة 🪙`;
      const g: CoinGift = {
        id:        `cg_${current.id}_${u.id}`,
        userId:    u.id,
        amount,
        message,
        createdAt: new Date().toISOString(),
        claimedAt: null,
      };
      coinGifts.unshift(g);
      winners.push({ userId: u.id, username: u.username, rank, amount });
      void sendPushToUser(u.id, {
        title: `🏆 المركز ${rank} في التصنيف الشهري!`,
        body:  message,
        data:  { type: "monthly_reward", rank, amount, seasonId: current.id },
      });
    }
    current.awardedAt = new Date().toISOString();
    current.winners   = winners;
  }

  // Start the next 30-day season immediately so the countdown banner
  // never shows a negative number.
  const next = makeSeason(now);
  monthlySeasons.push(next);
  persistStore();
  return next;
}
