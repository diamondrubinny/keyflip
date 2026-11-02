import us from '../../shared/layouts/us.json' with { type: 'json' };
import he from '../../shared/layouts/he.json' with { type: 'json' };
import ru from '../../shared/layouts/ru.json' with { type: 'json' };
import ar from '../../shared/layouts/ar.json' with { type: 'json' };

/**
 * A keyboard layout as a map from physical key to the text it types. Keys are identified by the character they
 * produce on US QWERTY (uppercase = with Shift), so converting between any two layouts goes text -> key -> text.
 * A key may type more than one character (Arabic 'b' types لا).
 */
export interface Layout {
  id: string;
  script: string;
  /** Latin layouts are matched case-insensitively ("AKUO" is the same keys as "akuo"). */
  foldCase: boolean;
  toChar: ReadonlyMap<string, string>;
  toKey: ReadonlyMap<string, string>;
  /** Outputs longer than one character, longest first (e.g. لآ, لا). */
  multi: readonly string[];
}

interface LayoutFile {
  id: string;
  script: string;
  foldCase: boolean;
  keys: Record<string, string>;
}

function build(file: LayoutFile): Layout {
  const toChar = new Map(Object.entries(file.keys));
  const toKey = new Map<string, string>();
  for (const [key, out] of toChar) toKey.set(out, key);
  const multi = [...toKey.keys()].filter((o) => [...o].length > 1).sort((a, b) => b.length - a.length);
  return { id: file.id, script: file.script, foldCase: file.foldCase, toChar, toKey, multi };
}

export const LAYOUTS: Readonly<Record<string, Layout>> = {
  us: build(us as LayoutFile),
  he: build(he as LayoutFile),
  ru: build(ru as LayoutFile),
  ar: build(ar as LayoutFile),
};

/** The text a key types on a layout; a layout without a Shift entry types its lowercase entry. */
function typeKey(to: Layout, key: string): string | undefined {
  return to.toChar.get(key) ?? to.toChar.get(key.toLowerCase());
}

function keyOf(from: Layout, ch: string): string | undefined {
  return from.toKey.get(ch) ?? (from.foldCase ? from.toKey.get(ch.toLowerCase()) : undefined);
}

/**
 * Every way the text could have been typed on `from`, re-typed on `to` (at most `limit`). Only layouts with
 * multi-character keys are ambiguous: "لا" is the 'b' key or 'g' + 'h'. The first result uses the longest keys.
 */
export function convertLayoutVariants(text: string, from: Layout, to: Layout, limit = 8): string[] {
  const chars = [...text];
  let results: string[] = [''];
  let i = 0;
  while (i < chars.length) {
    const rest = chars.slice(i).join('');
    const multi = from.multi.find((m) => rest.startsWith(m));
    const ch = chars[i]!;
    const key = keyOf(from, ch);
    const single = key === undefined ? ch : (typeKey(to, key) ?? ch);
    if (multi) {
      const multiKey = from.toKey.get(multi)!;
      const asOneKey = typeKey(to, multiKey) ?? multi;
      // Alternative: the same characters typed one key each.
      const asSingles = [...multi].map((c) => {
        const k = keyOf(from, c);
        return k === undefined ? c : (typeKey(to, k) ?? c);
      }).join('');
      results = results.flatMap((r) => (asOneKey === asSingles ? [r + asOneKey] : [r + asOneKey, r + asSingles])).slice(0, limit);
      i += [...multi].length;
      continue;
    }
    results = results.map((r) => r + single);
    i++;
  }
  return results;
}

/** Re-types text on another layout. Characters without a key in the source layout (digits, spaces, emoji) are kept. */
export function convertLayout(text: string, from: Layout, to: Layout): string {
  if (from.multi.length === 0) {
    let out = '';
    for (const ch of text) {
      const key = keyOf(from, ch);
      out += key === undefined ? ch : (typeKey(to, key) ?? ch);
    }
    return out;
  }
  return convertLayoutVariants(text, from, to, 1)[0]!;
}
