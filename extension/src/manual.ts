import { convertLayout, type Layout } from './layouts.ts';
import { LATIN_LETTER as LATIN } from './languages.ts';
import type { Detector } from './detect.ts';

interface Counts {
  latin: number;
  other: number;
  layout: Layout | null;
}

function count(text: string, detector: Detector): Counts {
  const counts: Counts = { latin: 0, other: 0, layout: null };
  for (const ch of text) {
    if (LATIN.test(ch)) {
      counts.latin++;
      continue;
    }
    const lang = detector.otherLanguageOf(ch);
    if (lang) {
      counts.other++;
      counts.layout ??= lang.layout;
    }
  }
  return counts;
}

/**
 * Manual conversion (shortcut / context menu) for any set of enabled languages. Each word is converted from its own
 * script (by majority of letters): Latin words onto the layout of the language they read best in, other words onto
 * the Latin layout; tokens with no letters follow the dominant side of the whole text.
 * With only English and Hebrew enabled this equals core.convertAuto.
 */
export function manualConvert(text: string, detector: Detector): string {
  const all = count(text, detector);
  if (all.latin === 0 && all.other === 0) return text;
  const tokens = text.split(/(\s+)/);
  const target = all.latin > 0 ? detector.pickTarget(tokens.filter((t) => LATIN.test(t))) : null;
  const toOther = (t: string) => (target ? convertLayout(t, detector.latinLayout, target.layout) : t);
  const toLatin = (t: string, from: Layout | null) => (from ? convertLayout(t, from, detector.latinLayout) : t);

  return tokens
    .map((token) => {
      if (/^\s*$/.test(token)) return token;
      const c = count(token, detector);
      if (c.latin === 0 && c.other === 0) return all.latin >= all.other ? toOther(token) : toLatin(token, all.layout);
      return c.latin >= c.other ? toOther(token) : toLatin(token, c.layout);
    })
    .join('');
}
