/**
 * Layer 2 — Ref management.
 *
 * The accessibility snapshot (Layer 1) assigns a stable ref (e.g. `"e3"`) to
 * each interactable element. This layer keeps the latest snapshot's
 * `ref -> Element` map and resolves refs back to live DOM elements, so callers
 * can act on `"e3"` without holding element handles themselves.
 */

import { snapshot, type AccessibilitySnapshot, type SnapshotOptions } from './snapshot.js';

/**
 * Resolve a ref against a specific snapshot. Pure — no shared state.
 */
export function resolveRef(snap: AccessibilitySnapshot, ref: string): Element | undefined {
  return snap.elements.get(ref);
}

export interface RefStore {
  /** The most recent snapshot, or `undefined` before the first `refresh()`. */
  readonly current: AccessibilitySnapshot | undefined;
  /** Take a fresh snapshot, remember its refs, and return it. */
  refresh(root?: Element, options?: SnapshotOptions): AccessibilitySnapshot;
  /** Resolve a ref to a live element from the most recent snapshot. */
  resolve(ref: string): Element | undefined;
  /** Forget the current snapshot. */
  clear(): void;
}

/**
 * Create a ref store that tracks the latest snapshot's `ref -> Element` map.
 */
export function createRefStore(): RefStore {
  let latest: AccessibilitySnapshot | undefined;

  return {
    get current() {
      return latest;
    },
    refresh(root, options) {
      latest = snapshot(root, options);
      return latest;
    },
    resolve(ref) {
      return latest ? resolveRef(latest, ref) : undefined;
    },
    clear() {
      latest = undefined;
    },
  };
}
