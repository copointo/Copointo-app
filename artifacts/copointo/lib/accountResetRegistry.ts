/**
 * Each owned/equipped/inventory hook keeps a module-level `_cache` so all
 * subscribers share state without re-hitting AsyncStorage. Clearing
 * AsyncStorage alone is therefore not enough to wipe an account — the
 * stale `_cache` keeps broadcasting old values until the user reloads.
 *
 * Hooks register a handler here that resets their `_cache` to the empty
 * default and broadcasts it. `resetAccount()` invokes every registered
 * handler after wiping AsyncStorage, so the UI updates immediately.
 *
 * `_resetEpoch` is a monotonic counter bumped on every reset so async
 * hydration in-flight at reset time can detect it and discard its stale
 * result instead of overwriting the freshly cleared defaults.
 */
type Handler = () => void;
const handlers = new Set<Handler>();

let _resetEpoch = 0;

export function registerAccountResetHandler(h: Handler): () => void {
  handlers.add(h);
  return () => { handlers.delete(h); };
}

export function runAccountResetHandlers(): void {
  _resetEpoch++;
  for (const h of handlers) {
    try { h(); } catch {}
  }
}

export function getResetEpoch(): number {
  return _resetEpoch;
}
