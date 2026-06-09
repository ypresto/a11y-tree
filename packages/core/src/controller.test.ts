import { describe, it, expect, beforeEach } from 'vitest';
import { createDomController } from './controller.js';

function refOf(elements: Map<string, Element>, element: Element): string {
  for (const [ref, el] of elements) {
    if (el === element) return ref;
  }
  throw new Error('element not in snapshot');
}

describe('createDomController', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('clicks an element by its ref from the latest snapshot', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks++);

    const dom = createDomController();
    const ref = refOf(dom.snapshot().elements, button);
    dom.click(ref);

    expect(clicks).toBe(1);
  });

  it('fills a form by ref', () => {
    document.body.innerHTML = `<input aria-label="name" />`;
    const input = document.querySelector('input')!;

    const dom = createDomController();
    const ref = refOf(dom.snapshot().elements, input);
    dom.fillForm([{ ref, value: 'Ada' }]);

    expect(input.value).toBe('Ada');
  });

  it('throws a clear error for an unknown ref', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const dom = createDomController();

    expect(() => dom.click('e9999')).toThrow(/Element not found: e9999/);
  });
});
