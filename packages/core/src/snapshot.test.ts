import { describe, it, expect, beforeEach } from 'vitest';
import { snapshot, pageSnapshot } from './snapshot.js';

function refOf(elements: Map<string, Element>, element: Element): string | undefined {
  for (const [ref, el] of elements) {
    if (el === element) return ref;
  }
  return undefined;
}

describe('snapshot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders roles and names as Playwright-MCP YAML with refs', () => {
    document.body.innerHTML = `
      <button>Click me</button>
      <input type="text" aria-label="Username" />
    `;

    const { yaml } = snapshot();

    expect(yaml).toContain('button "Click me"');
    expect(yaml).toContain('textbox "Username"');
    expect(yaml).toMatch(/\[ref=e\d+\]/);
  });

  it('maps each ref to the live element it represents', () => {
    document.body.innerHTML = `<button>Save</button>`;
    const button = document.querySelector('button')!;

    const { elements } = snapshot();
    const ref = refOf(elements, button);

    expect(ref).toBeDefined();
    expect(elements.get(ref!)).toBe(button);
  });

  it('snapshots only the given root subtree', () => {
    document.body.innerHTML = `
      <div id="outside"><button>Outside</button></div>
      <div id="inside"><button>Inside</button></div>
    `;
    const inside = document.getElementById('inside')!;

    const { yaml } = snapshot(inside);

    expect(yaml).toContain('Inside');
    expect(yaml).not.toContain('Outside');
  });
});

describe('pageSnapshot', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefixes the tree with the Playwright-MCP page header', () => {
    document.body.innerHTML = `<button>Go</button>`;

    const snap = pageSnapshot();

    expect(snap.yaml).toContain(`- Page URL: ${window.location.href}`);
    expect(snap.yaml).toContain(`- Page Title: ${document.title}`);
    expect(snap.yaml).toContain('- Page Snapshot:');
    expect(snap.yaml).toContain('button "Go"');
    expect(snap.url).toBe(window.location.href);
  });
});
