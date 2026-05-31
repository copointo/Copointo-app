---
name: RN image won't render — extension must match real content
description: Blank RN/Expo image despite correct require usually means the file's bytes don't match its extension.
---

# RN/Expo: image renders blank when extension lies about content

**Symptom:** An image require is correct, the render path is correct, but
the image never appears (blank tile) — and replacing the file or busting
Metro cache does NOT help.

**Root cause:** Metro/React Native pick a decoder by file EXTENSION, not by
the actual bytes. A file named `foo.png` that actually contains JPEG (or
HEIC) data fails to decode → blank, especially on native/iOS.

**Why it bites here:** user-attached "PNG" screenshots from iPhones are
frequently JPEG (or HEIC) under a `.PNG` name. Copying that straight into
`assets/images/foo.png` produces a mislabeled file.

**How to apply:** when an Expo image won't show, run `file <path>` to check
the TRUE container, then save the asset with the matching extension
(`.jpg` for JPEG data) and update the `require(...)`. Don't keep chasing it
as a cache problem. Metro supports jpg/jpeg/png/gif/webp by default.
