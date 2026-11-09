// Builds frequency-ordered word lists from FrequencyWords (hermitdave/FrequencyWords, OpenSubtitles 2018, *_full.txt).
// Usage: node scripts/build-dicts.mjs <lang>=<path to lang_full.txt> [...] [--min-count=20] [--max-words=150000]
//   e.g. node scripts/build-dicts.mjs en=en_full.txt he=he_full.txt ru=ru_full.txt fr=fr_full.txt
// Writes src/data/<lang>.txt (one word per line, most frequent first).
import { readFileSync, writeFileSync } from 'node:fs';

/** Which tokens count as words, per language (must match the `word` patterns in src/languages.ts). */
const WORD = {
  en: /^[a-z][a-z']*$/,
  he: /^[א-ת]{2,}$/,
  ru: /^[а-яё]{2,}$/,
  ar: /^[\u0621-\u063A\u0641-\u064A]{2,}$/,
  fr: /^(?:[a-zàâäæçéèêëîïôöœùûüÿ]+')?[a-zàâäæçéèêëîïôöœùûüÿ]+$/, // c'est is "c'" + "est" upstream; aujourd'hui stays whole
  de: /^[a-zäöüß]+$/,
  es: /^[a-záéíóúüñ]+$/,
};

const args = process.argv.slice(2);
const option = (name, fallback) => Number(args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const minCount = option('min-count', 20);
const maxWords = option('max-words', 150000);
const inputs = args.filter((a) => !a.startsWith('--')).map((a) => a.split('='));
if (inputs.length === 0 || inputs.some(([lang, path]) => !WORD[lang] || !path)) {
  throw new Error(`usage: build-dicts.mjs <lang>=<file> ... (langs: ${Object.keys(WORD).join(', ')})`);
}

for (const [lang, path] of inputs) {
  const out = [];
  const seen = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [word, count] = line.trim().split(' ');
    if (!word || Number(count) < minCount) break; // files are sorted by count
    if (!WORD[lang].test(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= maxWords) break;
  }
  writeFileSync(new URL(`../src/data/${lang}.txt`, import.meta.url), out.join('\n') + '\n');
  console.log(`${lang}=${out.length}`);
}
