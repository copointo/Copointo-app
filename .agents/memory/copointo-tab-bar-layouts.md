---
name: Copointo bottom tab bar (single amber bar)
description: app/(tabs)/_layout.tsx now renders ONLY the custom amber ClassicTabLayout on every platform; native iOS-26 glass bar was removed.
---

# Copointo bottom tab bar: one amber bar everywhere

`app/(tabs)/_layout.tsx` used to branch on `isLiquidGlassAvailable()` between a
native iOS-26 liquid-glass `<NativeTabs>` bar and a custom amber `ClassicTabLayout`.
That branch was **removed** — `TabLayout()` now always returns `ClassicTabLayout`
(custom `<Tabs>` with amber pill highlights, BlurView on iOS, solid bg on web).

**Why removed:** the iOS-26 liquid-glass `<NativeTabs>` selection highlight rendered
an off-brand system-**blue** blob over the selected tab, and `tintColor` /
`iconColor` / `labelStyle` did NOT reliably override that glass highlight. Users
kept reporting "blue / unclear bar" on real iPhones.

**The verification trap that drove the decision:** the native liquid-glass bar
only renders on a real iOS device — it CANNOT be reproduced in the web preview,
the canvas iframe, or Playwright/runTest on this Linux env. So a native-only bug
there is unfixable-with-confidence from the agent environment. Forcing
ClassicTabLayout means the bar is identical on web and device, so a web screenshot
genuinely verifies what the iPhone shows.

**How to apply:** keep the single ClassicTabLayout. Do NOT re-introduce
`<NativeTabs>` / `isLiquidGlassAvailable()` unless you have a real iOS device to
verify the blue is gone. Brand amber is `#E8B86D`; selected pill bg
`rgba(232,184,109,0.15)`. More broadly: native-only iOS surfaces (liquid glass,
voice recording, camera) can't be verified from this Linux env — say so plainly
instead of claiming a web "pass" proves the device is fixed.
