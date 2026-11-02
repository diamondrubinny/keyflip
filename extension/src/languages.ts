/**
 * Language definitions used by the detector. A language has a word list (frequency ordered, loaded elsewhere),
 * the layout it is typed on, and the few morphology rules the detector understands.
 * Phase 1 of docs/MULTILANG_PLAN.md: English and Hebrew only, with behaviour identical to detection v2.
 */
export interface LanguageSpec {
  id: string;
  /** 'latin' languages share the user's Latin layout; every correction pairs a Latin language with another one. */
  side: 'latin' | 'other';
  layout: string;
  /** A converted string must match this to count as a word of the language. */
  word: RegExp;
  /** A typed token belongs to this language's script: letters plus the punctuation keys that are letters elsewhere. */
  typed: RegExp;
  /** The token must contain at least one real letter of the script. */
  letter: RegExp;
  /** Inflection suffixes tried when a word is missing from the list (stem, or stem + "e"). */
  suffixes: readonly string[];
  /** One-letter prefixes that may be stacked (up to three) in front of a word. */
  prefixes: string;
  /** Latin words up to TUNING.modelVowelMaxLen letters without one of these are abbreviations: skip the model. */
  vowels?: RegExp;
}

export const LANGUAGES: Readonly<Record<string, LanguageSpec>> = {
  en: {
    id: 'en',
    side: 'latin',
    layout: 'us',
    word: /^[a-z]+$/,
    typed: /^[a-z';,./`]+$/,
    letter: /[a-z]/,
    suffixes: ["'s", 's', 'es', 'ed', 'd', 'ing', 'ly', "'ll", "'re", "'ve", "n't", 'er', 'est', 'ies'],
    prefixes: '',
    vowels: /[aeiouy]/,
  },
  he: {
    id: 'he',
    side: 'other',
    layout: 'he',
    word: /^[א-ת]+$/,
    typed: /^[א-ת,.;'/]+$/,
    letter: /[א-ת]/,
    suffixes: [],
    prefixes: 'והבלמשכ',
  },
};
