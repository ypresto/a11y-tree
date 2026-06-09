/**
 * Layer 3 — Operation helpers.
 *
 * Pure functions that perform a single interaction on a given DOM element by
 * dispatching synthetic events. They take an `Element` (resolved from a ref via
 * Layer 2), never a ref string, so they have no dependency on snapshot state.
 */

export interface ClickOptions {
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
}

const BUTTON_INDEX = { left: 0, middle: 1, right: 2 } as const;

/** Click an element (single, double, or with a specific mouse button). */
export function click(element: Element, options: ClickOptions = {}): void {
  if (options.doubleClick) {
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    return;
  }
  const button = options.button ?? 'left';
  if (button === 'left' && element instanceof HTMLElement) {
    element.click();
    return;
  }
  const init: MouseEventInit = { bubbles: true, button: BUTTON_INDEX[button] };
  element.dispatchEvent(new MouseEvent('mousedown', init));
  element.dispatchEvent(new MouseEvent('mouseup', init));
  if (button === 'right') {
    element.dispatchEvent(new MouseEvent('contextmenu', init));
  } else {
    element.dispatchEvent(new MouseEvent('click', init));
  }
}

export interface TypeOptions {
  /** Press Enter (and `form.requestSubmit()`) after typing. */
  submit?: boolean;
  /** Type one character at a time with full keyboard events. */
  slowly?: boolean;
  /** Delay between characters when `slowly` is set (ms). Default 50. */
  delayMs?: number;
}

type TextField = HTMLInputElement | HTMLTextAreaElement;

function asTextField(element: Element): TextField {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element;
  }
  throw new Error(`Element is not an input or textarea (found <${element.tagName.toLowerCase()}>)`);
}

/**
 * Type text into an input/textarea, replacing any existing value. Fires the
 * `input`/`change` (and, when `slowly`, keyboard) events frameworks rely on.
 */
export async function type(element: Element, text: string, options: TypeOptions = {}): Promise<void> {
  const field = asTextField(element);
  field.focus();
  field.value = '';

  if (options.slowly) {
    const delay = options.delayMs ?? 50;
    for (const char of text) {
      field.value += char;
      field.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  } else {
    field.value = text;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (options.submit) {
    for (const phase of ['keydown', 'keypress', 'keyup'] as const) {
      field.dispatchEvent(new KeyboardEvent(phase, { key: 'Enter', bubbles: true }));
    }
    field.closest('form')?.requestSubmit();
  }
}

/**
 * Set a field's value in one shot and fire `input`/`change`. Works on
 * input/textarea/select. Prefer this over {@link type} for form filling.
 */
export function fill(element: Element, value: string): void {
  if (element instanceof HTMLSelectElement) {
    selectOption(element, [value]);
    return;
  }
  const field = asTextField(element);
  field.focus();
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Select the given option values on a `<select>` and fire `change`. */
export function selectOption(element: Element, values: string[]): void {
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Element is not a <select> (found <${element.tagName.toLowerCase()}>)`);
  }
  for (const option of Array.from(element.options)) {
    option.selected = values.includes(option.value);
  }
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Dispatch `mouseover`/`mouseenter` to hover an element. */
export function hover(element: Element): void {
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
}

/** Dispatch a simplified drag from one element to another. */
export function drag(from: Element, to: Element): void {
  from.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  to.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  to.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

/** Dispatch a `keydown` for `key` on the given element. */
export function pressKey(element: Element, key: string): void {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}
