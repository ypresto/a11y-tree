/**
 * Vercel AI SDK tools for the a11y-tree.
 *
 * Unlike a server-side browser-automation bridge, these tools run **in the
 * browser** and act on the **current page's live DOM** through a
 * {@link DomController}. They are meant for a conversation/chat agent that
 * assists the user inside the page they are already on — so there is no
 * `navigate` or tab management here.
 *
 * Tool names and schemas mirror Playwright-MCP (`browser_snapshot`,
 * `browser_click`, …) so models recognize them, and every mutating tool
 * returns the fresh page snapshot afterwards to drive the agent loop.
 *
 * Requires the optional peer dependencies `ai` (v5) and `zod`.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createDomController, type DomController } from '@a11y-tree/core';

/** A mutating action about to run, surfaced to {@link A11yTreeToolsOptions.onBeforeAction}. */
export interface ToolAction {
  /** Tool name without the `browser_` prefix, e.g. `'click'`. */
  name: string;
  /** Human-readable element description from the model (when applicable). */
  element?: string;
  /** Target ref(s) from the latest snapshot (when applicable). */
  ref?: string;
  /** Remaining tool input, for auditing/UX. */
  details?: Record<string, unknown>;
}

export interface A11yTreeToolsOptions {
  /** Controller to drive. Defaults to `createDomController(root)`. */
  controller?: DomController;
  /** Root element when no controller is provided. Defaults to `document.body`. */
  root?: Element;
  /**
   * Prepend the `- Page URL / - Page Title / - Page Snapshot` header to
   * snapshot output (the Playwright-MCP page format). Default `true`.
   */
  pageHeader?: boolean;
  /**
   * Called before every mutating tool executes. Throw to cancel the action
   * (the thrown message is returned to the model). Use for user confirmation,
   * highlighting, or auditing.
   */
  onBeforeAction?: (action: ToolAction) => void | Promise<void>;
}

function formatSnapshot(yaml: string, pageHeader: boolean): string {
  if (!pageHeader) return yaml;
  const lines = [
    `- Page URL: ${window.location.href}`,
    `- Page Title: ${document.title}`,
    '- Page Snapshot:',
  ];
  for (const line of yaml.split('\n')) {
    if (line.trim()) lines.push(`  ${line}`);
  }
  return lines.join('\n');
}

async function waitForText(text: string, shouldExist: boolean, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const exists = document.body.textContent?.includes(text) ?? false;
    if (exists === shouldExist) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timeout waiting for text "${text}" to ${shouldExist ? 'appear' : 'disappear'}`);
}

const elementField = z
  .string()
  .describe('Human-readable element description, used for permission and auditing');
const refField = z.string().describe('Exact target element reference from the page snapshot');

/**
 * Create the a11y-tree AI SDK tool set bound to the current page's DOM.
 *
 * @example
 * ```ts
 * import { streamText } from 'ai';
 * import { createA11yTreeTools } from 'a11y-tree/ai';
 *
 * const result = streamText({
 *   model,
 *   tools: createA11yTreeTools(),
 *   stopWhen: stepCountIs(10),
 *   prompt: 'Fill in the signup form with test data and submit.',
 * });
 * ```
 */
export function createA11yTreeTools(options: A11yTreeToolsOptions = {}) {
  const controller = options.controller ?? createDomController(options.root);
  const pageHeader = options.pageHeader ?? true;
  const onBeforeAction = options.onBeforeAction;

  /** Take a fresh snapshot (refreshing refs) and format it for the model. */
  const freshSnapshot = (): string => formatSnapshot(controller.snapshot().yaml, pageHeader);

  const guard = async (action: ToolAction): Promise<void> => {
    if (onBeforeAction) await onBeforeAction(action);
  };

  return {
    browser_snapshot: tool({
      description:
        'Capture an accessibility snapshot of the current page. Better than a screenshot for understanding and acting on the page.',
      inputSchema: z.object({}),
      execute: async () => ({ snapshot: freshSnapshot() }),
    }),

    browser_click: tool({
      description: 'Perform a click on an element in the current page.',
      inputSchema: z.object({
        element: elementField,
        ref: refField,
        doubleClick: z.boolean().optional().describe('Double click instead of a single click'),
        button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button, defaults to left'),
      }),
      execute: async ({ element, ref, doubleClick, button }) => {
        await guard({ name: 'click', element, ref, details: { doubleClick, button } });
        controller.click(ref, {
          ...(doubleClick !== undefined ? { doubleClick } : {}),
          ...(button !== undefined ? { button } : {}),
        });
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_type: tool({
      description: 'Type text into an editable element (input or textarea).',
      inputSchema: z.object({
        element: elementField,
        ref: refField,
        text: z.string().describe('Text to type'),
        submit: z.boolean().optional().describe('Press Enter / submit the form after typing'),
        slowly: z
          .boolean()
          .optional()
          .describe('Type one character at a time to trigger key handlers. Defaults to all-at-once.'),
      }),
      execute: async ({ element, ref, text, submit, slowly }) => {
        await guard({ name: 'type', element, ref, details: { submit, slowly } });
        await controller.type(ref, text, {
          ...(submit !== undefined ? { submit } : {}),
          ...(slowly !== undefined ? { slowly } : {}),
        });
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_fill_form: tool({
      description: 'Fill multiple form fields at once.',
      inputSchema: z.object({
        fields: z
          .array(
            z.object({
              element: elementField,
              ref: refField,
              value: z.string().describe('Value to set'),
            }),
          )
          .describe('Fields to fill'),
      }),
      execute: async ({ fields }) => {
        await guard({ name: 'fillForm', details: { count: fields.length } });
        controller.fillForm(fields.map((f) => ({ ref: f.ref, value: f.value })));
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_select_option: tool({
      description: 'Select one or more options in a dropdown (<select>).',
      inputSchema: z.object({
        element: elementField,
        ref: refField,
        values: z.array(z.string()).describe('Option values to select'),
      }),
      execute: async ({ element, ref, values }) => {
        await guard({ name: 'selectOption', element, ref, details: { values } });
        controller.selectOption(ref, values);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_hover: tool({
      description: 'Hover the mouse over an element.',
      inputSchema: z.object({ element: elementField, ref: refField }),
      execute: async ({ element, ref }) => {
        await guard({ name: 'hover', element, ref });
        controller.hover(ref);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_drag: tool({
      description: 'Drag one element onto another.',
      inputSchema: z.object({
        startElement: z.string().describe('Human-readable description of the element to drag'),
        startRef: z.string().describe('Ref of the element to drag'),
        endElement: z.string().describe('Human-readable description of the drop target'),
        endRef: z.string().describe('Ref of the drop target'),
      }),
      execute: async ({ startElement, startRef, endElement, endRef }) => {
        await guard({ name: 'drag', element: startElement, ref: startRef, details: { endElement, endRef } });
        controller.drag(startRef, endRef);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_press_key: tool({
      description: 'Press a key on the currently focused element.',
      inputSchema: z.object({
        key: z.string().describe('Key name, e.g. "Enter", "ArrowDown", "a"'),
      }),
      execute: async ({ key }) => {
        await guard({ name: 'pressKey', details: { key } });
        controller.pressKey(key);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_wait_for: tool({
      description: 'Wait for text to appear or disappear, or for a number of seconds to pass.',
      inputSchema: z.object({
        time: z.number().optional().describe('Seconds to wait'),
        text: z.string().optional().describe('Text to wait for to appear'),
        textGone: z.string().optional().describe('Text to wait for to disappear'),
      }),
      execute: async ({ time, text, textGone }) => {
        if (time !== undefined) await new Promise((resolve) => setTimeout(resolve, time * 1000));
        if (text !== undefined) await waitForText(text, true);
        if (textGone !== undefined) await waitForText(textGone, false);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),
  };
}
