---
name: iOS Modal unmount-while-presented stuck bug
description: RN <Modal> dismissed by unmounting (early-return null) can stay stuck on iOS/iPad; drive with the `visible` prop instead.
---

# iOS/iPad RN Modal must be dismissed via `visible`, never by unmounting

A React Native `<Modal>` that is shown with a bare `visible` (i.e. `visible={true}`)
and dismissed by unmounting the whole component (`if (!state) return null;` above the
`return (<Modal …>)`) can get **stuck on screen on iOS/iPad** — the dismiss button
appears to "do nothing".

**Why:** unmounting a natively-presented modal mid-presentation interrupts iOS's
dismiss lifecycle, so the native dialog never tears down. This caused an App Store
rejection (Guideline 2.1(a)) where tapping the "تمام"/OK button produced no action.

**How to apply:** keep the `<Modal>` always mounted and bind `visible={!!state}`
(or `visible={cond && !!data}`). Guard the inner JSX that dereferences the data with
`{data && (…)}` (or optional chaining) so it doesn't crash while mounted-but-hidden.
The buy-coins screen already followed this correct pattern; the global auto-show
overlays (character-migration notice, coin-gift modal, gift animation) did not and
were the offenders. When adding any new RN Modal, default to the `visible`-prop form.
