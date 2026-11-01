import { LAYOUTS, convertLayout, convertLayoutVariants, type Layout } from './layouts.ts';
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
  modelShiftMargin: 1.2, // tokens with Shift letters (Arabic أ = H) need a larger model margin: capitals are often names
  modelTieMargin: 0.5, // with several target languages, the best model reading must win by this much (nats per char)
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

/** A possible correction into one target language. */
interface Candidate {
  text: string;
  /** Dictionary rank of the reading, or undefined when only the statistical model supports it. */
  rank?: number;
  /** Model margin (target score minus typed score) for model-only readings. */
  margin?: number;
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

/** Dictionary readings beat model-only ones; among dictionary readings the more frequent wins. */
function better(a: Candidate, b: Candidate): boolean {
  if (a.rank !== undefined || b.rank !== undefined) return b.rank === undefined || (a.rank !== undefined && a.rank < b.rank);
  return a.margin! > b.margin!;
}

export class Detector {
  private readonly langs: Lang[];
  /** Uppercase Latin letters that are Shift keys of an enabled layout (Arabic H = أ), not capitals. */
  private readonly shiftLetters: Set<string>;
  /** Single Latin keys that type a whole word on an enabled layout (Arabic b = لا, "no"). */
  private readonly wordKeys: Set<string>;

  constructor(dicts: Dictionaries) {
    this.langs = Object.values(LANGUAGES)
      .filter((spec) => dicts[spec.id] !== undefined)
      .map((spec) => {
        const words = dicts[spec.id]!;
        return { spec, layout: LAYOUTS[spec.layout]!, words, ranks: new Map(words.map((w, i) => [w, i])) };
      });
    this.shiftLetters = new Set(
      this.langs
        .filter((l) => l.spec.side === 'other')
        .flatMap((l) => [...l.layout.toChar.keys()].filter((k) => /^[A-Z]$/.test(k))),
    );
    this.wordKeys = new Set(
      this.langs
        .filter((l) => l.spec.side === 'other')
        .flatMap((l) => [...l.layout.toChar].filter(([, out]) => [...out].length > 1).map(([k]) => k)),
    );
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

  private modelSaysFlip(typedScore: number, targetScore: number, margin = TUNING.modelMargin): boolean {
    return (
      targetScore - typedScore >= margin &&
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
    // One letter is never a word to fix, except a key that types a whole word, inside a run of fixes ("b" = لا).
    if (word.length < 2 && !((streak > 0 || sandwich) && this.wordKeys.has(word))) return null;
    if (/[0-9@\\]|:\/\//.test(word)) return null;
    // Capitals mean names, acronyms, sentence starts or camelCase (any script) - except Shift letters of an
    // enabled layout (Arabic أ is Shift+H). For such tokens the model needs a larger margin.
    const capitals = [...word].filter((ch) => /\p{Lu}/u.test(ch));
    if (capitals.some((ch) => !this.shiftLetters.has(ch))) return null;
    const shifted = capitals.length > 0;

    const source = this.sourceOf(shifted ? word.toLowerCase() : word);
    if (!source) return null;
    if (shifted && source.side !== 'latin') return null;
    const typedHit = this.bestLookup(source.langs, word) ?? (shifted ? this.bestLookup(source.langs, word.toLowerCase()) : undefined);

    const candidates: Candidate[] = [];
    for (const target of this.targetsOf(source)) {
      const candidate = this.candidate(source, target, word, typedHit, streak, allowModel, sandwich);
      if (candidate) candidates.push(candidate);
    }
    return this.choose(candidates);
  }

  /** The correction into one target language, if the rules allow it. */
  private candidate(
    source: Source,
    target: Lang,
    word: string,
    typedHit: Hit | undefined,
    streak: number,
    allowModel: boolean,
    sandwich: boolean,
  ): Candidate | null {
    // A layout with multi-character keys (Arabic لا) can be read several ways; keep the best reading.
    let best: Candidate | null = null;
    for (const converted of convertLayoutVariants(word, source.layout, target.layout)) {
      const c = this.candidateFor(source, target, word, converted, typedHit, streak, allowModel, sandwich);
      if (c && (!best || better(c, best))) best = c;
    }
    return best;
  }

  private candidateFor(
    source: Source,
    target: Lang,
    word: string,
    converted: string,
    typedHit: Hit | undefined,
    streak: number,
    allowModel: boolean,
    sandwich: boolean,
  ): Candidate | null {
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
      if ((clear || between) && this.isValid(target, converted, Math.max(streak, between ? 1 : 0))) {
        return { text: converted, rank: hit!.rank };
      }
      return null;
    }

    if (!ok) return null;
    if (this.isValid(target, converted, streak)) return { text: converted, rank: this.lookup(target, converted)!.rank };
    const abbreviation =
      source.side === 'latin' &&
      word.length <= TUNING.modelVowelMaxLen &&
      !source.langs.some((l) => l.spec.vowels?.test(word));
    if (allowModel && converted.length >= TUNING.modelMinLen && !this.lookup(target, converted) && !abbreviation) {
      const typed = this.typedScore(source, word.toLowerCase()); // the models know no capitals (Arabic أ is Shift+H)
      const score = this.model(target).score(converted);
      if (this.modelSaysFlip(typed, score, /[A-Z]/.test(word) ? TUNING.modelShiftMargin : TUNING.modelMargin)) {
        return { text: converted, margin: score - typed };
      }
    }
    return null;
  }

  /**
   * Picks among corrections into different target languages (e.g. Latin letters that could be Hebrew or Russian).
   * Dictionary readings beat model-only ones; a reading must clearly beat the runner-up, otherwise nothing is changed.
   */
  private choose(candidates: Candidate[]): string | null {
    if (candidates.length <= 1) return candidates[0]?.text ?? null;
    const dict = candidates.filter((c) => c.rank !== undefined).sort((a, b) => a.rank! - b.rank!);
    if (dict.length === 1) return dict[0]!.text;
    if (dict.length > 1) return dict[0]!.rank! * TUNING.dualRatio < dict[1]!.rank! ? dict[0]!.text : null;
    const model = candidates.sort((a, b) => b.margin! - a.margin!);
    return model[0]!.margin! - model[1]!.margin! >= TUNING.modelTieMargin ? model[0]!.text : null;
  }

  /**
   * Manual conversion: picks the language a run of Latin words was meant to be in (e.g. Hebrew or Russian),
   * by how many of the converted words are in each dictionary, then by how word-like they look.
   */
  pickTarget(latinWords: readonly string[]): { id: string; layout: Layout } | null {
    const latin = this.langs.find((l) => l.spec.side === 'latin');
    const targets = this.langs.filter((l) => l.spec.side === 'other');
    if (!latin || targets.length === 0) return null;
    if (targets.length === 1) return { id: targets[0]!.spec.id, layout: targets[0]!.layout };
    const converted = (lang: Lang) =>
      latinWords.map((w) => convertLayout(w.toLowerCase(), latin.layout, lang.layout)).filter((w) => lang.spec.word.test(w));
    const ranked = targets
      .map((lang) => ({ lang, hits: converted(lang).filter((w) => this.lookup(lang, w)).length }))
      .sort((a, b) => b.hits - a.hits);
    let best = ranked[0]!;
    const tied = ranked.filter((r) => r.hits === best.hits);
    if (tied.length > 1) {
      // Only when the dictionaries cannot decide: which reading looks more like real words (builds the models).
      const score = (lang: Lang) => converted(lang).reduce((sum, w) => sum + this.model(lang).score(w), 0);
      best = tied.map((r) => ({ ...r, score: score(r.lang) })).sort((a, b) => b.score - a.score)[0]!;
    }
    return { id: best!.lang.spec.id, layout: best!.lang.layout };
  }

  /** The enabled language whose script a token is written in (null for Latin or neutral tokens). */
  otherLanguageOf(token: string): { id: string; layout: Layout } | null {
    const lang = this.langs.find((l) => l.spec.side === 'other' && l.spec.letter.test(token));
    return lang ? { id: lang.spec.id, layout: lang.layout } : null;
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
