import { convert, hasHebrew } from './core.ts';
import { NgramModel } from './ngram.ts';

export interface Dictionaries {
  en: string[]; // ordered by frequency, most frequent first
  he: string[];
}

export interface Fix {
  /** Number of characters at the start of the token that were replaced. */
  consumed: number;
  replacement: string;
}

export interface DetectOptions {
  /** The word sits between words that were just corrected: a short word valid in both languages is then flipped if the other reading is very common. */
  sandwich?: boolean;
  /** Number of consecutive words just corrected in the same field. Typing in the wrong layout tends to continue. */
  streak?: number;
}

/** Tunable thresholds (see scripts/eval.ts, which measures them on held-out words). */
export const TUNING = {
  rank3: 12000, // 3-letter words must be this frequent to be trusted
  rank4: 1e9, // 4-letter words (no limit)
  streakRank2: 600, // 2-letter words (only inside a streak)
  streakRank3Factor: 4,
  modelMinLen: 4, // dictionary-less decisions need at least this many letters
  modelMargin: 0.8, // required score gap (nats per char) between target and typed language
  modelMinTarget: -3.4, // converted word must look at least this word-like
  modelMaxTyped: -3.0, // typed word must look at most this word-like in its own language
  modelVowelMaxLen: 4, // typed Latin words up to this length without a, e, i, o, u, y are usually abbreviations (csrf, mkdir): skip the model
  sandwichRank: 400, // 'to' between two corrected words becomes 'אם' (rank < 400 in the other language)
  dualMinRank: 1000, // a word valid in BOTH languages is only flipped if the typed reading is at least this rare...
  dualRatio: 30, // ...and the other reading is this many times more frequent (rank ratio)
};

const HE_PREFIX_LETTERS = 'והבלמשכ';
const TRAILING_PUNCT = /[.,;:!?'"”’)\]}\/]/;
const LEADING_PUNCT = /^["(“‘{]+/;
const EN_SUFFIXES = ["'s", 's', 'es', 'ed', 'd', 'ing', 'ly', "'ll", "'re", "'ve", "n't", 'er', 'est', 'ies'];

export class Detector {
  private readonly en: Map<string, number>;
  private readonly he: Map<string, number>;
  private readonly dicts: Dictionaries;
  private enModelCache?: NgramModel;
  private heModelCache?: NgramModel;

  constructor(dicts: Dictionaries) {
    this.dicts = dicts;
    this.en = new Map(dicts.en.map((w, i) => [w, i]));
    this.he = new Map(dicts.he.map((w, i) => [w, i]));
  }

  // The statistical models are only needed for words missing from the dictionaries, so build them lazily.
  private get enModel(): NgramModel {
    return (this.enModelCache ??= new NgramModel(this.dicts.en));
  }

  private get heModel(): NgramModel {
    return (this.heModelCache ??= new NgramModel(this.dicts.he));
  }

  private rankLimit(len: number, streak: number): number {
    if (len <= 2) return streak > 0 ? TUNING.streakRank2 : -1;
    if (len === 3) return TUNING.rank3 * (streak > 0 ? TUNING.streakRank3Factor : 1);
    if (len === 4) return TUNING.rank4;
    return Number.POSITIVE_INFINITY;
  }

  /** Dictionary lookup for English including simple inflections. Returns the best (lowest) rank or undefined. */
  private englishRank(word: string): number | undefined {
    const exact = this.en.get(word);
    if (exact !== undefined) return exact;
    for (const suffix of EN_SUFFIXES) {
      if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        const r = this.en.get(stem) ?? this.en.get(stem + 'e');
        if (r !== undefined) return r;
      }
    }
    return undefined;
  }

  /** Dictionary lookup for Hebrew with up to three single-letter prefixes (ו, ה, ב, ל, מ, ש, כ). */
  private hebrewRank(word: string): { rank: number; stripped: number } | undefined {
    const exact = this.he.get(word);
    if (exact !== undefined) return { rank: exact, stripped: 0 };
    let w = word;
    for (let stripped = 1; stripped <= 3; stripped++) {
      if (w.length < 4 || !HE_PREFIX_LETTERS.includes(w[0]!)) break;
      w = w.slice(1);
      const r = this.he.get(w);
      if (r !== undefined && w.length >= 3) return { rank: r, stripped };
    }
    return undefined;
  }

  private isValidEnglish(word: string, streak = 0): boolean {
    const r = this.englishRank(word);
    if (r === undefined) return false;
    return r < this.rankLimit(word.length, streak) || word.length >= 5;
  }

  private isValidHebrew(word: string, streak = 0): boolean {
    const h = this.hebrewRank(word);
    if (!h) return false;
    const stem = word.length - h.stripped;
    return h.rank < this.rankLimit(stem, streak) || stem >= 5;
  }

  private modelSaysFlip(typedScore: number, targetScore: number): boolean {
    return (
      targetScore - typedScore >= TUNING.modelMargin &&
      targetScore >= TUNING.modelMinTarget &&
      typedScore <= TUNING.modelMaxTyped
    );
  }

  /** Decides whether one word (without surrounding punctuation) was typed in the wrong layout. */
  private fixWord(word: string, streak: number, allowModel: boolean, sandwich: boolean): string | null {
    if (word.length < 2) return null;
    if (/[0-9@\\]|:\/\//.test(word)) return null;
    if (/[A-Z]/.test(word)) return null; // names, acronyms, sentence starts, camelCase

    const isLatin = /^[a-z';,./`]+$/.test(word) && /[a-z]/.test(word);
    if (isLatin) {
      const he = convert(word, 'en-to-he');
      const heOk = /^[\u05D0-\u05EA]+$/.test(he);
      const er = this.englishRank(word);
      if (er !== undefined) {
        // Also a valid English word: flip only when the Hebrew reading is far more frequent.
        const hr = heOk ? this.hebrewRank(he) : undefined;
        const clear = (word.length >= 3 || streak > 0) && hr !== undefined && er >= TUNING.dualMinRank && hr.rank * TUNING.dualRatio < er;
        const between = sandwich && word.length <= 3 && hr !== undefined && hr.rank < TUNING.sandwichRank;
        return (clear || between) && this.isValidHebrew(he, Math.max(streak, between ? 1 : 0)) ? he : null;
      }
      if (!heOk) return null;
      if (this.isValidHebrew(he, streak)) return he;
      if (allowModel && he.length >= TUNING.modelMinLen && !this.hebrewRank(he) && (word.length > TUNING.modelVowelMaxLen || /[aeiouy]/.test(word))) {
        return this.modelSaysFlip(this.enModel.score(word), this.heModel.score(he)) ? he : null;
      }
      return null;
    }

    if (/^[\u05D0-\u05EA,.;'/]+$/.test(word) && hasHebrew(word)) {
      const en = convert(word, 'he-to-en');
      const enOk = /^[a-z]+$/.test(en);
      const hr = this.hebrewRank(word);
      if (hr !== undefined) {
        // Also a valid Hebrew word: flip only when the English reading is far more frequent.
        const er = enOk ? this.englishRank(en) : undefined;
        const clear = (word.length >= 3 || streak > 0) && er !== undefined && hr.rank >= TUNING.dualMinRank && er * TUNING.dualRatio < hr.rank;
        const between = sandwich && word.length <= 3 && er !== undefined && er < TUNING.sandwichRank;
        return (clear || between) && this.isValidEnglish(en, Math.max(streak, between ? 1 : 0)) ? en : null;
      }
      if (!enOk) return null;
      if (this.isValidEnglish(en, streak)) return en;
      if (allowModel && en.length >= TUNING.modelMinLen && this.englishRank(en) === undefined) {
        return this.modelSaysFlip(this.heModel.score(word), this.enModel.score(en)) ? en : null;
      }
      return null;
    }
    return null;
  }

  /**
   * Examines a whitespace-free token that has just been completed and returns a fix,
   * or null if the token looks fine. Trailing sentence punctuation is tried both as
   * punctuation and as layout-mapped letters (e.g. "," is the Hebrew ת key).
   */
  fixToken(token: string, options: DetectOptions = {}): Fix | null {
    const streak = options.streak ?? 0;
    const sandwich = options.sandwich ?? false;
    let lead = 0;
    const leading = LEADING_PUNCT.exec(token);
    if (leading) lead = leading[0].length;
    const body = token.slice(lead);
    if (body.length === 0) return null;

    // Dictionary decisions first at every punctuation split, then (only if none matched) the statistical model.
    // This keeps "akuo," as "שלום," and not "שלוםת".
    for (const allowModel of [false, true]) {
      let end = body.length;
      for (;;) {
        const candidate = body.slice(0, end);
        const fixed = this.fixWord(candidate, streak, allowModel, sandwich);
        if (fixed !== null) return { consumed: lead + end, replacement: token.slice(0, lead) + fixed };
        if (end <= 1 || !TRAILING_PUNCT.test(candidate[end - 1]!)) break;
        end--;
      }
    }
    return null;
  }
}
