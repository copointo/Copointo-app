---
name: Copointo bottom tab bar has TWO layouts
description: app/(tabs)/_layout.tsx renders NativeTabLayout (iOS 26 liquid glass) OR ClassicTabLayout; styling fixes must cover the right one.
---

# Copointo bottom tab bar: two layouts, pick the right one

`app/(tabs)/_layout.tsx` branches on `isLiquidGlassAvailable()`:
- **NativeTabLayout** — `<NativeTabs>` from `expo-router/unstable-native-tabs`.
  Renders on iOS 26+ (liquid glass), incl. newer devices in Expo Go. Looks like a
  floating glass capsule/pill.
- **ClassicTabLayout** — custom `<Tabs>` with amber "pill" highlights, BlurView on
  iOS, solid bg on web. Renders everywhere else (older iOS, Android, web preview).

**Why this bites:** a visual bug a user reports from a real iOS device is almost
always in NativeTabLayout, but the web preview / canvas iframe shows
ClassicTabLayout — so you can fix the wrong one and "see nothing wrong."

**The blue-blob symptom:** `<NativeTabs>` with no color props falls back to the
iOS SYSTEM tint (blue) for the selected item AND its glass selection highlight —
reads as an off-brand blue blob over the bar. Fix by setting on `<NativeTabs>`:
`tintColor` (selected accent), `iconColor` `{default,selected}`, and `labelStyle`
`{default,selected}` to the brand amber `#E8B86D`. On iOS, `indicatorColor` is
android/web-only — `tintColor` is what recolors the iOS selection highlight.

**How to apply:** when changing tab-bar appearance, edit BOTH layouts (or confirm
which one the reporting device uses). The web/canvas preview cannot show the
native (liquid glass) bar.
