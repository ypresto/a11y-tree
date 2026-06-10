# a11y-tree

**Playwright-compatible accessibility tree for the live DOM — snapshot it, reference it, drive it.**

A computed accessibility tree (ARIA snapshot) from the live DOM, with ref management
and ref-based DOM operations (click/type/fill) — plus ready-made Vercel AI SDK tools
for in-browser conversation agents. The accessibility-tree computation is vendored
from [Playwright](https://github.com/microsoft/playwright), so the output matches the
Playwright-MCP "aria snapshot" format your agents already understand.

> **Is this AOM?** No — it's an independent re-computation of the accessibility tree
> (role + accessible name per ARIA 1.2), the same way Playwright does it. It does not
> read the browser's native accessibility tree and is not the W3C Accessibility Object
> Model (AOM) API. See [Is this AOM?](#is-this-aom) below.

## Packages

| Package | Description | Deps |
| --- | --- | --- |
| [`a11y-tree`](https://github.com/ypresto/a11y-tree/tree/main/packages/core) | The accessibility tree: snapshot + ref management + ref-based operations (click/type/fill). | none |
| [`@a11y-tree/ai-sdk`](https://github.com/ypresto/a11y-tree/tree/main/packages/ai-sdk) | Vercel AI SDK tools that drive the current page via `a11y-tree`. | `a11y-tree`, peer `ai`/`zod` |

```sh
pnpm add a11y-tree            # just the accessibility tree
pnpm add @a11y-tree/ai-sdk ai zod   # + AI SDK conversation tools
```

Both packages run in the browser (they walk the live DOM). Use them in a content
script, a bundled web app, or any DOM environment.

## `a11y-tree` — the accessibility tree

Organized as three independent layers plus the primary stateful handle.

### Retrieve Accessibility tree — `snapshot`

```ts
import { snapshot, pageSnapshot } from 'a11y-tree';

const { yaml, elements } = snapshot(document.body);
// yaml:
//   - button "Submit" [ref=e3]
//   - textbox "Email" [ref=e4]
// elements: Map { "e3" => <button>, "e4" => <input> }

// Or the full Playwright-MCP page snapshot (with URL/title header):
const page = pageSnapshot();
```

### 3. Operations — `click`, `type`, `fill`, …

Pure helpers that perform one interaction on an element by dispatching synthetic
events. They take an `Element`, never a ref.

```ts
import { click, type, fill, selectOption, hover } from 'a11y-tree';

click(el);
await type(el, 'hello', { submit: true });
fill(el, 'value');
selectOption(el, ['option-b']);
hover(el);
```

### The handle — `createA11yTreeHandle`

The library's primary stateful interface: a durable, page-state-agnostic handle,
rooted at any DOM subtree, that ties layers 2 + 3 so you can drive the page with ref
strings. On a ref miss it re-snapshots once before failing (the Playwright-MCP
"snapshot then act" loop).

```ts
import { createA11yTreeHandle } from 'a11y-tree';

const handle = createA11yTreeHandle();   // optional root, defaults to document.body
const { yaml } = handle.snapshot();      // feed `yaml` to your agent

// agent replies with refs from the snapshot:
handle.click('e3');
await handle.type('e4', 'user@example.com');
handle.fillForm([{ ref: 'e4', value: 'user@example.com' }]);
```

**Incremental snapshots (diff by default).** The handle remembers the last snapshot
it returned and, by default, the next `snapshot()` renders only what changed since
then — changed subtrees marked `<changed>`, with everything stable dropped or
collapsed to `- ref=eN [unchanged]`. This keeps each turn of an agent loop small.
The `elements` map is always complete, so every ref still resolves even if the diff
omits it. Pass `{ full: true }` for the whole tree, or `{ previous }` to diff against
a specific snapshot.

```ts
const first = handle.snapshot();                // full tree (no previous yet)
handle.click('e3');                             // ...page changes...
const diff = handle.snapshot();                 // only the changed parts
const whole = handle.snapshot({ full: true });  // force the full tree again
```

## `@a11y-tree/ai-sdk` — Vercel AI SDK tools

A ready-made tool set for an **in-browser conversation agent**, built on `a11y-tree`.
The tools run on the page the user is already on (no server, no tabs, no `navigate`)
and act on the live DOM. Tool names and schemas mirror Playwright-MCP so models
recognize them, and every action returns the fresh page snapshot to drive the loop —
as a diff against the previous one (only what changed), while `browser_snapshot`
itself always returns the full tree.

`ai` (v5) and `zod` are **peer dependencies** — your app provides them (it already
uses the AI SDK).

```ts
import { streamText, stepCountIs } from 'ai';
import { createA11yTreeTools } from '@a11y-tree/ai-sdk';

const result = streamText({
  model,                              // any browser-usable AI SDK model
  tools: createA11yTreeTools(),       // browser_snapshot / browser_click / browser_type / ...
  stopWhen: stepCountIs(10),
  prompt: 'Fill in the signup form with test data and submit.',
});
```

Gate or audit actions before they touch the user's page with `onBeforeAction`
(throw to deny):

```ts
const tools = createA11yTreeTools({
  onBeforeAction: async ({ name, element, ref }) => {
    if (!(await confirmWithUser(`${name} on ${element ?? ref}?`))) {
      throw new Error('User declined this action');
    }
  },
});
```

The snippet above runs the whole loop in one place. For a real chat app, the model
runs on your **server** (with your API key) but the tools must run in the **browser**
(they touch `document`). Split it:

- **Server** — give `streamText` the tool *schemas* (`createA11yTreeToolSchemas()`,
  no `execute`, safe to import in a Node route) so tool calls stream to the client
  instead of running on the server.
- **Client** — run the tools against the live DOM in `@ai-sdk/react`'s `useChat`
  `onToolCall` (via `createA11yTreeTools()`), returning each result with
  `addToolResult`; `sendAutomaticallyWhen` continues the loop.

```ts
// server: app/api/chat/route.ts
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { createA11yTreeToolSchemas } from '@a11y-tree/ai-sdk';

const result = streamText({
  model,
  messages: convertToModelMessages(messages),
  tools: createA11yTreeToolSchemas(),   // schemas only → client-side tools
  stopWhen: stepCountIs(20),
});
```

```ts
// client: useChat onToolCall
const tools = createA11yTreeTools();    // runs in the browser, on the live DOM
useChat({
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  async onToolCall({ toolCall }) {
    const output = await tools[toolCall.toolName].execute(toolCall.input, opts);
    addToolResult({ tool: toolCall.toolName, toolCallId: toolCall.toolCallId, output });
  },
});
```

See [`example/`](example) for a complete, runnable Next.js app of exactly this.

**Tools:** `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`,
`browser_select_option`, `browser_hover`, `browser_drag`, `browser_press_key`,
`browser_wait_for`.

**`createA11yTreeTools(options?)`** (browser; tools have `execute`):

- `handle` — an `A11yTreeHandle` from `a11y-tree` to drive. Defaults to
  `createA11yTreeHandle(root)`.
- `root` — root element when no handle is given. Defaults to `document.body`.
- `pageHeader` — prepend the `- Page URL / - Page Title / - Page Snapshot` header
  to snapshots. Default `true`.
- `onBeforeAction(action)` — called before every mutating tool; throw to cancel.

**`createA11yTreeToolSchemas()`** (server; same tools, no `execute` / no DOM) —
pair with `createA11yTreeTools()` on the client.

## Is this AOM?

No. The **Accessibility Object Model (AOM)** is a draft browser API that would expose
the browser's *own* computed accessibility tree to JavaScript. `a11y-tree` instead
**re-computes** the accessibility tree itself in JS by applying the ARIA 1.2 role and
accessible-name algorithms to the DOM (this is Playwright's approach). It is a
*representation of an accessibility tree*, but not a read-out of the browser's AOM —
so results approximate, and may differ slightly from, what a screen reader sees.

## Development

```sh
pnpm install
pnpm build       # build the packages (topological)
pnpm test        # run all tests (real browser via Playwright)
pnpm typecheck
pnpm example:dev # run the example Next.js app (needs the packages built first)
```

The `build` / `test` / `typecheck` scripts cover the `packages/*` libraries; the
runnable demo lives in [`example/`](example).

## License

[Apache-2.0](https://github.com/ypresto/a11y-tree/blob/main/LICENSE). Portions of
`a11y-tree` under `packages/core/src/playwright/` are derived from
[Playwright](https://github.com/microsoft/playwright) (Copyright Microsoft
Corporation), also Apache-2.0; see
[NOTICE](https://github.com/ypresto/a11y-tree/blob/main/NOTICE).
