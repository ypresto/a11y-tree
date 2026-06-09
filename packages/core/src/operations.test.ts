import { describe, it, expect, beforeEach } from 'vitest';
import { click, type, fill, selectOption, hover, pressKey } from './operations.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('click', () => {
  it('fires the click handler', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let clicks = 0;
    button.addEventListener('click', () => clicks++);

    click(button);

    expect(clicks).toBe(1);
  });

  it('fires dblclick when doubleClick is set', () => {
    document.body.innerHTML = `<button>Go</button>`;
    const button = document.querySelector('button')!;
    let doubles = 0;
    button.addEventListener('dblclick', () => doubles++);

    click(button, { doubleClick: true });

    expect(doubles).toBe(1);
  });
});

describe('type', () => {
  it('replaces the value and fires input + change', async () => {
    document.body.innerHTML = `<input value="old" />`;
    const input = document.querySelector('input')!;
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    await type(input, 'hello');

    expect(input.value).toBe('hello');
    expect(events).toEqual(['input', 'change']);
  });

  it('throws when the target is not a text field', async () => {
    document.body.innerHTML = `<div>nope</div>`;
    const div = document.querySelector('div')!;

    await expect(type(div, 'x')).rejects.toThrow(/input or textarea/);
  });
});

describe('fill', () => {
  it('sets the value in one shot', () => {
    document.body.innerHTML = `<textarea></textarea>`;
    const textarea = document.querySelector('textarea')!;

    fill(textarea, 'multi\nline');

    expect(textarea.value).toBe('multi\nline');
  });
});

describe('selectOption', () => {
  it('selects matching options and fires change', () => {
    document.body.innerHTML = `
      <select>
        <option value="a">A</option>
        <option value="b">B</option>
      </select>`;
    const select = document.querySelector('select')!;
    let changed = 0;
    select.addEventListener('change', () => changed++);

    selectOption(select, ['b']);

    expect(select.value).toBe('b');
    expect(changed).toBe(1);
  });
});

describe('hover', () => {
  it('fires mouseover', () => {
    document.body.innerHTML = `<div>hi</div>`;
    const div = document.querySelector('div')!;
    let over = 0;
    div.addEventListener('mouseover', () => over++);

    hover(div);

    expect(over).toBe(1);
  });
});

describe('pressKey', () => {
  it('dispatches a keydown with the given key', () => {
    document.body.innerHTML = `<input />`;
    const input = document.querySelector('input')!;
    let key = '';
    input.addEventListener('keydown', (e) => (key = e.key));

    pressKey(input, 'Enter');

    expect(key).toBe('Enter');
  });
});
