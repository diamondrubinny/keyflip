import en from './data/en.txt';
import he from './data/he.txt';
import type { Dictionaries } from './detect.ts';

export function loadDictionaries(): Dictionaries {
  return {
    en: en.split('\n').filter(Boolean),
    he: he.split('\n').filter(Boolean),
  };
}
