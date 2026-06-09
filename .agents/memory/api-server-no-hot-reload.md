---
name: api-server does not hot-reload
description: Editing api-server route/handler code does NOT take effect until the workflow is restarted.
---

The `api-server` workflow keeps serving the previously-loaded code after you edit
its TypeScript sources — it does not watch/reload. Symptoms of a stale server:
new response fields are missing/`undefined` and clients see the OLD JSON shape
even though the file on disk is correct and typechecks clean.

**Why:** the running process is not a watch-mode dev server; it holds the bundle/
module graph loaded at boot.

**How to apply:** after ANY edit to `artifacts/api-server` that changes runtime
behavior (new route fields, handler logic), restart the workflow
`artifacts/api-server: API Server` before testing via curl or the admin UI.
Verifying the disk file or typecheck is NOT proof the live endpoint changed —
curl the real endpoint and confirm the new fields are present.
