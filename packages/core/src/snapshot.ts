/**
 * Layer 1 — Accessibility tree.
 *
 * Computes a Playwright-compatible ARIA accessibility snapshot from a live DOM
 * subtree. This is a from-scratch computation of the accessibility tree (role
 * resolution + accessible name/description per ARIA 1.2), rendered as the
 * Playwright-MCP "aria snapshot" YAML. It is NOT the browser's native
 * Accessibility Object Model (AOM).
 */

import { generateAriaTree, renderAriaTree } from './playwright/ariaSnapshot.js';

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
  const yaml = renderAriaTree(aria, treeOptions);
  return { yaml, elements: aria.elements };
}

/**
 * Compute the accessibility tree for the whole page, prefixed with the
 * Playwright-MCP page header (`- Page URL:` / `- Page Title:` / `- Page Snapshot:`).
 */
export function pageSnapshot(options: SnapshotOptions = {}): PageSnapshot {
  const { yaml: tree, elements } = snapshot(document.body, options);
  const url = window.location.href;
  const title = document.title;

  const lines = [`- Page URL: ${url}`, `- Page Title: ${title}`, '- Page Snapshot:'];
  for (const line of tree.split('\n')) {
    if (line.trim()) lines.push(`  ${line}`);
  }

  return { yaml: lines.join('\n'), elements, url, title };
}
