import { LAYOUTS, convertLayout, type Layout } from './layouts.ts';
import { LANGUAGES, type LanguageSpec } from './languages.ts';
import { NgramModel } from './ngram.ts';

/** Frequency-ordered word lists (most frequent first), keyed by language id (see languages.ts). */
export type Dictionaries = Partial<Record<string, string[]>>;

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
  modelVowelMaxLen: 4, // typed Latin words up to this length without a vowel are usually abbreviations (csrf, mkdir): skip the model
  sandwichRank: 400, // 'to' between two corrected words becomes 'אם' (rank < 400 in the other language)
  dualMinRank: 1000, // a word valid in BOTH languages is only flipped if the typed reading is at least this rare...
  dualRatio: 30, // ...and the other reading is this many times more frequent (rank ratio)
};

const TRAILING_PUNCT = /[.,;:!?'"”’)\]}\/]/;
const LEADING_PUNCT = /^["(“‘{]+/;

interface Lang {
  spec: LanguageSpec;
  layout: Layout;
  words: readonly string[];
  ranks: Map<string, number>;
  model?: NgramModel;
}

interface Hit {
  rank: number;
  /** Prefix letters removed to find the word (Hebrew ו, ה, ב ...). */
  stripped: number;
}

/** Where a typed token comes from: one or more languages sharing a script and a layout. */
interface Source {
  langs: Lang[];
  layout: Layout;
  side: 'latin' | 'other';
}

export class Detector {
  private readonly langs: Lang[];

  constructor(dicts: Dictionaries) {
    this.langs = Object.values(LANGUAGES)
      .filter((spec) => dicts[spec.id] !== undefined)
      .map((spec) => {
        const words = dicts[spec.id]!;
        return { spec, layout: LAYOUTS[spec.layout]!, words, ranks: new Map(words.map((w, i) => [w, i])) };
      });
  }

  // The statistical models are only needed for words missing from the dictionaries, so build them lazily.
  private model(lang: Lang): NgramModel {
    return (lang.model ??= new NgramModel(lang.words));
  }

  private rankLimit(len: number, streak: number): number {
    if (len <= 2) return streak > 0 ? TUNING.streakRank2 : -1;
    if (len === 3) return TUNING.rank3 * (streak > 0 ? TUNING.streakRank3Factor : 1);
    if (len === 4) return TUNING.rank4;
    return Number.POSITIVE_INFINITY;
  }

  /** Dictionary lookup with the language's inflection suffixes and stacked one-letter prefixes. */
  private lookup(lang: Lang, word: string): Hit | undefined {
    const exact = lang.ranks.get(word);
    if (exact !== undefined) return { rank: exact, stripped: 0 };
    for (const suffix of lang.spec.suffixes) {
      if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
        const stem = word.slice(0, -suffix.length);
        const r = lang.ranks.get(stem) ?? lang.ranks.get(stem + 'e');
        if (r !== undefined) return { rank: r, stripped: 0 };
      }
    }
    let w = word;
    for (let stripped = 1; stripped <= 3 && lang.spec.prefixes; stripped++) {
      if (w.length < 4 || !lang.spec.prefixes.includes(w[0]!)) break;
      w = w.slice(1);
      const r = lang.ranks.get(w);
      if (r !== undefined && w.length >= 3) return { rank: r, stripped };
    }
    return undefined;
  }

  /** Best (most frequent) reading of a word among several languages. */
  private bestLookup(langs: readonly Lang[], word: string): Hit | undefined {
    let best: Hit | undefined;
    for (const lang of langs) {
      const hit = this.lookup(lang, word);
      if (hit && (!best || hit.rank < best.rank)) best = hit;
    }
    return best;
  }

  private isValid(lang: Lang, word: string, streak: number): boolean {
    const h = this.lookup(lang, word);
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

  /** The script (and so the layout) the token was typed in, or null if it is not a word of any enabled language. */
  private sourceOf(word: string): Source | null {
    const latin = this.langs.filter((l) => l.spec.side === 'latin');
    if (latin.some((l) => l.spec.typed.test(word) && l.spec.letter.test(word))) {
      return { langs: latin, layout: latin[0]!.layout, side: 'latin' };
    }
    for (const lang of this.langs) {
      if (lang.spec.side === 'other' && lang.spec.typed.test(word) && lang.spec.letter.test(word)) {
        return { langs: [lang], layout: lang.layout, side: 'other' };
      }
    }
    return null;
  }

  /** Every correction pairs a Latin language with a language in another script. */
  private targetsOf(source: Source): Lang[] {
    return this.langs.filter((l) => l.spec.side !== source.side);
  }

  private typedScore(source: Source, word: string): number {
    return Math.max(...source.langs.map((l) => this.model(l).score(word)));
  }

  /** Decides whether one word (without surrounding punctuation) was typed in the wrong layout. */
  private fixWord(word: string, streak: number, allowModel: boolean, sandwich: boolean): string | null {
    if (word.length < 2) return null;
    if (/[0-9@\\]|:\/\//.test(word)) return null;
    if (/[A-Z]/.test(word)) return null; // names, acronyms, sentence starts, camelCase

    const source = this.sourceOf(word);
    if (!source) return null;
    const typedHit = this.bestLookup(source.langs, word);

    for (const target of this.targetsOf(source)) {
      const converted = convertLayout(word, source.layout, target.layout);
      const ok = target.spec.word.test(converted);

      if (typedHit !== undefined) {
        // Also a valid word as typed: flip only when the other reading is far more frequent,
        // or when a short word sits between two corrected words.
        const hit = ok ? this.lookup(target, converted) : undefined;
        const clear =
          (word.length >= 3 || streak > 0) &&
          hit !== undefined &&
          typedHit.rank >= TUNING.dualMinRank &&
          hit.rank * TUNING.dualRatio < typedHit.rank;
        const between = sandwich && word.length <= 3 && hit !== undefined && hit.rank < TUNING.sandwichRank;
        if ((clear || between) && this.isValid(target, converted, Math.max(streak, between ? 1 : 0))) return converted;
        continue;
      }

      if (!ok) continue;
      if (this.isValid(target, converted, streak)) return converted;
      const abbreviation =
        source.side === 'latin' &&
        word.length <= TUNING.modelVowelMaxLen &&
        !source.langs.some((l) => l.spec.vowels?.test(word));
      if (allowModel && converted.length >= TUNING.modelMinLen && !this.lookup(target, converted) && !abbreviation) {
        if (this.modelSaysFlip(this.typedScore(source, word), this.model(target).score(converted))) return converted;
      }
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
