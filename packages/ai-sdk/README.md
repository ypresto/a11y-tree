# @a11y-tree/ai-sdk

Vercel AI SDK tools for an **in-browser conversation agent**, built on
[`@a11y-tree/core`](../core). The tools run on the page the user is already on
(no server, no tabs, no `navigate`) and act on the live DOM. Tool names and schemas
mirror Playwright-MCP so models recognize them, and every action returns the fresh
page snapshot to drive the agent loop.

## Install

```sh
pnpm add @a11y-tree/ai-sdk ai zod
```

`ai` (v5) and `zod` are **peer dependencies** — your app provides them (it already
uses the AI SDK).

## Usage

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

## Tools

`browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`,
`browser_select_option`, `browser_hover`, `browser_drag`, `browser_press_key`,
`browser_wait_for`.

## Options

`createA11yTreeTools(options?)`:

- `controller` — a `DomController` from `@a11y-tree/core` to drive. Defaults to
  `createDomController(root)`.
- `root` — root element when no controller is given. Defaults to `document.body`.
- `pageHeader` — prepend the `- Page URL / - Page Title / - Page Snapshot` header
  to snapshots. Default `true`.
- `onBeforeAction(action)` — called before every mutating tool; throw to cancel.

## License

MIT
