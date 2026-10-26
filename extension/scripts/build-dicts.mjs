// Builds compact word lists from FrequencyWords (hermitdave/FrequencyWords, OpenSubtitles 2018).
// Usage: node scripts/build-dicts.mjs <en_50k.txt> <he_50k.txt>
import { readFileSync, writeFileSync } from 'node:fs';

const [enPath, hePath] = process.argv.slice(2);
if (!enPath || !hePath) throw new Error('usage: build-dicts.mjs <en_50k.txt> <he_50k.txt>');

function load(path, re, limit) {
  const out = [];
  const seen = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const word = line.split(' ')[0]?.trim();
    if (!word || !re.test(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

const en = load(enPath, /^[a-z][a-z']*$/, 40000);
const he = load(hePath, /^[א-ת]{2,}$/, 40000);
writeFileSync(new URL('../src/data/en.txt', import.meta.url), en.join('\n') + '\n');
writeFileSync(new URL('../src/data/he.txt', import.meta.url), he.join('\n') + '\n');
console.log(`en=${en.length} he=${he.length}`);
