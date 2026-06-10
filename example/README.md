# a11y-tree — in-browser agent demo

A minimal Next.js chat app where the AI agent **drives the very page you're on**,
using [`@a11y-tree/ai-sdk`](../packages/ai-sdk). No browser extension, no separate
tab, no server-side automation — the tools run in the page's own DOM.

## How it works

The model runs **server-side** (with your API key) but the tools run **client-side**:

- `app/api/chat/route.ts` hands `streamText` the tool **schemas**
  (`createA11yTreeToolSchemas()` — no `execute`), so each tool call is streamed to
  the browser instead of being run on the server.
- `app/page.tsx` runs the tools against the live DOM in `useChat`'s `onToolCall`
  (via `createA11yTreeTools()` rooted at the demo panel) and returns the result with
  `addToolResult`. `sendAutomaticallyWhen` continues the loop.
- Each action returns a **diff** of what changed (the a11y-tree handle remembers the
  previous snapshot); `browser_snapshot` returns the full page.

This is the split the library is built for: schemas on the server, execution in the
browser.

## Run

```sh
# from the repo root: build the workspace packages the app depends on
pnpm --filter "./packages/*" run build

cd example
cp .env.example .env.local   # add your OPENAI_API_KEY
pnpm dev                     # http://localhost:3000
```

Then ask, e.g.: *"Fill in the form with test data, choose the Pro plan, accept the
terms, and submit."* Watch the agent read the form via its accessibility tree and
operate it.

Swap the model in `app/api/chat/route.ts` for any AI SDK provider — a11y-tree is
provider-agnostic.
