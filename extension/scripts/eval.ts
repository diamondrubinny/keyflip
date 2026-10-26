// Measures detection quality with held-out words.
// FP: valid words missing from the (trimmed) dictionary must not be "fixed".
// TP: Hebrew/English words typed on the wrong layout must be recovered.
import { readFileSync } from 'node:fs';
import { Detector } from '../src/detect.ts';
import { convert } from '../src/core.ts';

const read = (n: string) => readFileSync(new URL(`../src/data/${n}`, import.meta.url), 'utf8').split('\n').filter(Boolean);
const en = read('en.txt');
const he = read('he.txt');
const CUT = 30000;
const d = new Detector({ en: en.slice(0, CUT), he: he.slice(0, CUT) });

const pct = (a: number, b: number) => `${a}/${b} (${((100 * a) / b).toFixed(2)}%)`;

// False positives on held-out valid words.
const heldEn = en.slice(CUT).filter((w) => w.length >= 3 && /^[a-z]+$/.test(w));
const heldHe = he.slice(CUT).filter((w) => w.length >= 3);
const fpEn = heldEn.filter((w) => d.fixToken(w) !== null);
const fpHe = heldHe.filter((w) => d.fixToken(w) !== null);
console.log('false positives, held-out English:', pct(fpEn.length, heldEn.length), fpEn.slice(0, 25).join(' '));
console.log('false positives, held-out Hebrew :', pct(fpHe.length, heldHe.length), fpHe.slice(0, 25).join(' '));

// True positives: words typed on the wrong layout (full dictionaries).
const full = new Detector({ en, he });
const tpHeWords = he.slice(0, 20000).filter((w) => w.length >= 3);
const typedAsEn = tpHeWords.map((w) => [w, convert(w, 'he-to-en')] as const).filter(([, t]) => /^[a-z]+$/.test(t));
const okHe = typedAsEn.filter(([w, t]) => full.fixToken(t)?.replacement === w);
console.log('recovered Hebrew typed on EN layout:', pct(okHe.length, typedAsEn.length));

const tpEnWords = en.slice(0, 20000).filter((w) => w.length >= 3 && /^[a-z]+$/.test(w));
const typedAsHe = tpEnWords.map((w) => [w, convert(w, 'en-to-he')] as const);
const okEn = typedAsHe.filter(([w, t]) => full.fixToken(t)?.replacement === w);
console.log('recovered English typed on HE layout:', pct(okEn.length, typedAsHe.length));

const missed = typedAsEn.filter(([w, t]) => full.fixToken(t)?.replacement !== w).slice(0, 15).map(([w]) => w);
console.log('sample missed Hebrew:', missed.join(' '));
