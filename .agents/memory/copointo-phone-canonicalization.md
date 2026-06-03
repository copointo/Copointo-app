---
name: Copointo phone canonicalization for read/match paths
description: Why phone-keyed lookups must strip the Omani 968 country code, not just non-digit chars
---

# Phone matching must canonicalize the Omani national number

Any server path that matches a user by phone (loyalty lookups, free-coffee
list, ownership checks) must compare a **canonical 8-digit Omani national
number**, NOT a plain digits-only string.

Canonical key: digits-only → strip leading zeros → strip a leading `968`
when the result is longer than 8 → require exactly 8 digits (else treat as
empty and fall back to strict exact match for non-numeric handles like the
showcase `Copointo` account).

**Why:** The server canonicalizes stored phones to the `+968XXXXXXXX` form
(both the `users` and `freeCoffees` collections hold this), but a device that
registered with a bare local number keeps `XXXXXXXX` on-device and sends THAT
to the API. A strict `===` — or even a plain `replace(/\D/g,'')` digits-only
compare — fails because `96812345678` ≠ `12345678`. Real production symptom:
earned free-coffee codes existed in the DB but never appeared in the app's
free-coffee section, because `GET /free-coffees` did an exact phone match.

**How to apply:** Mirror the mobile login matcher (AppContext `matchIdentifier`
bridges `+968…` ↔ bare local). When adding/auditing any phone-keyed read,
canonicalize both sides. Verify with a production SQL simulation of the key
function before/after — confirm it matches the target user and does NOT bleed
into other users sharing a partial digit sequence.
