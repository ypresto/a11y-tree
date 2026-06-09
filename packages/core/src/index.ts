/**
 * a11y-tree
 *
 * Playwright-compatible accessibility tree for the live DOM, with ref
 * management and ref-based operation helpers. Three layers:
 *
 *   1. snapshot      — compute the accessibility tree
 *   2. refs          — map refs (`e3`) back to live elements
 *   3. operations    — click/type/fill/... on an element
 *
 * Plus `createDomController()` which ties layers 2 and 3 together.
 */

// Layer 1 — accessibility tree
export { snapshot, pageSnapshot } from './snapshot.js';
export type {
  AccessibilitySnapshot,
  PageSnapshot,
  SnapshotOptions,
  SnapshotMode,
} from './snapshot.js';

// Layer 2 — ref management
export { createRefStore, resolveRef } from './refs.js';
export type { RefStore } from './refs.js';

// Layer 3 — operation helpers
export {
  click,
  type,
  fill,
  selectOption,
  hover,
  drag,
  pressKey,
} from './operations.js';
export type { ClickOptions, TypeOptions } from './operations.js';

// Convenience controller (ties layers 2 + 3)
export { createDomController } from './controller.js';
export type { DomController } from './controller.js';
