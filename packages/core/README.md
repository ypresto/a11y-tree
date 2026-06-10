# a11y-tree

**Playwright-compatible accessibility tree for the live DOM — snapshot it, reference it, drive it.**

A computed **accessibility tree (ARIA snapshot)** from the live DOM, plus ref
management and ref-based DOM operations (click/type/fill). The accessibility-tree
computation is vendored from [Playwright](https://github.com/microsoft/playwright),
so the output matches the Playwright-MCP "aria snapshot" format your agents already
understand.

Zero runtime dependencies. For Vercel AI SDK tools built on top of this, see
[`@a11y-tree/ai-sdk`](../ai-sdk).

> **Note:** this is an *independent re-computation* of the accessibility tree
> (role + accessible name per ARIA 1.2), the same way Playwright does it. It does
> **not** read the browser's native accessibility tree and is **not** the W3C
> Accessibility Object Model (AOM) API. See [Is this AOM?](#is-this-aom).

## Install

```sh
pnpm add a11y-tree
```

This package runs in the browser (it walks the live DOM). Use it in a content
script, a bundled web app, or any DOM environment.

## Three layers

The package is organized as three independent layers plus a convenience controller.

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

### Putting it together — `createA11yTreeHandle`

The library's primary stateful interface: a durable, page-state-agnostic handle,
rooted at any DOM subtree, that ties layers 2 + 3 so you can drive the page with
ref strings. On a ref miss it re-snapshots once before failing (the Playwright-MCP
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

## Is this AOM?

No. The **Accessibility Object Model (AOM)** is a draft browser API that would
expose the browser's *own* computed accessibility tree to JavaScript. `a11y-tree`
instead **re-computes** the accessibility tree itself in JS by applying the ARIA 1.2
role and accessible-name algorithms to the DOM (this is Playwright's approach). It is
a *representation of an accessibility tree*, but not a read-out of the browser's AOM —
so results approximate, and may differ slightly from, what a screen reader sees.

## License

MIT (this package's own code). Portions under `src/playwright/` are derived from
Playwright and licensed under Apache-2.0 — see
[THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
