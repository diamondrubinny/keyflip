/**
 * Character trigram model (interpolated with bigram and unigram), trained on word types.
 * Used to judge how "word-like" an unknown string is in a language. Pure functions over Maps so the
 * C# port (desktop/KeyFlip.Core/NgramModel.cs) can reproduce it exactly.
 */
export class NgramModel {
  private readonly tri = new Map<string, number>();
  private readonly triCtx = new Map<string, number>();
  private readonly bi = new Map<string, number>();
  private readonly biCtx = new Map<string, number>();
  private readonly uni = new Map<string, number>();
  private total = 0;
  private readonly vocab: number;

  static readonly L3 = 0.6;
  static readonly L2 = 0.3;
  static readonly L1 = 0.1;

  constructor(words: readonly string[]) {
    const symbols = new Set<string>(['$']);
    for (const w of words) {
      const s = '^^' + w + '$';
      for (let i = 2; i < s.length; i++) {
        const c = s[i]!;
        symbols.add(c);
        inc(this.tri, s.substring(i - 2, i + 1));
        inc(this.triCtx, s.substring(i - 2, i));
        inc(this.bi, s.substring(i - 1, i + 1));
        inc(this.biCtx, s.substring(i - 1, i));
        inc(this.uni, c);
        this.total++;
      }
    }
    this.vocab = symbols.size;
  }

  /** Mean natural-log probability per character (including the end marker). Higher = more word-like. */
  score(word: string): number {
    const s = '^^' + word + '$';
    let sum = 0;
    for (let i = 2; i < s.length; i++) {
      const c = s[i]!;
      const t = s.substring(i - 2, i + 1);
      const tc = this.triCtx.get(s.substring(i - 2, i)) ?? 0;
      const p3 = tc > 0 ? (this.tri.get(t) ?? 0) / tc : 0;
      const bc = this.biCtx.get(s.substring(i - 1, i)) ?? 0;
      const p2 = bc > 0 ? (this.bi.get(s.substring(i - 1, i + 1)) ?? 0) / bc : 0;
      const p1 = ((this.uni.get(c) ?? 0) + 1) / (this.total + this.vocab);
      sum += Math.log(NgramModel.L3 * p3 + NgramModel.L2 * p2 + NgramModel.L1 * p1);
    }
    return sum / (s.length - 2);
  }
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
