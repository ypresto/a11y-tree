/**
 * The a11y-tree handle.
 *
 * The library's primary stateful interface: a durable, page-state-agnostic
 * handle, rooted at any DOM subtree, that you hold and drive purely with ref
 * strings from the latest snapshot. It ties Layer 2 (ref management) and
 * Layer 3 (operations) together; on a ref miss it re-snapshots once before
 * failing, mirroring Playwright-MCP's "snapshot then act" loop.
 */

import { createRefStore } from './refs.js';
import type { AccessibilitySnapshot, SnapshotOptions } from './snapshot.js';
import * as ops from './operations.js';

export interface HandleSnapshotOptions extends SnapshotOptions {
  /**
   * Render the complete tree instead of a diff against the previous snapshot.
   * The handle diffs by default (it remembers the last snapshot it returned) so
   * snapshots stay small across the agent loop; pass `full: true` to get the
   * whole tree, e.g. when the consumer asks to see the entire page.
   */
  full?: boolean;
}

export interface A11yTreeHandle {
  /**
   * Take a fresh snapshot, refresh the ref store, and return it.
   *
   * By default this diffs against the previous snapshot this handle returned
   * (only changed subtrees, with `[unchanged]` placeholders). Pass
   * `{ full: true }` for the complete tree, or `{ previous }` to diff against a
   * specific snapshot.
   */
  snapshot(options?: HandleSnapshotOptions): AccessibilitySnapshot;
  /** Resolve a ref to a live element (re-snapshotting once on a miss). */
  resolve(ref: string): Element;
  click(ref: string, options?: ops.ClickOptions): void;
  type(ref: string, text: string, options?: ops.TypeOptions): Promise<void>;
  fill(ref: string, value: string): void;
  fillForm(fields: ReadonlyArray<{ ref: string; value: string }>): void;
  selectOption(ref: string, values: string[]): void;
  hover(ref: string): void;
  drag(fromRef: string, toRef: string): void;
  /** Press a key on the active element (or the handle's root). */
  pressKey(key: string): void;
}

/**
 * Create an a11y-tree handle rooted at `root` (default `document.body`).
 */
export function createA11yTreeHandle(root: Element = document.body): A11yTreeHandle {
  const store = createRefStore();
  // The last snapshot returned to the caller — the diff baseline. Kept separate
  // from the ref store's `current`, which also advances on internal
  // re-snapshots (on a ref miss) that the caller never sees.
  let previous: AccessibilitySnapshot | undefined;

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
      const { full, previous: explicitPrevious, ...rest } = options ?? {};
      const baseline = full ? undefined : (explicitPrevious ?? previous);
      const snap = store.refresh(root, {
        ...rest,
        ...(baseline ? { previous: baseline } : {}),
      });
      previous = snap;
      return snap;
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
