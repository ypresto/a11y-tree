import { describe, it, expect, beforeEach } from 'vitest';
import { createA11yTreeHandle } from './handle.js';

function refOf(elements: Map<string, Element>, element: Element): string {
  for (const [ref, el] of elements) {
    if (el === element) return ref;
  }
  throw new Error('element not in snapshot');
}

describe('createA11yTreeHandle', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('clicks an element by its ref from the latest snapshot', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks++);

    const handle = createA11yTreeHandle();
    const ref = refOf(handle.snapshot().elements, button);
    handle.click(ref);

    expect(clicks).toBe(1);
  });

  it('fills a form by ref', () => {
    document.body.innerHTML = `<input aria-label="name" />`;
    const input = document.querySelector('input')!;

    const handle = createA11yTreeHandle();
    const ref = refOf(handle.snapshot().elements, input);
    handle.fillForm([{ ref, value: 'Ada' }]);

    expect(input.value).toBe('Ada');
  });

  it('throws a clear error for an unknown ref', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const handle = createA11yTreeHandle();

    expect(() => handle.click('e9999')).toThrow(/Element not found: e9999/);
  });

  it('returns the full tree first, then a diff of only what changed', () => {
    document.body.innerHTML = `<button>Alpha</button><button>Beta</button>`;
    const handle = createA11yTreeHandle();

    const first = handle.snapshot();
    expect(first.yaml).toContain('button "Alpha"');
    expect(first.yaml).toContain('button "Beta"');
    expect(first.yaml).not.toContain('<changed>');

    // Mutate only the first button.
    document.querySelector('button')!.textContent = 'Alpha2';

    const diff = handle.snapshot();
    expect(diff.yaml).toContain('<changed>');
    expect(diff.yaml).toContain('button "Alpha2"');
    // The unchanged button is omitted from the diff entirely.
    expect(diff.yaml).not.toContain('Beta');
  });

  it('renders the full tree again when full: true', () => {
    document.body.innerHTML = `<button>Alpha</button><button>Beta</button>`;
    const handle = createA11yTreeHandle();
    handle.snapshot();
    document.querySelector('button')!.textContent = 'Alpha2';

    const full = handle.snapshot({ full: true });
    expect(full.yaml).toContain('button "Alpha2"');
    expect(full.yaml).toContain('button "Beta"');
    expect(full.yaml).not.toContain('<changed>');
  });

  it('still resolves refs that a diff snapshot omits', () => {
    document.body.innerHTML = `<button>Alpha</button><button>Beta</button>`;
    const beta = document.querySelectorAll('button')[1]!;
    const handle = createA11yTreeHandle();

    const betaRef = refOf(handle.snapshot().elements, beta);
    document.querySelector('button')!.textContent = 'Alpha2';

    const diff = handle.snapshot();
    expect(diff.yaml).not.toContain('Beta'); // omitted from the diff text...
    expect(diff.elements.get(betaRef)).toBe(beta); // ...but still resolvable
  });
});
