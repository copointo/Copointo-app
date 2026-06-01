---
name: Copointo crash debugging ("Something went wrong")
description: How to find the real error behind Copointo's generic ErrorBoundary, and why typecheck-clean screens can still crash at runtime.
---

# "Something went wrong / Please reload the app" = global ErrorBoundary fallback

The Expo app wraps everything in `components/ErrorBoundary.tsx` (fallback `ErrorFallback.tsx`, mounted in `app/_layout.tsx`). When ANY screen throws during render, the user sees the generic "Something went wrong / Try Again" screen with **no error text in the console** — the boundary swallows it because it's mounted without an `onError` prop.

**To surface the real error:** temporarily pass `onError={(error, componentStack) => console.error("[BOUNDARY_CAUGHT]", error?.message, error?.stack, componentStack)}` to `<ErrorBoundary>` in `_layout.tsx`, then reproduce — the message + stack appear in the browser console. Revert when done.

**Reproducing behind the auth gate:** every route is behind a global `AuthGate`, so plain screenshots only ever show the login card. Use the showcase backdoor login (the hidden showcase demo account — credentials are not stored here; see `AuthGate`/showcase login handling in code) via the Playwright testing subagent to get past it and reach e.g. `/cafe/<id>/order`. It logs in with no OTP. Note: Expo web cold-start is slow — warm the bundle first (`curl localhost:<expo-port>/`) or the test subagent times out.

**Why:** a missing **value** import from `react-native` (e.g. using `<TextInput>` without importing it) produced a runtime `ReferenceError: TextInput is not defined` that the project typecheck did NOT flag — so a "typecheck-clean" screen still crashed for every user. Do not trust typecheck alone to catch missing RN component imports; verify the screen actually renders.
