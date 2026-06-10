/**
 * Vercel AI SDK tools for the a11y-tree.
 *
 * Unlike a server-side browser-automation bridge, these tools run **in the
 * browser** and act on the **current page's live DOM** through an
 * {@link A11yTreeHandle}. They are meant for a conversation/chat agent that
 * assists the user inside the page they are already on — so there is no
 * `navigate` or tab management here.
 *
 * Tool names and schemas mirror Playwright-MCP (`browser_snapshot`,
 * `browser_click`, …) so models recognize them, and every mutating tool
 * returns the fresh page snapshot afterwards to drive the agent loop — as a
 * diff against the previous snapshot, so only what changed is sent back.
 * `browser_snapshot` itself always returns the full tree.
 *
 * Requires the optional peer dependencies `ai` (v5) and `zod`.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { createA11yTreeHandle, type A11yTreeHandle } from 'a11y-tree';

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
  /** Handle to drive. Defaults to `createA11yTreeHandle(root)`. */
  handle?: A11yTreeHandle;
  /** Root element when no handle is provided. Defaults to `document.body`. */
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
 * Tool name → `{ description, inputSchema }`, shared by {@link createA11yTreeTools}
 * (which adds DOM-driving `execute`) and {@link createA11yTreeToolSchemas} (which
 * does not). Defining the schemas once keeps the client executor and the server
 * tool definition in lockstep. No DOM access here — safe to import on a server.
 */
const toolDefs = {
  browser_snapshot: {
    description:
      'Capture an accessibility snapshot of the current page. Better than a screenshot for understanding and acting on the page.',
    inputSchema: z.object({}),
  },
  browser_click: {
    description: 'Perform a click on an element in the current page.',
    inputSchema: z.object({
      element: elementField,
      ref: refField,
      doubleClick: z.boolean().optional().describe('Double click instead of a single click'),
      button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button, defaults to left'),
    }),
  },
  browser_type: {
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
  },
  browser_fill_form: {
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
  },
  browser_select_option: {
    description: 'Select one or more options in a dropdown (<select>).',
    inputSchema: z.object({
      element: elementField,
      ref: refField,
      values: z.array(z.string()).describe('Option values to select'),
    }),
  },
  browser_hover: {
    description: 'Hover the mouse over an element.',
    inputSchema: z.object({ element: elementField, ref: refField }),
  },
  browser_drag: {
    description: 'Drag one element onto another.',
    inputSchema: z.object({
      startElement: z.string().describe('Human-readable description of the element to drag'),
      startRef: z.string().describe('Ref of the element to drag'),
      endElement: z.string().describe('Human-readable description of the drop target'),
      endRef: z.string().describe('Ref of the drop target'),
    }),
  },
  browser_press_key: {
    description: 'Press a key on the currently focused element.',
    inputSchema: z.object({
      key: z.string().describe('Key name, e.g. "Enter", "ArrowDown", "a"'),
    }),
  },
  browser_wait_for: {
    description: 'Wait for text to appear or disappear, or for a number of seconds to pass.',
    inputSchema: z.object({
      time: z.number().optional().describe('Seconds to wait'),
      text: z.string().optional().describe('Text to wait for to appear'),
      textGone: z.string().optional().describe('Text to wait for to disappear'),
    }),
  },
} as const;

/**
 * Tool *schemas* only — no `execute`, no DOM access. Use these on the **server**
 * (e.g. in `streamText`) so the model emits tool calls; your **client** then
 * runs them against the live DOM with {@link createA11yTreeTools} from
 * `useChat`'s `onToolCall`. Safe to import in a Node server route, where
 * `createA11yTreeTools` cannot run (it touches `document`).
 *
 * @example
 * ```ts
 * // app/api/chat/route.ts (server)
 * import { streamText, convertToModelMessages, stepCountIs } from 'ai';
 * import { createA11yTreeToolSchemas } from '@a11y-tree/ai-sdk';
 *
 * export async function POST(req: Request) {
 *   const { messages } = await req.json();
 *   const result = streamText({
 *     model,
 *     messages: convertToModelMessages(messages),
 *     tools: createA11yTreeToolSchemas(), // no execute → client tools
 *     stopWhen: stepCountIs(20),
 *   });
 *   return result.toUIMessageStreamResponse();
 * }
 * ```
 */
export function createA11yTreeToolSchemas() {
  return {
    browser_snapshot: tool(toolDefs.browser_snapshot),
    browser_click: tool(toolDefs.browser_click),
    browser_type: tool(toolDefs.browser_type),
    browser_fill_form: tool(toolDefs.browser_fill_form),
    browser_select_option: tool(toolDefs.browser_select_option),
    browser_hover: tool(toolDefs.browser_hover),
    browser_drag: tool(toolDefs.browser_drag),
    browser_press_key: tool(toolDefs.browser_press_key),
    browser_wait_for: tool(toolDefs.browser_wait_for),
  };
}

/**
 * Create the a11y-tree AI SDK tool set bound to the current page's DOM. These
 * tools have `execute` and touch `document`, so they run **in the browser**.
 * For the server side, pair with {@link createA11yTreeToolSchemas}.
 *
 * @example
 * ```ts
 * import { streamText } from 'ai';
 * import { createA11yTreeTools } from '@a11y-tree/ai-sdk';
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
  const handle = options.handle ?? createA11yTreeHandle(options.root);
  const pageHeader = options.pageHeader ?? true;
  const onBeforeAction = options.onBeforeAction;

  /**
   * Take a fresh snapshot (refreshing refs) and format it for the model.
   * After an action the handle returns a diff against the previous snapshot
   * (small, token-cheap); pass `full` for the complete tree.
   */
  const freshSnapshot = (full = false): string =>
    formatSnapshot(handle.snapshot({ full }).yaml, pageHeader);

  const guard = async (action: ToolAction): Promise<void> => {
    if (onBeforeAction) await onBeforeAction(action);
  };

  return {
    browser_snapshot: tool({
      ...toolDefs.browser_snapshot,
      // An explicit snapshot request always returns the full page tree.
      execute: async () => ({ snapshot: freshSnapshot(true) }),
    }),

    browser_click: tool({
      ...toolDefs.browser_click,
      execute: async ({ element, ref, doubleClick, button }) => {
        await guard({ name: 'click', element, ref, details: { doubleClick, button } });
        handle.click(ref, {
          ...(doubleClick !== undefined ? { doubleClick } : {}),
          ...(button !== undefined ? { button } : {}),
        });
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_type: tool({
      ...toolDefs.browser_type,
      execute: async ({ element, ref, text, submit, slowly }) => {
        await guard({ name: 'type', element, ref, details: { submit, slowly } });
        await handle.type(ref, text, {
          ...(submit !== undefined ? { submit } : {}),
          ...(slowly !== undefined ? { slowly } : {}),
        });
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_fill_form: tool({
      ...toolDefs.browser_fill_form,
      execute: async ({ fields }) => {
        await guard({ name: 'fillForm', details: { count: fields.length } });
        handle.fillForm(fields.map((f) => ({ ref: f.ref, value: f.value })));
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_select_option: tool({
      ...toolDefs.browser_select_option,
      execute: async ({ element, ref, values }) => {
        await guard({ name: 'selectOption', element, ref, details: { values } });
        handle.selectOption(ref, values);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_hover: tool({
      ...toolDefs.browser_hover,
      execute: async ({ element, ref }) => {
        await guard({ name: 'hover', element, ref });
        handle.hover(ref);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_drag: tool({
      ...toolDefs.browser_drag,
      execute: async ({ startElement, startRef, endElement, endRef }) => {
        await guard({ name: 'drag', element: startElement, ref: startRef, details: { endElement, endRef } });
        handle.drag(startRef, endRef);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_press_key: tool({
      ...toolDefs.browser_press_key,
      execute: async ({ key }) => {
        await guard({ name: 'pressKey', details: { key } });
        handle.pressKey(key);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),

    browser_wait_for: tool({
      ...toolDefs.browser_wait_for,
      execute: async ({ time, text, textGone }) => {
        if (time !== undefined) await new Promise((resolve) => setTimeout(resolve, time * 1000));
        if (text !== undefined) await waitForText(text, true);
        if (textGone !== undefined) await waitForText(textGone, false);
        return { success: true, snapshot: freshSnapshot() };
      },
    }),
  };
}
