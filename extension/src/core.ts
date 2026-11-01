import { convertLayout, LAYOUTS } from './layouts.ts';

export type Direction = 'en-to-he' | 'he-to-en';

const HEBREW_LETTER = /[\u05D0-\u05EA]/;
// Any letter of a non-Latin script KeyFlip supports (Hebrew, Cyrillic, Arabic); 'he-to-en' means "other script -> Latin".
const OTHER_LETTER = /[\u05D0-\u05EA\u0400-\u04FF\u0600-\u06FF]/;
const LATIN_LETTER = /[A-Za-z]/;

export function hasHebrew(text: string): boolean {
  return HEBREW_LETTER.test(text);
}

/** Maps each character between the US and Hebrew layouts; unmapped characters (digits, spaces, emoji) are kept. */
export function convert(text: string, direction: Direction): string {
  return direction === 'en-to-he'
    ? convertLayout(text, LAYOUTS.us!, LAYOUTS.he!)
    : convertLayout(text, LAYOUTS.he!, LAYOUTS.us!);
}

/** Chooses the direction by majority of letters. Returns null when the text has no letters. */
export function detectDirection(text: string): Direction | null {
  let he = 0;
  let latin = 0;
  for (const ch of text) {
    if (OTHER_LETTER.test(ch)) he++;
    else if (LATIN_LETTER.test(ch)) latin++;
  }
  if (he === 0 && latin === 0) return null;
  return latin >= he ? 'en-to-he' : 'he-to-en';
}

/** Manual conversion: each word is converted from its own script; neutral tokens follow the dominant one. */
export function convertAuto(text: string): string {
  const dir = detectDirection(text);
  if (!dir) return text;
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s*$/.test(token)) return token;
      const tokenDir = detectDirection(token);
      // A token with only punctuation follows the dominant direction of the whole text.
      return convert(token, tokenDir ?? dir);
    })
    .join('');
}

/**
 * Start index of the trailing run of words (no newline crossed) that share the script of the last word.
 * Used by the manual shortcut when nothing is selected.
 */
export function trailingRunStart(text: string): number {
  const lineStart = text.lastIndexOf('\n') + 1;
  const line = text.slice(lineStart);
  const re = /\S+/g;
  const tokens: { start: number; dir: Direction | null }[] = [];
  for (let m = re.exec(line); m; m = re.exec(line)) {
    tokens.push({ start: m.index, dir: detectDirection(m[0]) });
  }
  let target: Direction | null = null;
  let start = line.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i]!;
    if (t.dir === null) continue; // digits/punctuation-only tokens do not break the run
    if (target === null) target = t.dir;
    if (t.dir !== target) break;
    start = t.start;
  }
  return lineStart + start;
}
