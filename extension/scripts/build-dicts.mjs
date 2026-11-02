// Builds word lists from FrequencyWords (hermitdave/FrequencyWords, OpenSubtitles 2018, *_full.txt files).
// Usage: node scripts/build-dicts.mjs <en_full.txt> <he_full.txt> [minCount=20] [maxWords=150000]
import { readFileSync, writeFileSync } from 'node:fs';

const [enPath, hePath, minArg, maxArg] = process.argv.slice(2);
if (!enPath || !hePath) throw new Error('usage: build-dicts.mjs <en_full.txt> <he_full.txt> [minCount] [maxWords]');
const minCount = Number(minArg ?? 20);
const maxWords = Number(maxArg ?? 150000);

function load(path, re) {
  const out = [];
  const seen = new Set();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [word, count] = line.trim().split(' ');
    if (!word || Number(count) < minCount) break; // files are sorted by count
    if (!re.test(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= maxWords) break;
  }
  return out;
}

const en = load(enPath, /^[a-z][a-z']*$/);
const he = load(hePath, /^[א-ת]{2,}$/);
writeFileSync(new URL('../src/data/en.txt', import.meta.url), en.join('\n') + '\n');
writeFileSync(new URL('../src/data/he.txt', import.meta.url), he.join('\n') + '\n');
console.log(`en=${en.length} he=${he.length}`);
