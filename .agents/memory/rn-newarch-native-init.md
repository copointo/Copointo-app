---
name: RN New-Arch native init timing
description: Under RN New Architecture, native module init must run after mount, not at module-eval time, or the app segfaults on launch.
---

# RN New Architecture: never init native modules at module-eval time

With `newArchEnabled: true` (bridgeless RN), calling a native/TurboModule during
JS **bundle evaluation** (i.e. at module top-level, before any component mounts)
runs before the native runtime is ready and segfaults on launch:
`EXC_BAD_ACCESS` / `SIGSEGV` on thread `com.facebook.react.runtime.JavaScript`,
often with Swift / framework frames of whichever SDK is being configured.

Concrete incident: `Purchases.configure()` (RevenueCat, Swift SDK + StoreKit)
was called at the top level of `app/_layout.tsx`. App Store review rejected the
build — crashed on launch on iPad. The crash log Swift/StoreKit frames pointed
straight at RevenueCat init timing, not at any iPad-specific layout code.

**Why:** module top-level code executes synchronously while the bundle is still
evaluating; the New-Arch native runtime / TurboModule registry isn't up yet, so
the native call dereferences invalid memory.

**How to apply:**
- Configure native SDKs inside a `useEffect` (runs after first mount), never at
  module top-level. Put it in the relevant Provider so it owns the lifecycle.
- Gate any queries/calls that need the SDK behind a `ready` flag set true only
  after `configure()` succeeds, so they never hit an unconfigured singleton.
- Init failure should warn, not throw/crash — degrade the feature, keep app up.
- `expo-splash-screen` `preventAutoHideAsync()` at top level is fine; the rule is
  about third-party native module *configuration* calls.
