import us from '../../shared/layouts/us.json' with { type: 'json' };
import he from '../../shared/layouts/he.json' with { type: 'json' };
import ru from '../../shared/layouts/ru.json' with { type: 'json' };
import ar from '../../shared/layouts/ar.json' with { type: 'json' };
import fr from '../../shared/layouts/fr.json' with { type: 'json' };
import de from '../../shared/layouts/de.json' with { type: 'json' };
import es from '../../shared/layouts/es.json' with { type: 'json' };

/**
 * A keyboard layout as a map from physical key to the text it types. Keys are identified by the character they
 * produce on US QWERTY (uppercase = with Shift), so converting between any two layouts goes text -> key -> text.
 * A key may type more than one character (Arabic 'b' types لا), and a layout may have dead keys (Spanish ´ + a = á).
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
  /** Dead key output -> (next letter -> composed letter), e.g. "´" -> { a: "á" }. */
  dead: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Composed letter -> dead key output + letter, for letters that have no key of their own (á -> "´a"). */
  decompose: ReadonlyMap<string, string>;
}

interface LayoutFile {
  id: string;
  script: string;
  foldCase: boolean;
  keys: Record<string, string>;
  dead?: Record<string, Record<string, string>>;
}

/** The ids of the Latin layouts KeyFlip ships; the user picks one (docs/MULTILANG_PLAN.md, step 3b). */
export const LATIN_LAYOUTS = ['us', 'fr', 'de', 'es'] as const;
export type LatinLayoutId = (typeof LATIN_LAYOUTS)[number];
export const DEFAULT_LATIN_LAYOUT: LatinLayoutId = 'us';

function build(file: LayoutFile): Layout {
  const toChar = new Map(Object.entries(file.keys));
  const toKey = new Map<string, string>();
  for (const [key, out] of toChar) toKey.set(out, key);
  const multi = [...toKey.keys()].filter((o) => [...o].length > 1).sort((a, b) => b.length - a.length);
  const dead = new Map<string, ReadonlyMap<string, string>>();
  const decompose = new Map<string, string>();
  for (const [deadChar, table] of Object.entries(file.dead ?? {})) {
    dead.set(deadChar, new Map(Object.entries(table)));
    for (const [base, composed] of Object.entries(table)) {
      if (!toKey.has(composed) && !decompose.has(composed)) decompose.set(composed, deadChar + base);
    }
  }
  return { id: file.id, script: file.script, foldCase: file.foldCase, toChar, toKey, multi, dead, decompose };
}

export const LAYOUTS: Readonly<Record<string, Layout>> = {
  us: build(us as LayoutFile),
  he: build(he as LayoutFile),
  ru: build(ru as LayoutFile),
  ar: build(ar as LayoutFile),
  fr: build(fr as LayoutFile),
  de: build(de as LayoutFile),
  es: build(es as LayoutFile),
};

/** The text a key types on a layout; a layout without a Shift entry types its lowercase entry. */
function typeKey(to: Layout, key: string): string | undefined {
  return to.toChar.get(key) ?? to.toChar.get(key.toLowerCase());
}

function keyOf(from: Layout, ch: string): string | undefined {
  return from.toKey.get(ch) ?? (from.foldCase ? from.toKey.get(ch.toLowerCase()) : undefined);
}

/** Letters typed with a dead key become dead key + letter, so that each maps to a physical key (á on Spanish = ´ a). */
function decomposeDead(text: string, layout: Layout): string {
  if (layout.decompose.size === 0) return text;
  let out = '';
  for (const ch of text) {
    const parts = layout.decompose.get(ch) ?? (layout.foldCase ? layout.decompose.get(ch.toLowerCase()) : undefined);
    out += parts ?? ch;
  }
  return out;
}

/** A dead key followed by a letter it combines with becomes the composed letter (´ a -> á). */
function composeDead(text: string, layout: Layout): string {
  if (layout.dead.size === 0) return text;
  const chars = [...text];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const table = layout.dead.get(chars[i]!);
    const composed = table && i + 1 < chars.length ? table.get(chars[i + 1]!) : undefined;
    if (composed !== undefined) {
      out += composed;
      i++;
    } else {
      out += chars[i];
    }
  }
  return out;
}

/**
 * Every way the text could have been typed on `from`, re-typed on `to` (at most `limit`). Only layouts with
 * multi-character keys are ambiguous: "لا" is the 'b' key or 'g' + 'h'. The first result uses the longest keys.
 */
export function convertLayoutVariants(text: string, from: Layout, to: Layout, limit = 8): string[] {
  const chars = [...decomposeDead(text, from)];
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
  return to.dead.size === 0 ? results : results.map((r) => composeDead(r, to));
}

/** Re-types text on another layout. Characters without a key in the source layout (digits, spaces, emoji) are kept. */
export function convertLayout(text: string, from: Layout, to: Layout): string {
  if (from.multi.length === 0 && from.decompose.size === 0 && to.dead.size === 0) {
    let out = '';
    for (const ch of text) {
      const key = keyOf(from, ch);
      out += key === undefined ? ch : (typeKey(to, key) ?? ch);
    }
    return out;
  }
  return convertLayoutVariants(text, from, to, 1)[0]!;
}

/** Key ids that mean "with Shift": capital letters and the US Shift positions of the punctuation keys. */
const SHIFT_KEY = /^[A-Z~!@#$%^&*()_+{}|:"<>?]$/;

/** The characters a layout types without Shift (what a token typed on it may contain), digits and spaces excluded. */
export function unshiftedChars(layout: Layout): string[] {
  const out = new Set<string>();
  for (const [key, text] of layout.toChar) {
    if (SHIFT_KEY.test(key)) continue;
    for (const ch of text) if (!/[0-9\s]/.test(ch)) out.add(ch);
  }
  for (const composed of layout.decompose.keys()) out.add(composed);
  return [...out];
}
