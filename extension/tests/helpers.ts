import { readFileSync } from 'node:fs';
import { Detector } from '../src/detect.ts';

const read = (name: string): string[] =>
  readFileSync(new URL(`../src/data/${name}`, import.meta.url), 'utf8').split('\n').filter(Boolean);

export function makeDetector(): Detector {
  return new Detector({ en: read('en.txt'), he: read('he.txt') });
}
export { read };
