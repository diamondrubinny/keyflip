using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>Result of an automatic correction: the first <see cref="Consumed"/> chars of the token become <see cref="Replacement"/>.</summary>
public sealed record Fix(int Consumed, string Replacement);

/// <summary>
/// Decides whether a typed word was written in the wrong layout, using frequency word lists and a character n-gram
/// model. Port of extension/src/detect.ts; thresholds in <see cref="Tuning"/> come from scripts/eval.ts.
/// </summary>
public sealed class Detector
{
    /// <summary>Tunable thresholds, measured on held-out words (see the extension's eval script).</summary>
    public static class Tuning
    {
        public const double Rank3 = 12000;
        public const double Rank4 = 1e9;
        public const double StreakRank2 = 600;
        public const double StreakRank3Factor = 4;
        public const int ModelMinLen = 4;
        public const int ModelVowelMaxLen = 4;
        public const double ModelMargin = 0.8;
        public const double ModelMinTarget = -3.4;
        public const double ModelMaxTyped = -3.0;
        public const double DualMinRank = 1000;
        public const double DualRatio = 30;
        public const double SandwichRank = 400;
    }

    private const string HePrefixLetters = "והבלמשכ";
    private const string TrailingPunct = ".,;:!?'\"”’)]}/";
    private const string LeadingPunct = "\"(“‘{";

    private static readonly string[] EnSuffixes = { "'s", "s", "es", "ed", "d", "ing", "ly", "'ll", "'re", "'ve", "n't", "er", "est", "ies" };
    private static readonly Regex Forbidden = new(@"[0-9@\\]|://", RegexOptions.Compiled);
    private static readonly Regex UpperCase = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex LatinWord = new(@"^[a-z';,./`]+$", RegexOptions.Compiled);
    private static readonly Regex HasLatin = new("[a-z]", RegexOptions.Compiled);
    private static readonly Regex OnlyHebrew = new("^[א-ת]+$", RegexOptions.Compiled);
    private static readonly Regex HebrewWord = new("^[א-ת,.;'/]+$", RegexOptions.Compiled);
    private static readonly Regex OnlyLatin = new("^[a-z]+$", RegexOptions.Compiled);
    private static readonly Regex Vowel = new("[aeiouy]", RegexOptions.Compiled);

    private readonly IReadOnlyList<string> _enWords;
    private readonly IReadOnlyList<string> _heWords;
    private readonly Dictionary<string, int> _en;
    private readonly Dictionary<string, int> _he;
    private NgramModel? _enModel;
    private NgramModel? _heModel;

    public Detector(IReadOnlyList<string> english, IReadOnlyList<string> hebrew)
    {
        _enWords = english;
        _heWords = hebrew;
        _en = Index(english);
        _he = Index(hebrew);
    }

    /// <summary>Builds a detector from the word lists embedded in the assembly.</summary>
    public static Detector CreateDefault() => new(ReadLines("en.txt"), ReadLines("he.txt"));

    // The statistical models are only needed for words missing from the dictionaries, so they are built lazily.
    private NgramModel EnModel => _enModel ??= new NgramModel(_enWords);

    private NgramModel HeModel => _heModel ??= new NgramModel(_heWords);

    private static List<string> ReadLines(string resource)
    {
        using var reader = new StreamReader(LayoutMap.OpenResource(resource));
        var lines = new List<string>();
        for (string? line = reader.ReadLine(); line is not null; line = reader.ReadLine())
        {
            if (line.Length > 0) lines.Add(line);
        }
        return lines;
    }

    private static Dictionary<string, int> Index(IReadOnlyList<string> words)
    {
        var map = new Dictionary<string, int>(words.Count);
        for (int i = 0; i < words.Count; i++) map.TryAdd(words[i], i);
        return map;
    }

    private static double RankLimit(int len, int streak)
    {
        if (len <= 2) return streak > 0 ? Tuning.StreakRank2 : -1;
        if (len == 3) return Tuning.Rank3 * (streak > 0 ? Tuning.StreakRank3Factor : 1);
        if (len == 4) return Tuning.Rank4;
        return double.PositiveInfinity;
    }

    /// <summary>Dictionary lookup for English including simple inflections.</summary>
    private int? EnglishRank(string word)
    {
        if (_en.TryGetValue(word, out int exact)) return exact;
        foreach (string suffix in EnSuffixes)
        {
            if (word.Length > suffix.Length + 2 && word.EndsWith(suffix, StringComparison.Ordinal))
            {
                string stem = word[..^suffix.Length];
                if (_en.TryGetValue(stem, out int r) || _en.TryGetValue(stem + "e", out r)) return r;
            }
        }
        return null;
    }

    /// <summary>Dictionary lookup for Hebrew with up to three single-letter prefixes.</summary>
    private (int Rank, int Stripped)? HebrewRank(string word)
    {
        if (_he.TryGetValue(word, out int exact)) return (exact, 0);
        string w = word;
        for (int stripped = 1; stripped <= 3; stripped++)
        {
            if (w.Length < 4 || !HePrefixLetters.Contains(w[0])) break;
            w = w[1..];
            if (_he.TryGetValue(w, out int r) && w.Length >= 3) return (r, stripped);
        }
        return null;
    }

    private bool IsValidEnglish(string word, int streak)
    {
        int? r = EnglishRank(word);
        if (r is null) return false;
        return r.Value < RankLimit(word.Length, streak) || word.Length >= 5;
    }

    private bool IsValidHebrew(string word, int streak)
    {
        var h = HebrewRank(word);
        if (h is null) return false;
        int stem = word.Length - h.Value.Stripped;
        return h.Value.Rank < RankLimit(stem, streak) || stem >= 5;
    }

    private static bool ModelSaysFlip(double typedScore, double targetScore) =>
        targetScore - typedScore >= Tuning.ModelMargin
        && targetScore >= Tuning.ModelMinTarget
        && typedScore <= Tuning.ModelMaxTyped;

    private string? FixWord(string word, int streak, bool allowModel, bool sandwich)
    {
        if (word.Length < 2) return null;
        if (Forbidden.IsMatch(word)) return null;
        if (UpperCase.IsMatch(word)) return null; // names, acronyms, sentence starts, camelCase

        if (LatinWord.IsMatch(word) && HasLatin.IsMatch(word))
        {
            string he = LayoutMap.Convert(word, Direction.EnToHe);
            bool heOk = OnlyHebrew.IsMatch(he);
            int? er = EnglishRank(word);
            if (er is not null)
            {
                // Also a valid English word: flip only when the Hebrew reading is far more frequent.
                var hr = heOk ? HebrewRank(he) : null;
                bool clear = (word.Length >= 3 || streak > 0) && hr is not null
                    && er.Value >= Tuning.DualMinRank && hr.Value.Rank * Tuning.DualRatio < er.Value;
                bool between = sandwich && word.Length <= 3 && hr is not null && hr.Value.Rank < Tuning.SandwichRank;
                return (clear || between) && IsValidHebrew(he, Math.Max(streak, between ? 1 : 0)) ? he : null;
            }
            if (!heOk) return null;
            if (IsValidHebrew(he, streak)) return he;
            if (allowModel && he.Length >= Tuning.ModelMinLen && HebrewRank(he) is null
                && (word.Length > Tuning.ModelVowelMaxLen || Vowel.IsMatch(word)))
            {
                return ModelSaysFlip(EnModel.Score(word), HeModel.Score(he)) ? he : null;
            }
            return null;
        }

        if (HebrewWord.IsMatch(word) && LayoutMap.HasHebrew(word))
        {
            string en = LayoutMap.Convert(word, Direction.HeToEn);
            bool enOk = OnlyLatin.IsMatch(en);
            var hr = HebrewRank(word);
            if (hr is not null)
            {
                // Also a valid Hebrew word: flip only when the English reading is far more frequent.
                int? er = enOk ? EnglishRank(en) : null;
                bool clear = (word.Length >= 3 || streak > 0) && er is not null
                    && hr.Value.Rank >= Tuning.DualMinRank && er.Value * Tuning.DualRatio < hr.Value.Rank;
                bool between = sandwich && word.Length <= 3 && er is not null && er.Value < Tuning.SandwichRank;
                return (clear || between) && IsValidEnglish(en, Math.Max(streak, between ? 1 : 0)) ? en : null;
            }
            if (!enOk) return null;
            if (IsValidEnglish(en, streak)) return en;
            if (allowModel && en.Length >= Tuning.ModelMinLen && EnglishRank(en) is null)
            {
                return ModelSaysFlip(HeModel.Score(word), EnModel.Score(en)) ? en : null;
            }
            return null;
        }

        return null;
    }

    /// <summary>
    /// Examines a whitespace-free token that was just completed. <paramref name="streak"/> is the number of words just
    /// corrected in a row (wrong-layout typing tends to continue). <paramref name="sandwich"/> means the word sits between
    /// words that were just corrected, so a short word valid in both languages is flipped when the other reading is very common. Trailing sentence punctuation is tried both as
    /// punctuation and as layout-mapped letters (e.g. "," is the Hebrew ת key).
    /// </summary>
    public Fix? FixToken(string token, int streak = 0, bool sandwich = false)
    {
        int lead = 0;
        while (lead < token.Length && LeadingPunct.Contains(token[lead])) lead++;
        string body = token[lead..];
        if (body.Length == 0) return null;

        // Dictionary decisions first at every punctuation split, then (only if none matched) the statistical model.
        foreach (bool allowModel in new[] { false, true })
        {
            int end = body.Length;
            while (true)
            {
                string candidate = body[..end];
                string? fixedWord = FixWord(candidate, streak, allowModel, sandwich);
                if (fixedWord is not null) return new Fix(lead + end, token[..lead] + fixedWord);
                if (end <= 1 || !TrailingPunct.Contains(candidate[end - 1])) break;
                end--;
            }
        }
        return null;
    }
}
