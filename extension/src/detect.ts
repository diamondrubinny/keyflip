import { convert, hasHebrew } from './core.ts';

export interface Dictionaries {
  en: string[]; // ordered by frequency, most frequent first
  he: string[];
}

export interface Fix {
  /** Number of characters at the start of the token that were replaced. */
  consumed: number;
  replacement: string;
}

const HE_PREFIXES = 'והבלמשכ';
const TRAILING_PUNCT = /[.,;:!?'"”’)\]}\/]/;
const LEADING_PUNCT = /^["(“‘{]+/;

/** Words of length <= SHORT_LEN must be this frequent (rank) to be trusted. */
const SHORT_LEN = 3;
const SHORT_RANK_LIMIT = 12000;

export class Detector {
  private readonly en: Map<string, number>;
  private readonly he: Map<string, number>;

  constructor(dicts: Dictionaries) {
    this.en = new Map(dicts.en.map((w, i) => [w, i]));
    this.he = new Map(dicts.he.map((w, i) => [w, i]));
  }

  private isEnglish(word: string): boolean {
    if (this.en.has(word)) return true;
    for (const suffix of ["'s", 's', 'es', 'ed', 'd', 'ing', 'ly', "'ll", "'re", "'ve", "n't"]) {
      if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        if (this.en.has(stem) || this.en.has(stem + 'e')) return true;
      }
    }
    return false;
  }

  private isHebrew(word: string, strict: boolean): boolean {
    const check = (w: string): boolean => {
      const rank = this.he.get(w);
      if (rank === undefined) return false;
      return !(strict && w.length <= SHORT_LEN && rank > SHORT_RANK_LIMIT);
    };
    if (check(word)) return true;
    // Single-letter prefixes (ו, ה, ב, ל, מ, ש, כ) are not in the base list.
    if (word.length >= 4 && HE_PREFIXES.includes(word[0]!) && check(word.slice(1))) return true;
    if (word.length >= 5 && word[0] === 'ו' && HE_PREFIXES.includes(word[1]!) && check(word.slice(2))) return true;
    return false;
  }

  private isEnglishStrict(word: string): boolean {
    const rank = this.en.get(word);
    if (rank !== undefined) return !(word.length <= SHORT_LEN && rank > SHORT_RANK_LIMIT);
    return this.isEnglish(word);
  }

  /** Decides whether one word (without surrounding punctuation) was typed in the wrong layout. */
  private fixWord(word: string): string | null {
    if (word.length < 3) return null;
    if (/[0-9@\\]|:\/\//.test(word)) return null;
    if (/[A-Z]/.test(word)) return null; // names, acronyms, sentence starts, camelCase
    const isLatin = /^[a-z';,./`]+$/.test(word) && /[a-z]/.test(word);
    if (isLatin) {
      if (this.isEnglish(word)) return null;
      const he = convert(word, 'en-to-he');
      if (!/^[א-ת]+$/.test(he)) return null;
      return this.isHebrew(he, true) ? he : null;
    }
    if (/^[א-ת,.;'/]+$/.test(word) && hasHebrew(word)) {
      if (this.isHebrew(word, false)) return null;
      const en = convert(word, 'he-to-en');
      if (!/^[a-z]+$/.test(en)) return null;
      return this.isEnglishStrict(en) ? en : null;
    }
    return null;
  }

  /**
   * Examines a whitespace-free token that has just been completed and returns a fix,
   * or null if the token looks fine. Trailing sentence punctuation is tried both as
   * punctuation and as layout-mapped letters (e.g. "," is the Hebrew ת key).
   */
  fixToken(token: string): Fix | null {
    let lead = 0;
    const leading = LEADING_PUNCT.exec(token);
    if (leading) lead = leading[0].length;
    const body = token.slice(lead);
    if (body.length === 0) return null;

    // Try the longest candidate first, then peel trailing punctuation one character at a time.
    let end = body.length;
    for (;;) {
      const candidate = body.slice(0, end);
      const fixed = this.fixWord(candidate);
      if (fixed !== null) return { consumed: lead + end, replacement: token.slice(0, lead) + fixed };
      if (end <= 1 || !TRAILING_PUNCT.test(candidate[end - 1]!)) return null;
      end--;
    }
  }
}
