---
name: RN game-loop smoothness (Reanimated UI thread)
description: How to make a frame-driven RN/Expo game stutter-free — move physics off the JS thread.
---

# RN game loop: kill stutter by leaving the JS thread

**Rule:** A frame-driven RN/Expo game (Flappy-style etc.) must NOT drive
motion with `requestAnimationFrame` + `setState`/`forceRender` per frame.
The per-frame React reconciliation on the JS thread is the stutter source,
no matter how well the physics are tuned (fixed timestep, no allocs, etc.).

**Do instead:** run the whole simulation in a Reanimated 4 `useFrameCallback`
worklet on the UI thread. Keep mutable state in `useSharedValue`; render
position via `useAnimatedStyle` **transforms only** (translateX/Y, rotate) —
never animate width/height/top/left (those trigger layout). For variable-count
objects (pipes), render a fixed recycled pool of N animated views, each reading
`arraySV.value[index]`, and rebuild a NEW array each substep so dependent
animated styles recompute. Hop back to JS for side effects (scoring, coins,
persistence, game-over) via `runOnJS(...)`; guard double-fire (set a
`running` SV to 0 before runOnJS + check status in the JS handler).

**Why:** the only way to guarantee "never stutters" in RN is UI-thread
animation — the JS thread is subject to GC pauses and contention. Confirmed
on Copointo's Flappy game: the RAF+forceRender version stuttered; the worklet
version does not.

**How to apply:** Reanimated 4 + react-native-worklets are wired via
`babel-preset-expo` (Expo SDK 54+) — no manual babel plugin needed. Worklets
support `Math.random`, array map/filter/slice/push. On `react-native-web` the
frame callback falls back to the JS thread (graceful), so the UI-thread win is
native-only — fine, native is the real target. Keep numeric `font`/static
sizes out of animated style objects (see rn-web-style-coercion).
