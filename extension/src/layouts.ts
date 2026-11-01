import us from '../../shared/layouts/us.json' with { type: 'json' };
import he from '../../shared/layouts/he.json' with { type: 'json' };
import ru from '../../shared/layouts/ru.json' with { type: 'json' };

/**
 * A keyboard layout as a map from physical key to character. Keys are identified by the character they
 * produce on US QWERTY, so converting between any two layouts goes character -> key -> character.
 */
export interface Layout {
  id: string;
  script: string;
  /** Latin layouts are matched case-insensitively ("AKUO" is the same keys as "akuo"). */
  foldCase: boolean;
  toChar: ReadonlyMap<string, string>;
  toKey: ReadonlyMap<string, string>;
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
  for (const [key, ch] of toChar) toKey.set(ch, key);
  return { id: file.id, script: file.script, foldCase: file.foldCase, toChar, toKey };
}

export const LAYOUTS: Readonly<Record<string, Layout>> = {
  us: build(us as LayoutFile),
  he: build(he as LayoutFile),
  ru: build(ru as LayoutFile),
};

/** Re-types text on another layout. Characters without a key in the source layout (digits, spaces, emoji) are kept. */
export function convertLayout(text: string, from: Layout, to: Layout): string {
  let out = '';
  for (const ch of text) {
    const key = from.toKey.get(from.foldCase ? ch.toLowerCase() : ch);
    out += key === undefined ? ch : (to.toChar.get(key) ?? ch);
  }
  return out;
}
