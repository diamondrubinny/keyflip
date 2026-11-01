namespace KeyFlip.Core;

/// <summary>
/// Character trigram model (interpolated with bigram and unigram), trained on word types.
/// Port of extension/src/ngram.ts; both must stay numerically equivalent.
/// </summary>
public sealed class NgramModel
{
    private const double L3 = 0.6;
    private const double L2 = 0.3;
    private const double L1 = 0.1;

    private readonly Dictionary<string, int> _tri = new();
    private readonly Dictionary<string, int> _triCtx = new();
    private readonly Dictionary<string, int> _bi = new();
    private readonly Dictionary<string, int> _biCtx = new();
    private readonly Dictionary<char, int> _uni = new();
    private readonly long _total;
    private readonly int _vocab;

    public NgramModel(IReadOnlyList<string> words)
    {
        var symbols = new HashSet<char> { '$' };
        long total = 0;
        foreach (string w in words)
        {
            string s = "^^" + w + "$";
            for (int i = 2; i < s.Length; i++)
            {
                char c = s[i];
                symbols.Add(c);
                Inc(_tri, s.Substring(i - 2, 3));
                Inc(_triCtx, s.Substring(i - 2, 2));
                Inc(_bi, s.Substring(i - 1, 2));
                Inc(_biCtx, s.Substring(i - 1, 1));
                _uni[c] = _uni.GetValueOrDefault(c) + 1;
                total++;
            }
        }
        _total = total;
        _vocab = symbols.Count;
    }

    private static void Inc(Dictionary<string, int> map, string key) => map[key] = map.GetValueOrDefault(key) + 1;

    /// <summary>Mean natural-log probability per character (including the end marker). Higher = more word-like.</summary>
    public double Score(string word)
    {
        string s = "^^" + word + "$";
        double sum = 0;
        for (int i = 2; i < s.Length; i++)
        {
            char c = s[i];
            int tc = _triCtx.GetValueOrDefault(s.Substring(i - 2, 2));
            double p3 = tc > 0 ? (double)_tri.GetValueOrDefault(s.Substring(i - 2, 3)) / tc : 0;
            int bc = _biCtx.GetValueOrDefault(s.Substring(i - 1, 1));
            double p2 = bc > 0 ? (double)_bi.GetValueOrDefault(s.Substring(i - 1, 2)) / bc : 0;
            double p1 = ((double)_uni.GetValueOrDefault(c) + 1) / (_total + _vocab);
            sum += Math.Log(L3 * p3 + L2 * p2 + L1 * p1);
        }
        return sum / (s.Length - 2);
    }
}
