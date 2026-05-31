---
name: UNO online game
description: Architecture & rules constraints for the server-authoritative UNO feature (api-server engine + Expo screens).
---

# UNO online game

## Lazy-tick (no background loop)
The server has **no** game-loop/cron. All game advancement happens inside `tick(game, now)`
called at the top of every UNO request handler, plus the mobile client polling
`GET /uno/sessions/:id` (~1.2s). This drives: waiting-room countdown→start, bot turns
(time-gated ~BOT_DELAY apart), and human turn-timeouts. A game with only idle clients
won't progress — that's acceptable because someone is always polling while watching.

**Why:** keeps the engine pure and avoids managing timers/persistence for a background loop.
**How to apply:** if you add server-side game logic that must "happen later", it must be
expressed as time-gated work inside `tick()`, not a setInterval.

## Wild +4 legality is mandatory for engine stability
Real-UNO rule enforced: a `wild4` may only be played when the player holds NO card matching
the active color (`isWild4Legal` / `isPlayableFromHand`). This is enforced in `applyPlay`
(rejects), `redact` (hides from playableCardIds), and the **bot AI** (`botPickCard` + drawn-card
checks).

**Why:** if a bot ever *attempts* an illegal move, `applyPlay` returns `ok:false`, the turn
never advances, `actDeadline` stays in the past, and `tick()`'s while-loop spins (guard-capped)
leaving the game stuck. Any new legality rule MUST be reflected in the bot's card selection too,
not just in the human-facing reject path.

## Reward (25 coins) is client-trusted
Win payout is granted client-side in `uno-room.tsx` via `addCoins(25)` guarded by AsyncStorage
key `copointo_uno_reward_<sessionId>`. Not globally authoritative (storage reset / new device can
re-award) — consistent with the app's existing local-coin architecture.
