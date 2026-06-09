---
name: Admin cafe-dashboard gold surface theme
description: What "gold theme" means for the cafe dashboard and which surfaces are intentionally excluded.
---

# Cafe dashboard "gold" surface theme

The cafe dashboard (`artifacts/admin/src/pages/CafeDashboardPage.tsx`) was unified to the
manager-analytics GoldStat/SectionCard look: dark diagonal gradient
(`bg-gradient-to-br from-[#0C0807] via-[#080504] to-black`), gold border
(`border-[#E8B86D]/20–30`), a top hairline highlight, and an amber drop shadow. The
shared `Card`/`StatBox`/`Inp`/`Sel` helpers carry it, so most surfaces inherit it.

**Intentionally NOT gilded (do not "fix" these):**
- **Order-status cards** — their green/red/orange/blue coloring is *functional* state
  signaling (paid / pending / etc.) and mirrors how GoldStat itself varies accent. They
  sit on dark/gold infrastructure already.
- **Small interaction controls** — segmented/toggle pills, file-picker label buttons, and
  inline text inputs stay neutral. Gilding them flattens visual hierarchy and removes
  affordance.

**Why:** the request was "make all *section surfaces* match the manager gold theme," not
"make everything gold." Over-gilding controls/status was reviewed and rejected as harmful
to scanability.

**How to apply:** when adding a new section/modal surface, wrap it in `Card` or reuse the
gradient+gold-border string. For sticky headers/footers/table-heads use solid
`bg-[#0C0807]` (opaque, matches the gradient top, no seam) with `border-[#E8B86D]/15`
dividers. The `--border` CSS token is already amber-tinted, so internal content dividers
need no change.
