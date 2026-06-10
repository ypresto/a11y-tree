import { describe, it, expect, beforeEach } from 'vitest';
import { type ToolExecuteFunction } from 'ai';
import { createA11yTreeTools } from './tools.js';
import { createA11yTreeHandle } from 'a11y-tree';

// AI SDK passes a second options argument to execute(); we don't use it.
const OPTS = { toolCallId: 'test', messages: [] } as never;

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return value != null && typeof value === 'object' && Symbol.asyncIterator in value;
}

// `execute` may, per the AI SDK type, return an AsyncIterable for streaming
// tools; ours always resolve to a plain result object. Narrow to that so the
// returned value is usable without a cast.
async function call<I, O>(execute: ToolExecuteFunction<I, O> | undefined, input: I): Promise<O> {
  const out = await execute!(input, OPTS);
  if (isAsyncIterable(out)) throw new Error('unexpected streaming tool result in test');
  return out;
}

function refOf(elements: Map<string, Element>, element: Element): string {
  for (const [ref, el] of elements) {
    if (el === element) return ref;
  }
  throw new Error('element not in snapshot');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('createA11yTreeTools', () => {
  it('exposes the Playwright-MCP compatible tool set', () => {
    const tools = createA11yTreeTools();
    for (const name of [
      'browser_snapshot',
      'browser_click',
      'browser_type',
      'browser_fill_form',
      'browser_select_option',
      'browser_hover',
      'browser_drag',
      'browser_press_key',
      'browser_wait_for',
    ]) {
      expect(tools[name as keyof typeof tools]).toBeDefined();
    }
  });

  it('browser_snapshot returns the page header and refs', async () => {
    document.body.innerHTML = `<button>Go</button>`;
    const tools = createA11yTreeTools();

    const result = await call(tools.browser_snapshot.execute, {});

    expect(result.snapshot).toContain('- Page URL:');
    expect(result.snapshot).toContain('button "Go"');
    expect(result.snapshot).toMatch(/\[ref=e\d+\]/);
  });

  it('browser_click clicks the element and returns a diff of the result', async () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => {
      clicks++;
      const h = document.createElement('h2');
      h.textContent = 'Done';
      document.body.appendChild(h);
    });

    const handle = createA11yTreeHandle();
    const tools = createA11yTreeTools({ handle });
    const ref = refOf(handle.snapshot().elements, button); // full baseline

    const result = await call(tools.browser_click.execute, { element: 'Go button', ref });

    expect(clicks).toBe(1);
    expect(result.success).toBe(true);
    // Post-action snapshot is a diff: it shows the newly added heading, marked
    // <changed>, and omits the unchanged button.
    expect(result.snapshot).toContain('<changed>');
    expect(result.snapshot).toContain('heading "Done"');
    expect(result.snapshot).not.toContain('button "Go"');
  });

  it('browser_snapshot returns the full tree even after an action (not a diff)', async () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    const handle = createA11yTreeHandle();
    const tools = createA11yTreeTools({ handle });
    const ref = refOf(handle.snapshot().elements, button);

    await call(tools.browser_click.execute, { element: 'Go button', ref }); // advances baseline
    const snap = await call(tools.browser_snapshot.execute, {});

    expect(snap.snapshot).toContain('button "Go"');
    expect(snap.snapshot).not.toContain('<changed>');
  });

  it('browser_type types into the referenced input', async () => {
    document.body.innerHTML = `<input aria-label="Email" />`;
    const input = document.querySelector('input')!;
    const handle = createA11yTreeHandle();
    const tools = createA11yTreeTools({ handle });
    const ref = refOf(handle.snapshot().elements, input);

    await call(tools.browser_type.execute, { element: 'Email field', ref, text: 'a@b.co' });

    expect(input.value).toBe('a@b.co');
  });

  it('browser_fill_form sets every field by ref', async () => {
    document.body.innerHTML = `
      <input aria-label="First" />
      <input aria-label="Last" />`;
    const [first, last] = Array.from(document.querySelectorAll('input'));
    const handle = createA11yTreeHandle();
    const tools = createA11yTreeTools({ handle });
    const elements = handle.snapshot().elements;

    await call(tools.browser_fill_form.execute, {
      fields: [
        { element: 'First', ref: refOf(elements, first!), value: 'Ada' },
        { element: 'Last', ref: refOf(elements, last!), value: 'Lovelace' },
      ],
    });

    expect(first!.value).toBe('Ada');
    expect(last!.value).toBe('Lovelace');
  });

  it('onBeforeAction can cancel a mutating action by throwing', async () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks++);

    const seen: string[] = [];
    const handle = createA11yTreeHandle();
    const tools = createA11yTreeTools({
      handle,
      onBeforeAction: (action) => {
        seen.push(action.name);
        if (action.name === 'click') throw new Error('denied by user');
      },
    });
    const ref = refOf(handle.snapshot().elements, button);

    await expect(
      call(tools.browser_click.execute, { element: 'Go button', ref }),
    ).rejects.toThrow(/denied by user/);
    expect(seen).toEqual(['click']);
    expect(clicks).toBe(0);
  });
});
