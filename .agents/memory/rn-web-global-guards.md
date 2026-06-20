---
name: RN web-global guards at module-eval
description: In Expo/RN universal apps, `window` exists on native but `document`/`history` do not — guarding web-only code on `typeof window` throws on native.
---

# Guard web-only module code on `document`/`history`, not `window`

In Expo / React Native universal apps, the global `window` IS defined on native
(incl. Expo Go on iOS), but `document` and `history` are NOT. So a web-only block
guarded by `if (typeof window !== "undefined")` still runs on native, and the
first bare reference to `history` / `document` inside it throws a `ReferenceError`.

When that block is at **module top-level** (e.g. in `app/_layout.tsx`), the throw
aborts module evaluation, so:
- the route's `export default` never registers → "Route ./_layout.tsx is missing
  the required default export"
- providers never mount → "useApp must be used within AppProvider" (and similar
  context errors) cascade across the app.

**Why:** these are the symptoms of a module that failed to finish evaluating, NOT
of a missing component or a misused hook — chasing the downstream errors wastes
time. Look for a top-level web-global reference under a too-loose `window` guard.

**How to apply:** gate web-only top-level code on `typeof document !== "undefined"`
(and `typeof history !== "undefined"` if used), or on `Platform.OS === "web"` —
never on `typeof window` alone. Functions that touch the DOM should also early-
return on `typeof document === "undefined"`.
