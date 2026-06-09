import { describe, it, expect, beforeEach } from 'vitest';
import { createRefStore } from './refs.js';

function onlyRef(elements: Map<string, Element>, tag: string): string {
  for (const [ref, el] of elements) {
    if (el.tagName.toLowerCase() === tag) return ref;
  }
  throw new Error(`no <${tag}> in snapshot`);
}

describe('createRefStore', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves a ref from the latest snapshot to its live element', () => {
    document.body.innerHTML = `<button>One</button>`;
    const button = document.querySelector('button')!;

    const store = createRefStore();
    const snap = store.refresh();
    const ref = onlyRef(snap.elements, 'button');

    expect(store.resolve(ref)).toBe(button);
  });

  it('returns undefined before any refresh and for unknown refs', () => {
    const store = createRefStore();
    expect(store.current).toBeUndefined();
    expect(store.resolve('e999')).toBeUndefined();

    document.body.innerHTML = `<button>One</button>`;
    store.refresh();
    expect(store.resolve('nope')).toBeUndefined();
  });

  it('clear() forgets the current snapshot', () => {
    document.body.innerHTML = `<button>One</button>`;
    const store = createRefStore();
    const ref = onlyRef(store.refresh().elements, 'button');

    store.clear();

    expect(store.current).toBeUndefined();
    expect(store.resolve(ref)).toBeUndefined();
  });
});
