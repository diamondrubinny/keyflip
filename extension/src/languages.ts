/**
 * Language definitions used by the detector. A language has a word list (frequency ordered, loaded elsewhere),
 * the layout it is typed on, and the few morphology rules the detector understands.
 * See docs/MULTILANG_PLAN.md. Every correction pairs a Latin language with a language in another script.
 * Latin languages (English, French, German, Spanish) share the user's Latin layout (US QWERTY, AZERTY, QWERTZ or
 * Spanish). Which characters a token typed on a layout may contain is derived from the layout by the detector.
 */
export interface LanguageSpec {
  id: string;
  /** 'latin' languages share the user's Latin layout; every correction pairs a Latin language with another one. */
  side: 'latin' | 'other';
  /** Layout of an 'other' language; Latin languages use the detector's Latin layout. */
  layout?: string;
  /** A converted string must match this to count as a word of the language. */
  word: RegExp;
  /** The token must contain at least one real letter of the script. */
  letter: RegExp;
  /** Inflection suffixes tried when a word is missing from the list (stem, or stem + "e"). */
  suffixes: readonly string[];
  /** One-letter prefixes that may be stacked (up to three) in front of a word. */
  prefixes: string;
  /** Elided clitics written with an apostrophe in front of a word (French c'est = c' + est). */
  elisions?: readonly string[];
  /** Latin words up to TUNING.modelVowelMaxLen letters without one of these are abbreviations: skip the model. */
  vowels?: RegExp;
  /** One-letter words, fixed only inside a run of corrections (Russian в, у, с, к ...). */
  singleLetters?: string;
}

/** A Latin letter, including the accented letters of French, German and Spanish (Latin-1 Supplement and Extended-A). */
export const LATIN_LETTER = /[a-zA-ZÀ-ÖØ-öø-ɏ]/;

const FR = 'a-zàâäæçéèêëîïôöœùûüÿ';
const DE = 'a-zäöüß';
const ES = 'a-záéíóúüñ';

export const LANGUAGES: Readonly<Record<string, LanguageSpec>> = {
  en: {
    id: 'en',
    side: 'latin',
    word: /^[a-z]+$/,
    letter: /[a-z]/,
    suffixes: ["'s", 's', 'es', 'ed', 'd', 'ing', 'ly', "'ll", "'re", "'ve", "n't", 'er', 'est', 'ies'],
    prefixes: '',
    vowels: /[aeiouy]/,
    singleLetters: 'a',
  },
  he: {
    id: 'he',
    side: 'other',
    layout: 'he',
    word: /^[א-ת]+$/,
    letter: /[א-ת]/,
    suffixes: [],
    prefixes: 'והבלמשכ',
  },
  ru: {
    id: 'ru',
    side: 'other',
    layout: 'ru',
    word: /^[а-яё]+$/,
    letter: /[а-яё]/,
    suffixes: [], // the word list already holds inflected forms
    prefixes: '',
    singleLetters: 'вускиаоя',
  },
  ar: {
    id: 'ar',
    side: 'other',
    layout: 'ar',
    // Letters ء..غ and ف..ي (no tatweel, no diacritics). أ إ آ are Shift keys on the Arabic layout.
    word: /^[ء-غف-ي]+$/,
    letter: /[ء-غف-ي]/,
    suffixes: [],
    prefixes: '',
  },
  fr: {
    id: 'fr',
    side: 'latin',
    // One apostrophe inside a word: c'est, l'école, aujourd'hui.
    word: new RegExp(`^(?:[${FR}]+')?[${FR}]+$`),
    letter: new RegExp(`[${FR}]`),
    suffixes: [], // the word list holds inflected forms
    prefixes: '',
    elisions: ["c'", "d'", "j'", "l'", "m'", "n'", "s'", "t'", "qu'"],
    vowels: /[aeiouyàâäéèêëîïôöùûüÿœæ]/,
    singleLetters: 'ay',
  },
  de: {
    id: 'de',
    side: 'latin',
    word: new RegExp(`^[${DE}]+$`),
    letter: new RegExp(`[${DE}]`),
    suffixes: [],
    prefixes: '',
    vowels: /[aeiouyäöü]/,
  },
  es: {
    id: 'es',
    side: 'latin',
    word: new RegExp(`^[${ES}]+$`),
    letter: new RegExp(`[${ES}]`),
    suffixes: [],
    prefixes: '',
    vowels: /[aeiouáéíóúü]/,
    singleLetters: 'ayoeu',
  },
};
