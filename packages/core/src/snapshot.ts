/**
 * Layer 1 — Accessibility tree.
 *
 * Computes a Playwright-compatible ARIA accessibility snapshot from a live DOM
 * subtree. This is a from-scratch computation of the accessibility tree (role
 * resolution + accessible name/description per ARIA 1.2), rendered as the
 * Playwright-MCP "aria snapshot" YAML. It is NOT the browser's native
 * Accessibility Object Model (AOM).
 */

import { generateAriaTree, renderAriaTree, type AriaSnapshot } from './playwright/ariaSnapshot.js';

export type SnapshotMode = 'ai' | 'expect' | 'autoexpect' | 'codegen';

export interface SnapshotOptions {
  /**
   * Rendering mode.
   * - `'ai'` (default): AI-optimized, emits interactable refs like `[ref=e3]`.
   *   This is the Playwright-MCP format.
   * - `'expect'` / `'autoexpect'` / `'codegen'`: assertion-oriented, no refs.
   */
  mode?: SnapshotMode;
  /** Prefix prepended to every ref (useful to namespace refs across frames). */
  refPrefix?: string;
  /**
   * Diff baseline. When set, `yaml` contains only the subtrees that changed
   * since this snapshot, with `- ref=eN [unchanged]` placeholders for stable
   * ones and a `<changed>` marker on each changed root (the Playwright-MCP
   * incremental snapshot). The `elements` map is always complete, so every
   * ref still resolves regardless of what the diff omits.
   */
  previous?: AccessibilitySnapshot;
}

export interface AccessibilitySnapshot {
  /**
   * Playwright-MCP compatible YAML tree, e.g. `- button "Submit" [ref=e3]`.
   */
  yaml: string;
  /** Map from ref (e.g. `"e3"`) to the live DOM element it represents. */
  elements: Map<string, Element>;
}

export interface PageSnapshot extends AccessibilitySnapshot {
  url: string;
  title: string;
}

/**
 * Each public snapshot carries its internal Playwright tree here (privately),
 * so a later snapshot can be diffed against it via {@link SnapshotOptions.previous}
 * without leaking the internal tree type into the public surface.
 */
const treeBySnapshot = new WeakMap<AccessibilitySnapshot, AriaSnapshot>();

/**
 * Compute the accessibility tree for a DOM subtree.
 *
 * @param root Root element to snapshot. Defaults to `document.body`.
 */
export function snapshot(
  root: Element = document.body,
  options: SnapshotOptions = {},
): AccessibilitySnapshot {
  const mode = options.mode ?? 'ai';
  const treeOptions = { mode, ...(options.refPrefix ? { refPrefix: options.refPrefix } : {}) };
  const aria = generateAriaTree(root, treeOptions);
  const previousTree = options.previous ? treeBySnapshot.get(options.previous) : undefined;
  const yaml = renderAriaTree(aria, treeOptions, previousTree);
  const result: AccessibilitySnapshot = { yaml, elements: aria.elements };
  treeBySnapshot.set(result, aria);
  return result;
}

/**
 * Compute the accessibility tree for the whole page, prefixed with the
 * Playwright-MCP page header (`- Page URL:` / `- Page Title:` / `- Page Snapshot:`).
 */
export function pageSnapshot(options: SnapshotOptions = {}): PageSnapshot {
  const inner = snapshot(document.body, options);
  const url = window.location.href;
  const title = document.title;

  const lines = [`- Page URL: ${url}`, `- Page Title: ${title}`, '- Page Snapshot:'];
  for (const line of inner.yaml.split('\n')) {
    if (line.trim()) lines.push(`  ${line}`);
  }

  const result: PageSnapshot = { yaml: lines.join('\n'), elements: inner.elements, url, title };
  // Re-key the inner tree onto the page snapshot so it can be a diff baseline.
  const tree = treeBySnapshot.get(inner);
  if (tree) treeBySnapshot.set(result, tree);
  return result;
}
