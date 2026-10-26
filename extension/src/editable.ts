/** Helpers for reading and replacing text in inputs, textareas and contenteditable hosts. */

export type TextField = HTMLInputElement | HTMLTextAreaElement;

const ALLOWED_INPUT_TYPES = new Set(['text', 'search', '']);
const BLOCKED_AUTOCOMPLETE = /^(cc-|one-time-code|current-password|new-password)/;
const CODE_EDITOR_SELECTOR = '.monaco-editor, .cm-editor, .CodeMirror, .ace_editor, [data-keyflip="off"]';

export function isTextField(el: Element | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && ALLOWED_INPUT_TYPES.has(el.type);
}

/** True for fields where automatic correction is safe to apply. */
export function isSafeTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest(CODE_EDITOR_SELECTOR)) return false;
  if (isTextField(el)) {
    if (el.readOnly || el.disabled) return false;
    return !BLOCKED_AUTOCOMPLETE.test(el.autocomplete ?? '');
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

export function replaceInTextField(el: TextField, start: number, end: number, text: string): void {
  el.focus();
  el.setSelectionRange(start, end);
  // execCommand keeps the native undo stack and notifies frameworks via a real input event.
  if (!document.execCommand('insertText', false, text)) {
    el.setRangeText(text, start, end, 'end');
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: text }));
  }
}

export function replaceInTextNode(node: Text, start: number, end: number, text: string): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
  return document.execCommand('insertText', false, text);
}

export function moveCaretForward(chars: number): void {
  const sel = window.getSelection() as (Selection & { modify?: (a: string, d: string, g: string) => void }) | null;
  for (let i = 0; i < chars; i++) sel?.modify?.('move', 'forward', 'character');
}

export function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}
