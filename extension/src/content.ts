import { convertAuto, trailingRunStart } from './core.ts';
import {
  deepActiveElement,
  isSafeTarget,
  isTextField,
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

/** Wrong-layout typing tends to continue, so the detector is more willing to fix short words after a fix. */
const STREAK_WINDOW_MS = 20_000;
let streakState: { el: Element | null; count: number; at: number } = { el: null, count: 0, at: 0 };

const currentStreak = (el: Element | null): number =>
  streakState.el === el && Date.now() - streakState.at < STREAK_WINDOW_MS ? streakState.count : 0;

const noteResult = (el: Element | null, fixed: boolean, tokenLength: number): void => {
  if (fixed) streakState = { el, count: currentStreak(el) + 1, at: Date.now() };
  else if (tokenLength >= 3) streakState = { el, count: 0, at: Date.now() };
};

const askBackground = (token: string, streak: number, sandwich = false): Promise<Fix | null> =>
  chrome.runtime.sendMessage({ type: 'fix', token, streak, sandwich }).then(
    (r: Fix | null) => r,
    () => null,
  );

/** Short words directly before a fixed word (separated by single spaces), nearest first. */
function previousShortTokens(text: string, tokenStart: number, maxTokens = 3): { start: number; token: string }[] {
  const out: { start: number; token: string }[] = [];
  let pos = tokenStart;
  for (let i = 0; i < maxTokens; i++) {
    if (pos < 2 || !BOUNDARY.test(text[pos - 1] ?? '') || /\s/.test(text[pos - 2] ?? '')) break;
    let start = pos - 1;
    while (start > 0 && !/\s/.test(text[start - 1]!)) start--;
    const token = text.slice(start, pos - 1);
    if (!token || token.length > 4) break;
    out.push({ start, token });
    pos = start;
  }
  return out;
}

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

  const streakBefore = currentStreak(el);
  const fix = await askBackground(token, streakBefore);
  noteResult(el, fix !== null, token.length);
  if (!fix || document.activeElement !== el) return;
  // The user may have kept typing while we waited; only apply if the token is untouched.
  if (el.value.slice(tokenStart, tokenEnd) !== token) return;
  const caretNow = el.selectionStart ?? caret;
  busy = true;
  try {
    replaceInTextField(el, tokenStart, tokenStart + fix.consumed, fix.replacement);
    // A fix may change the length (Arabic 'b' types لا), so track how far the caret moves.
    let delta = fix.replacement.length - fix.consumed;
    // Short words before this one can be repaired too; they lie earlier in the text, so their offsets are still valid.
    for (const prev of previousShortTokens(value, tokenStart)) {
      const f = await askBackground(prev.token, 1, streakBefore >= 1);
      if (!f || el.value.slice(prev.start, prev.start + prev.token.length) !== prev.token) break;
      replaceInTextField(el, prev.start, prev.start + f.consumed, f.replacement);
      delta += f.replacement.length - f.consumed;
    }
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
  const host = node.parentElement;
  const caret = sel.anchorOffset;
  const text = node.data;
  const tokenEnd = caret - 1;
  if (tokenEnd < 1 || !BOUNDARY.test(text[tokenEnd] ?? '')) return;
  let tokenStart = tokenEnd;
  while (tokenStart > 0 && !/\s/.test(text[tokenStart - 1]!)) tokenStart--;
  const token = text.slice(tokenStart, tokenEnd);
  if (!token) return;

  const streakBefore = currentStreak(host);
  const fix = await askBackground(token, streakBefore);
  noteResult(host, fix !== null, token.length);
  if (!fix || !node.isConnected || node.data.slice(tokenStart, tokenEnd) !== token) return;
  const after = window.getSelection();
  const extraTyped = after?.anchorNode === node ? Math.max(0, after.anchorOffset - caret) : 0;
  busy = true;
  try {
    if (replaceInTextNode(node, tokenStart, tokenStart + fix.consumed, fix.replacement)) {
      let delta = fix.replacement.length - fix.consumed; // fixes may change the length (Arabic 'b' types لا)
      for (const prev of previousShortTokens(text, tokenStart)) {
        const f = await askBackground(prev.token, 1, streakBefore >= 1);
        if (!f || !node.isConnected || node.data.slice(prev.start, prev.start + prev.token.length) !== prev.token) break;
        replaceInTextNode(node, prev.start, prev.start + f.consumed, f.replacement);
        delta += f.replacement.length - f.consumed;
      }
      // Put the caret back after the boundary (and anything typed since).
      const offset = Math.min(node.data.length, caret + extraTyped + delta);
      const range = document.createRange();
      range.setStart(node.isConnected ? node : sel.anchorNode ?? node, offset);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } finally {
    busy = false;
  }
}

let lastWarmup = 0;
document.addEventListener(
  'focusin',
  (event) => {
    // The background worker sleeps when idle; wake it and load the dictionaries before the first word is typed.
    const target = event.composedPath()[0];
    if (!active || !(target instanceof Element) || !isSafeTarget(target) || Date.now() - lastWarmup < 20_000) return;
    lastWarmup = Date.now();
    void chrome.runtime.sendMessage({ type: 'warmup' }).catch(() => undefined);
  },
  true,
);

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

/** Converted text from the background (it knows the enabled languages); the local Hebrew/English rules as a fallback. */
const convertText = (text: string): Promise<string> =>
  chrome.runtime.sendMessage({ type: 'manual', text }).then(
    (r: unknown) => (typeof r === 'string' ? r : convertAuto(text)),
    () => convertAuto(text),
  );

async function convertManually(): Promise<void> {
  if (!document.hasFocus()) return;
  const el = deepActiveElement();
  if (!el || !isSafeTarget(el)) {
    // Fields we refuse for automatic mode (e.g. passwords) are also refused here.
    if (el) showNotice(chrome.i18n.getMessage('noField'));
    return;
  }
  // Every branch reads the text first, converts it in the background, then replaces it only if it is unchanged.
  if (isTextField(el)) {
    const { selectionStart: s, selectionEnd: e } = el;
    if (s === null || e === null) return;
    const start = s !== e ? s : trailingRunStart(el.value.slice(0, s));
    if (start === e) return;
    const original = el.value.slice(start, e);
    const converted = await convertText(original);
    if (el.value.slice(start, e) !== original) return;
    busy = true;
    try {
      replaceInTextField(el, start, e, converted);
    } finally {
      busy = false;
    }
    return;
  }
  const sel = window.getSelection();
  if (!sel) return;
  if (!sel.isCollapsed) {
    const original = sel.toString();
    const converted = await convertText(original);
    if (window.getSelection()?.toString() !== original) return;
    busy = true;
    try {
      document.execCommand('insertText', false, converted);
    } finally {
      busy = false;
    }
  } else if (sel.anchorNode instanceof Text) {
    const node = sel.anchorNode;
    const caret = sel.anchorOffset;
    const start = trailingRunStart(node.data.slice(0, caret));
    if (start >= caret) return;
    const original = node.data.slice(start, caret);
    const converted = await convertText(original);
    if (!node.isConnected || node.data.slice(start, caret) !== original) return;
    busy = true;
    try {
      replaceInTextNode(node, start, caret, converted);
    } finally {
      busy = false;
    }
  }
}

chrome.runtime.onMessage.addListener((msg: unknown, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if ((msg as { type?: string }).type === 'convert') void convertManually();
});
