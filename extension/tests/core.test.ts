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
