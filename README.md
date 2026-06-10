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
| [`a11y-tree`](packages/core) | The accessibility tree: snapshot + ref management + ref-based operations (click/type/fill). | none |
| [`@a11y-tree/ai-sdk`](packages/ai-sdk) | Vercel AI SDK tools that drive the current page via `a11y-tree`. | `a11y-tree`, peer `ai`/`zod` |

```sh
pnpm add a11y-tree            # just the accessibility tree
pnpm add @a11y-tree/ai-sdk ai zod   # + AI SDK conversation tools
```

Both packages run in the browser (they walk the live DOM). Use them in a content
script, a bundled web app, or any DOM environment.

## `a11y-tree` — the accessibility tree

Organized as three independent layers plus the primary stateful handle.

### 1. Accessibility tree — `snapshot`

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

### 2. Ref management — `createRefStore`

Each interactable element gets a stable ref (`e3`). The ref store keeps the latest
snapshot's `ref -> Element` map and resolves refs back to live elements.

```ts
import { createRefStore } from 'a11y-tree';

const store = createRefStore();
store.refresh();                 // take a snapshot, remember its refs
const el = store.resolve('e3');  // -> the live <button>, or undefined
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

## `@a11y-tree/ai-sdk` — Vercel AI SDK tools

A ready-made tool set for an **in-browser conversation agent**, built on `a11y-tree`.
The tools run on the page the user is already on (no server, no tabs, no `navigate`)
and act on the live DOM. Tool names and schemas mirror Playwright-MCP so models
recognize them, and every action returns the fresh page snapshot to drive the loop.

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

With `@ai-sdk/react`'s `useChat`, wire these into your client-side tool execution
(e.g. `onToolCall`) so the model drives the page the user is viewing.

**Tools:** `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`,
`browser_select_option`, `browser_hover`, `browser_drag`, `browser_press_key`,
`browser_wait_for`.

**`createA11yTreeTools(options?)`:**

- `handle` — an `A11yTreeHandle` from `a11y-tree` to drive. Defaults to
  `createA11yTreeHandle(root)`.
- `root` — root element when no handle is given. Defaults to `document.body`.
- `pageHeader` — prepend the `- Page URL / - Page Title / - Page Snapshot` header
  to snapshots. Default `true`.
- `onBeforeAction(action)` — called before every mutating tool; throw to cancel.

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
pnpm build       # build all packages (topological)
pnpm test        # run all tests (real browser via Playwright)
pnpm typecheck
```

## License

MIT. Portions of `a11y-tree` under `packages/core/src/playwright/` are derived from
Playwright and licensed under Apache-2.0 — see
[packages/core/THIRD-PARTY-NOTICES.md](packages/core/THIRD-PARTY-NOTICES.md).
