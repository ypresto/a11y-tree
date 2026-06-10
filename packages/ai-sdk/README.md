# @a11y-tree/ai-sdk

Vercel AI SDK tools that drive the current page's live DOM via
[`a11y-tree`](https://www.npmjs.com/package/a11y-tree) — for **in-browser conversation
agents**. Tool names and schemas mirror Playwright-MCP so models recognize them, and
every action returns the fresh page snapshot to drive the loop.

> 📖 **Full documentation** (core + AI SDK) lives in the main a11y-tree README:
> **https://github.com/ypresto/a11y-tree#readme**

## Install

```sh
pnpm add @a11y-tree/ai-sdk ai zod
```

`ai` (v5) and `zod` are peer dependencies — your app provides them.

## Quick start

```ts
import { streamText, stepCountIs } from 'ai';
import { createA11yTreeTools } from '@a11y-tree/ai-sdk';

const result = streamText({
  model,                          // any browser-usable AI SDK model
  tools: createA11yTreeTools(),   // browser_snapshot / browser_click / browser_type / ...
  stopWhen: stepCountIs(10),
  prompt: 'Fill in the signup form with test data and submit.',
});
```

See the [main README](https://github.com/ypresto/a11y-tree#readme) for the full tool
list, `onBeforeAction` gating, and all options.

## License

[Apache-2.0](https://github.com/ypresto/a11y-tree/blob/main/LICENSE).
