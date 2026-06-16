---
name: iOS/iPad presented-Modal unmount bug
description: Why RN <Modal> must be toggled via `visible`, never conditionally unmounted, in Copointo mobile
---

# iOS/iPad presented-Modal unmount bug

On iOS (notably iPad), UNMOUNTING a React Native `<Modal>` while it is still
presented can leave the native dialog stuck on screen. The user's dismiss/CTA
tap then "produces no further action" because the app is blocked behind the
ghost modal.

**The rule:** any `<Modal>` whose visibility depends on state/props must be kept
mounted and driven by `visible={!!x}`, with its body guarded by `{x && (...)}`
and any derived values made null-safe. Never use `if (!x) return null` above a
`<Modal>`, and never render a `<Modal>` only inside one branch of a conditional
that flips after the dialog is shown (e.g. an auth gate that drops its login
modal once `user` becomes truthy).

**Why:** This exact class caused an Apple App Review rejection (Guideline 2.1,
App Completeness) on iPad — "Tapping Ok after we logged in produced no further
action." The login `AuthModal` was rendered only inside the `!user` branch, so a
successful login unmounted a presented modal and left it stuck.

**How to apply:** When adding/reviewing any mobile modal, confirm it toggles
`visible` rather than unmounting. Components already converted to the safe
pattern: AuthGate (mounts AuthModal always, `visible={!user}`), AuthModal,
CharacterMigrationNotice, CoinGiftModal, LevelRewardModal, CoinMilestoneModal.
Audit new post-login/overlay modals the same way.
