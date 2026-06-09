# a11y-tree

**Playwright-compatible accessibility tree for the live DOM — snapshot it, reference it, drive it.**

A computed accessibility tree (ARIA snapshot) from the live DOM, with ref management
and ref-based DOM operations — plus ready-made Vercel AI SDK tools for in-browser
conversation agents. The accessibility-tree computation is vendored from
[Playwright](https://github.com/microsoft/playwright), so the output matches the
Playwright-MCP "aria snapshot" format your agents already understand.

## Packages

| Package | Description | Deps |
| --- | --- | --- |
| [`@a11y-tree/core`](packages/core) | The accessibility tree: snapshot + ref management + ref-based operations (click/type/fill). | none |
| [`@a11y-tree/ai-sdk`](packages/ai-sdk) | Vercel AI SDK tools that drive the current page via `@a11y-tree/core`. | `@a11y-tree/core`, peer `ai`/`zod` |

```sh
pnpm add @a11y-tree/core            # just the accessibility tree
pnpm add @a11y-tree/ai-sdk ai zod   # + AI SDK conversation tools
```

> **Is this AOM?** No — it's an independent re-computation of the accessibility tree
> (role + accessible name per ARIA 1.2), the same way Playwright does it. It does not
> read the browser's native accessibility tree and is not the W3C Accessibility Object
> Model (AOM) API. See [`@a11y-tree/core`](packages/core#is-this-aom).

## Development

```sh
pnpm install
pnpm build       # build all packages (topological)
pnpm test        # run all tests (real browser via Playwright)
pnpm typecheck
```

## License

MIT. Portions of `@a11y-tree/core` under `packages/core/src/playwright/` are derived
from Playwright and licensed under Apache-2.0 — see
[packages/core/THIRD-PARTY-NOTICES.md](packages/core/THIRD-PARTY-NOTICES.md).
