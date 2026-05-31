---
name: RN-web style coercion crash
description: Why numeric/shorthand style keys leaked into a <View> crash only on react-native-web, not native.
---

# react-native-web style coercion crash

**Symptom:** `TypeError: value.replace is not a function` thrown inside react-native-web's
`createReactDOMStyle` (StyleSheet → _loop), surfacing as an expo-router ErrorBoundary
"Something went wrong" on web only. The native (Expo Go / device) build is fine.

**Rule:** Never let a CSS *shorthand* style key (most notably `font`) or any non-string
value where the web layer expects a string land in a React Native style object that is
spread into a `<View>`/`<Text>`. react-native-web maps `font` to the CSS `font` shorthand
and calls `value.replace('System', ...)`; a number (e.g. `font: 26`) throws.

**Why:** Native RN silently ignores unknown style keys, so a dimensions object that mixes
box props with a numeric `font` size never crashes on device — the bug is invisible until
the same object renders through react-native-web.

**How to apply:** Keep typography maps separate from container-dimension maps when a style
object is reused across `View` and `Text`. Put the font size in its own lookup and apply it
only as `fontSize` on `<Text>`. When debugging a web-only ErrorBoundary on an Expo screen,
read the browser console for the real error (it is often a style-coercion `TypeError`, not
the misleading "Invalid hook call" that can appear from unrelated Fast-Refresh noise).

**Repro trick (auth-gated screens):** to load a gated screen on web for a screenshot,
temporarily bypass the global AuthGate and inject a fake user behind a URL query flag, then
revert. This is how the UNO room crash was reproduced past the login gate.
