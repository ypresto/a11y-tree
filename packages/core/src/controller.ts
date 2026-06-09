/**
 * Convenience controller.
 *
 * Ties Layer 2 (ref management) and Layer 3 (operations) together so callers
 * can drive the page purely with ref strings from the latest snapshot. On a
 * ref miss it re-snapshots once before failing, mirroring Playwright-MCP's
 * "snapshot then act" loop.
 */

import { createRefStore } from './refs.js';
import type { AccessibilitySnapshot, SnapshotOptions } from './snapshot.js';
import * as ops from './operations.js';

export interface DomController {
  /** Take a fresh snapshot, refresh the ref store, and return it. */
  snapshot(options?: SnapshotOptions): AccessibilitySnapshot;
  /** Resolve a ref to a live element (re-snapshotting once on a miss). */
  resolve(ref: string): Element;
  click(ref: string, options?: ops.ClickOptions): void;
  type(ref: string, text: string, options?: ops.TypeOptions): Promise<void>;
  fill(ref: string, value: string): void;
  fillForm(fields: ReadonlyArray<{ ref: string; value: string }>): void;
  selectOption(ref: string, values: string[]): void;
  hover(ref: string): void;
  drag(fromRef: string, toRef: string): void;
  /** Press a key on the active element (or the controller root). */
  pressKey(key: string): void;
}

/**
 * Create a controller rooted at `root` (default `document.body`).
 */
export function createDomController(root: Element = document.body): DomController {
  const store = createRefStore();

  const resolve = (ref: string): Element => {
    let element = store.resolve(ref);
    if (!element) {
      store.refresh(root);
      element = store.resolve(ref);
    }
    if (!element) throw new Error(`Element not found: ${ref}`);
    return element;
  };

  return {
    snapshot(options) {
      return store.refresh(root, options);
    },
    resolve,
    click(ref, options) {
      ops.click(resolve(ref), options);
    },
    type(ref, text, options) {
      return ops.type(resolve(ref), text, options);
    },
    fill(ref, value) {
      ops.fill(resolve(ref), value);
    },
    fillForm(fields) {
      for (const field of fields) ops.fill(resolve(field.ref), field.value);
    },
    selectOption(ref, values) {
      ops.selectOption(resolve(ref), values);
    },
    hover(ref) {
      ops.hover(resolve(ref));
    },
    drag(fromRef, toRef) {
      ops.drag(resolve(fromRef), resolve(toRef));
    },
    pressKey(key) {
      const target = root.ownerDocument.activeElement ?? root;
      ops.pressKey(target, key);
    },
  };
}
