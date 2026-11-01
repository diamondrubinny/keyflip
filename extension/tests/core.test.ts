import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, convertAuto, detectDirection } from '../src/core.ts';
import { makeDetector } from './helpers.ts';

test('en->he basics', () => {
  assert.equal(convert('akuo', 'en-to-he'), 'שלום');
  assert.equal(convert('tk,', 'en-to-he'), 'אלת');
  assert.equal(convert('vkk', 'en-to-he'), 'הלל');
});

test('he->en basics', () => {
  assert.equal(convert('יקךךם', 'he-to-en'), 'hello');
  assert.equal(convert('םרןעןמשך', 'he-to-en'), 'original');
});

test('final letters map straight from keys', () => {
  assert.equal(convert('l', 'en-to-he'), 'ך');
  assert.equal(convert('o', 'en-to-he'), 'ם');
  assert.equal(convert('i', 'en-to-he'), 'ן');
  assert.equal(convert(';', 'en-to-he'), 'ף');
  assert.equal(convert('.', 'en-to-he'), 'ץ');
});

test('digits, spaces and emoji are untouched', () => {
  assert.equal(convert('a1 b2 😀', 'en-to-he'), 'ש1 נ2 😀');
  assert.equal(convert('', 'en-to-he'), '');
});

test('round trip for mapped characters', () => {
  const s = "qwertyuiopasdfghjkl;'zxcvbnm,./`";
  assert.equal(convert(convert(s, 'en-to-he'), 'he-to-en'), s);
});

test('detectDirection', () => {
  assert.equal(detectDirection('akuo'), 'en-to-he');
  assert.equal(detectDirection('שלום'), 'he-to-en');
  assert.equal(detectDirection('123 !!'), null);
});

test('convertAuto handles mixed text per token', () => {
  assert.equal(convertAuto('akuo יקךךם'), 'שלום hello');
  assert.equal(convertAuto('12345'), '12345');
});

test('uppercase letters (caps lock) map like lowercase', () => {
  assert.equal(convert('AKUO', 'en-to-he'), 'שלום');
});

test('detector: wrong-layout words are fixed', () => {
  const d = makeDetector();
  assert.deepEqual(d.fixToken('akuo'), { consumed: 4, replacement: 'שלום' });
  assert.deepEqual(d.fixToken('יקךךם'), { consumed: 5, replacement: 'hello' });
});

test('detector: correct words are left alone', () => {
  const d = makeDetector();
  for (const w of ['hello', 'world', 'שלום', 'בבקשה', 'the', 'ok', 'a', 'https://x.io', 'user@mail.com', 'iPhone', 'Tel', 'a1b2c3', 'function', 'const']) {
    assert.equal(d.fixToken(w), null, w);
  }
});

test('detector: trailing punctuation is peeled', () => {
  const d = makeDetector();
  assert.deepEqual(d.fixToken('hello,'), null);
  assert.deepEqual(d.fixToken('akuo!'), { consumed: 4, replacement: 'שלום' });
});

import { trailingRunStart } from '../src/core.ts';

test('trailingRunStart picks the trailing same-script run', () => {
  assert.equal(trailingRunStart('hello שלום akuo vkk'), 'hello שלום '.length);
  assert.equal(trailingRunStart('abc\nakuo'), 4);
  assert.equal(trailingRunStart('akuo 123 vkk'), 0);
  assert.equal(trailingRunStart('   '), 3);
});

import { readFileSync } from 'node:fs';
import { convertAuto as convertAutoShared } from '../src/core.ts';

const shared = JSON.parse(readFileSync(new URL('../../shared/test-cases.json', import.meta.url), 'utf8'));

test('shared cases: convert', () => {
  for (const c of shared.convert) assert.equal(convert(c.input, c.dir), c.expected, c.input);
});
test('shared cases: convertAuto', () => {
  for (const c of shared.convertAuto) assert.equal(convertAutoShared(c.input), c.expected, c.input);
});
test('shared cases: trailingRunStart', () => {
  for (const c of shared.trailingRunStart) assert.equal(trailingRunStart(c.text), c.expected, c.text);
});
test('shared cases: detect', () => {
  const d = makeDetector();
  for (const c of shared.detect) assert.deepEqual(d.fixToken(c.token, { streak: c.streak ?? 0, sandwich: c.sandwich ?? false }), c.fix, `${c.token} streak=${c.streak ?? 0}`);
});

import { NgramModel } from '../src/ngram.ts';
import { read } from './helpers.ts';

test('ngram model prefers real words over random strings', () => {
  const model = new NgramModel(read('en.txt'));
  assert.ok(model.score('information') > model.score('xqzvkpw'));
  assert.ok(model.score('nothing') > model.score('akunl'));
});

test('detector: leading punctuation is preserved', () => {
  const d = makeDetector();
  assert.deepEqual(d.fixToken('"akuo'), { consumed: 5, replacement: '"שלום' });
});

import { Detector } from '../src/detect.ts';
import { manualConvert } from '../src/manual.ts';
import { LAYOUTS, convertLayout, convertLayoutVariants } from '../src/layouts.ts';

const detectorFor = (langs: string[]) => new Detector(Object.fromEntries(langs.map((l) => [l, read(`${l}.txt`)])));

test('russian layout: round trip and known words', () => {
  assert.equal(convertLayout('ghbdtn', LAYOUTS.us!, LAYOUTS.ru!), 'привет');
  assert.equal(convertLayout('руддщ', LAYOUTS.ru!, LAYOUTS.us!), 'hello');
  const s = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
  assert.equal(convertLayout(convertLayout(s, LAYOUTS.us!, LAYOUTS.ru!), LAYOUTS.ru!, LAYOUTS.us!), s);
});

test('shared cases: detection with other language sets', () => {
  const cache = new Map<string, Detector>();
  for (const c of shared.detectLanguages) {
    const key = c.languages.join(',');
    if (!cache.has(key)) cache.set(key, detectorFor(c.languages));
    const got = cache.get(key)!.fixToken(c.token, { streak: c.streak ?? 0, sandwich: c.sandwich ?? false });
    assert.deepEqual(got, c.fix, `${key}: ${c.token}`);
  }
});

test('shared cases: manual conversion', () => {
  for (const c of shared.manualConvert) assert.equal(manualConvert(c.input, detectorFor(c.languages)), c.expected, c.input);
});

test('manual conversion equals convertAuto with Hebrew and English only', () => {
  const d = detectorFor(['en', 'he']);
  for (const c of shared.convertAuto) assert.equal(manualConvert(c.input, d), c.expected, c.input);
});

test('arabic layout: shift letters, lam-alef and its two readings', () => {
  assert.equal(convertLayout('Hkh', LAYOUTS.us!, LAYOUTS.ar!), 'أنا');
  assert.equal(convertLayout('b', LAYOUTS.us!, LAYOUTS.ar!), 'لا');
  assert.equal(convertLayout('لاخخن', LAYOUTS.ar!, LAYOUTS.us!), 'book');
  assert.deepEqual(convertLayoutVariants('لاخخن', LAYOUTS.ar!, LAYOUTS.us!), ['book', 'ghook']);
  // Hebrew and Russian keep using their lowercase entries for Shift
  assert.equal(convertLayout('AKUO', LAYOUTS.us!, LAYOUTS.he!), 'שלום');
});
