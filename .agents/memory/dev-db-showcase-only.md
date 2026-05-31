---
name: Dev DB has only showcase users
description: Why phone/loyalty matching features can't be happy-path tested against the local dev database.
---

Every user row in the local dev database (`kv_store` key `users`) is a showcase/demo account (`showcaseOnly: true`). There are zero real registered users with phones.

**Why this matters:** Both `GET /lookup-user` and the order phone-attach / `awardOrderProgress` logic deliberately filter to NON-showcase users (`users.filter(u => !u.showcaseOnly)`). So any feature that matches a customer phone to a registered player will NEVER match in the local dev DB — the happy path is untestable there. You can still test rejection/guard paths via curl (unregistered phone → 404, empty → 400, guards on archived/paid/done orders).

**How to apply:** When verifying phone-matching or loyalty-credit features, don't expect a local happy-path match. Registering a real user needs an OTP token (`POST /users/register` consumes one), so synthetic real users aren't trivial to create. Rely on guard/reject-path curl tests + verbatim reuse of the proven matching logic, or set up OTP if a true happy-path test is required.
