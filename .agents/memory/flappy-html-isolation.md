---
name: Flappy Copointo as embedded HTML canvas game
description: Why/how Flappy runs as a self-contained HTML5 canvas page in a WebView/iframe, not a native RN screen.
---

# Flappy Copointo = self-contained HTML canvas in WebView/iframe

Flappy Copointo runs as a self-contained HTML5 `<canvas>` game (plain
`requestAnimationFrame`, no Reanimated) embedded with the SAME cross-platform
pattern the cafe map uses: web → `<iframe srcDoc sandbox="allow-scripts">`,
native → `react-native-webview`. The RN screen is a thin shell (loader, floating
back button, live coin pill) plus a `postMessage` bridge.

**Why:** the prior Reanimated `useFrameCallback` version crashed/stuttered in the
Replit Expo **web** preview and could take the whole app down. Isolating the game
in its own page means a game-level fault can't tear down Copointo, and a plain
canvas loop is stable on web.

**How to apply:**
- Bridge messages game→host: `coin`, `hi`, `gameover`, `back`. Host maps `coin`
  → `useCoins().addCoins(1)`, `back` → `router.back()` (returns to the hub).
- **Host (RN) is authoritative for daily coins/cap**, NOT the embedded page:
  recompute `todayStr()` per coin event, roll the day over, and reject past the
  daily cap before awarding/persisting. Persist on the same AsyncStorage keys the
  old version used so progress carries over.
- Bird (amber droplet) + coin "moon" are **canvas-drawn primitives** — do NOT
  base64-embed the real PNGs (coin asset is multi-MB; logo ~150KB).
- Seed initial hi/earned into the HTML via a script-safe JSON interpolation
  (escape `</script>`, U+2028/9), exactly like cafes-map.
- Web message listener must require `iframeRef.current` exists AND
  `e.source === iframeRef.current.contentWindow` before trusting a message.
