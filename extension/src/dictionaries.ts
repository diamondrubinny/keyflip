import en from './data/en.txt';
import he from './data/he.txt';
import type { Dictionaries } from './detect.ts';

const BUNDLED: Record<string, string> = { en, he };
const lines = (text: string): string[] => text.split('\n').filter(Boolean);

/**
 * Word lists for the enabled languages. English and Hebrew are bundled; other languages ship as
 * data/<lang>.txt in the extension package and are only read when the user enables them.
 */
export async function loadDictionaries(languages: readonly string[]): Promise<Dictionaries> {
  const dicts: Dictionaries = {};
  await Promise.all(
    languages.map(async (lang) => {
      const bundled = BUNDLED[lang];
      if (bundled !== undefined) {
        dicts[lang] = lines(bundled);
        return;
      }
      const response = await fetch(chrome.runtime.getURL(`data/${lang}.txt`));
      if (response.ok) dicts[lang] = lines(await response.text());
    }),
  );
  return dicts;
}
