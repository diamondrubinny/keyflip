import { convertAuto, trailingRunStart } from './core.ts';
import {
  deepActiveElement,
  isSafeTarget,
  isTextField,
  moveCaretForward,
  replaceInTextField,
  replaceInTextNode,
  type TextField,
} from './editable.ts';
import { DEFAULT_SETTINGS, isHostDisabled, loadSettings, type Settings } from './settings.ts';

let settings: Settings = DEFAULT_SETTINGS;
let active = true;
let busy = false;

const applySettings = (s: Settings): void => {
  settings = s;
  active = s.auto && !isHostDisabled(s, location.hostname);
};

void loadSettings().then(applySettings);
chrome.storage.onChanged.addListener(() => void loadSettings().then(applySettings));

const BOUNDARY = /^[  ]$/;

interface Fix {
  consumed: number;
  replacement: string;
}

const askBackground = (token: string): Promise<Fix | null> =>
  chrome.runtime.sendMessage({ type: 'fix', token }).then(
    (r: Fix | null) => r,
    () => null,
  );

async function fixTextField(el: TextField): Promise<void> {
  const caret = el.selectionStart;
  if (caret === null || caret !== el.selectionEnd || caret < 2) return;
  const value = el.value;
  const tokenEnd = caret - 1;
  if (!BOUNDARY.test(value[tokenEnd] ?? '')) return;
  let tokenStart = tokenEnd;
  while (tokenStart > 0 && !/\s/.test(value[tokenStart - 1]!)) tokenStart--;
  const token = value.slice(tokenStart, tokenEnd);
  if (!token) return;

  const fix = await askBackground(token);
  if (!fix || document.activeElement !== el) return;
  // The user may have kept typing while we waited; only apply if the token is untouched.
  if (el.value.slice(tokenStart, tokenEnd) !== token) return;
  const delta = fix.replacement.length - fix.consumed;
  const caretNow = el.selectionStart ?? caret;
  busy = true;
  try {
    replaceInTextField(el, tokenStart, tokenStart + fix.consumed, fix.replacement);
    const newCaret = caretNow + delta;
    el.setSelectionRange(newCaret, newCaret);
  } finally {
    busy = false;
  }
}

async function fixContentEditable(): Promise<void> {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || !(sel.anchorNode instanceof Text)) return;
  const node = sel.anchorNode;
  const caret = sel.anchorOffset;
  const text = node.data;
  const tokenEnd = caret - 1;
  if (tokenEnd < 1 || !BOUNDARY.test(text[tokenEnd] ?? '')) return;
  let tokenStart = tokenEnd;
  while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1]!)) tokenStart--;
  const token = text.slice(tokenStart, tokenEnd);
  if (!token) return;

  const fix = await askBackground(token);
  if (!fix || !node.isConnected || node.data.slice(tokenStart, tokenEnd) !== token) return;
  const after = window.getSelection();
  const extraTyped = after?.anchorNode === node ? Math.max(0, after.anchorOffset - caret) : 0;
  busy = true;
  try {
    if (replaceInTextNode(node, tokenStart, tokenStart + fix.consumed, fix.replacement)) {
      // insertText leaves the caret after the new text; step over the boundary and anything typed since.
      moveCaretForward(1 + (tokenEnd - tokenStart - fix.consumed) + extraTyped);
    }
  } finally {
    busy = false;
  }
}

document.addEventListener(
  'input',
  (event) => {
    if (!active || busy || !(event instanceof InputEvent) || !event.isTrusted) return;
    if (event.isComposing || event.inputType !== 'insertText' || !BOUNDARY.test(event.data ?? '')) return;
    const target = event.composedPath()[0];
    if (!(target instanceof Element) || !isSafeTarget(target)) return;
    if (isTextField(target)) void fixTextField(target);
    else void fixContentEditable();
  },
  true,
);

/* ---------- manual conversion (shortcut / context menu) ---------- */

function showNotice(message: string): void {
  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset-block-end:16px;inset-inline-start:16px;z-index:2147483647';
  const root = host.attachShadow({ mode: 'closed' });
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.dir = 'auto';
  box.textContent = message;
  box.style.cssText =
    'font:14px system-ui,sans-serif;background:#1f2937;color:#fff;padding:8px 12px;border-radius:6px';
  root.append(box);
  document.documentElement.append(host);
  setTimeout(() => host.remove(), 2500);
}

function convertManually(): void {
  if (!document.hasFocus()) return;
  const el = deepActiveElement();
  if (!el || !isSafeTarget(el)) {
    // Fields we refuse for automatic mode (e.g. passwords) are also refused here.
    if (el) showNotice(chrome.i18n.getMessage('noField'));
    return;
  }
  busy = true;
  try {
    if (isTextField(el)) {
      const { selectionStart: s, selectionEnd: e } = el;
      if (s === null || e === null) return;
      if (s !== e) {
        replaceInTextField(el, s, e, convertAuto(el.value.slice(s, e)));
      } else {
        const start = trailingRunStart(el.value.slice(0, s));
        if (start === s) return;
        replaceInTextField(el, start, s, convertAuto(el.value.slice(start, s)));
      }
      return;
    }
    const sel = window.getSelection();
    if (!sel) return;
    if (!sel.isCollapsed) {
      document.execCommand('insertText', false, convertAuto(sel.toString()));
    } else if (sel.anchorNode instanceof Text) {
      const node = sel.anchorNode;
      const caret = sel.anchorOffset;
      const start = trailingRunStart(node.data.slice(0, caret));
      if (start < caret) replaceInTextNode(node, start, caret, convertAuto(node.data.slice(start, caret)));
    }
  } finally {
    busy = false;
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if ((msg as { type?: string }).type === 'convert') convertManually();
});
