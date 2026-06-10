---
name: Copointo iPad / hub responsive scaling
description: How tablet/desktop scaling is applied on the hub (game) screen without breaking the iPhone layout, and the FAB-stack overlap constraint.
---

# Copointo hub (game.tsx) responsive scaling

All tablet/desktop enlargement on the hub screen is gated behind `s = r.scale`
from `useResponsive` (`1` on phone, `1.2` tablet, `1.3` desktop). Multiplying
sizes/offsets by `s` is a **no-op on phones**, so the iPhone layout stays
effectively unchanged — this is the safe way to add iPad support here.

**Constraint — the left-side floating-action-button (FAB) stack overlaps if
scaled too far.** The FABs are absolutely positioned with **fixed `+70px`
vertical step offsets** and buttons ~48–58px tall. Scaling a button with
`transform:[{scale}]` grows it about its `transformOrigin`; at scale 1.3 the
58px button grows past the 70px step and collides with the one above.

**Rule:** scale the FAB/header controls with a **capped** factor
`fabScale = Math.min(s, 1.2)`, NOT raw `s`. The level board (tiles + horizontal
`POSITIONS` offsets) may use full `s`. Anchor each FAB's `transformOrigin` to the
corner it's pinned to (`"left bottom"` for left stack, `"right bottom"` for the
right group, `"left/right top"` for header icons) so it grows inward, not off-screen.

**Why:** Apple rejected under Guideline 4 ("controls too small / iPad layout
broken"). Fix = `supportsTablet:true` + the existing centered `maxWidth` column +
this scaling. If you ever raise tablet/desktop `scale` in `useResponsive`, either
keep the FAB cap at the step size or recompute the stack offsets from scaled
heights instead of the literal `+70`.
