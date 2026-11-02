using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>Result of an automatic correction: the first <see cref="Consumed"/> chars of the token become <see cref="Replacement"/>.</summary>
public sealed record Fix(int Consumed, string Replacement);

/// <summary>
/// Decides whether a typed word was written in the wrong layout, using frequency word lists and a character n-gram
/// model per language. Port of extension/src/detect.ts; thresholds in <see cref="Tuning"/> come from scripts/eval.ts.
/// Every correction pairs a Latin language with a language in another script.
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
        public const double ModelTieMargin = 0.5;
    }

    private const string TrailingPunct = ".,;:!?'\"”’)]}/";
    private const string LeadingPunct = "\"(“‘{";

    private static readonly Regex Forbidden = new(@"[0-9@\\]|://", RegexOptions.Compiled);
    private static readonly Regex UpperCase = new(@"\p{Lu}", RegexOptions.Compiled);

    private sealed class Lang
    {
        public required LanguageSpec Spec { get; init; }
        public required Layout Layout { get; init; }
        public required IReadOnlyList<string> Words { get; init; }
        public required Dictionary<string, int> Ranks { get; init; }
        public NgramModel? Model { get; set; }
    }

    private readonly record struct Hit(int Rank, int Stripped);

    /// <summary>A possible correction into one target language: a dictionary rank, or a model margin.</summary>
    private sealed record Candidate(string Text, int? Rank, double Margin);

    private sealed record Source(IReadOnlyList<Lang> Langs, Layout Layout, bool IsLatin);

    private readonly List<Lang> _langs;

    /// <summary>Word lists (most frequent first) keyed by language id; languages without a list are disabled.</summary>
    public Detector(IReadOnlyDictionary<string, IReadOnlyList<string>> wordLists)
    {
        _langs = Languages.All
            .Where(spec => wordLists.ContainsKey(spec.Id))
            .Select(spec => new Lang
            {
                Spec = spec,
                Layout = Layouts.Get(spec.Layout),
                Words = wordLists[spec.Id],
                Ranks = Index(wordLists[spec.Id]),
            })
            .ToList();
    }

    public Detector(IReadOnlyList<string> english, IReadOnlyList<string> hebrew)
        : this(new Dictionary<string, IReadOnlyList<string>> { ["en"] = english, ["he"] = hebrew })
    {
    }

    /// <summary>Builds a detector for English and Hebrew from the word lists embedded in the assembly.</summary>
    public static Detector CreateDefault() => Create(Languages.Always);

    /// <summary>Builds a detector for the given language ids (unknown ids are ignored) from the embedded word lists.</summary>
    public static Detector Create(IEnumerable<string> languageIds)
    {
        var lists = new Dictionary<string, IReadOnlyList<string>>();
        foreach (string id in languageIds.Distinct())
        {
            if (Languages.All.Any(l => l.Id == id)) lists[id] = ReadLines($"{id}.txt");
        }
        return new Detector(lists);
    }

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

    // The statistical models are only needed for words missing from the dictionaries, so they are built lazily.
    private static NgramModel ModelOf(Lang lang) => lang.Model ??= new NgramModel(lang.Words);

    private static double RankLimit(int len, int streak)
    {
        if (len <= 2) return streak > 0 ? Tuning.StreakRank2 : -1;
        if (len == 3) return Tuning.Rank3 * (streak > 0 ? Tuning.StreakRank3Factor : 1);
        if (len == 4) return Tuning.Rank4;
        return double.PositiveInfinity;
    }

    /// <summary>Dictionary lookup with the language's inflection suffixes and stacked one-letter prefixes.</summary>
    private static Hit? Lookup(Lang lang, string word)
    {
        if (lang.Ranks.TryGetValue(word, out int exact)) return new Hit(exact, 0);
        foreach (string suffix in lang.Spec.Suffixes)
        {
            if (word.Length > suffix.Length + 2 && word.EndsWith(suffix, StringComparison.Ordinal))
            {
                string stem = word[..^suffix.Length];
                if (lang.Ranks.TryGetValue(stem, out int r) || lang.Ranks.TryGetValue(stem + "e", out r)) return new Hit(r, 0);
            }
        }
        string w = word;
        for (int stripped = 1; stripped <= 3 && lang.Spec.Prefixes.Length > 0; stripped++)
        {
            if (w.Length < 4 || !lang.Spec.Prefixes.Contains(w[0])) break;
            w = w[1..];
            if (lang.Ranks.TryGetValue(w, out int r) && w.Length >= 3) return new Hit(r, stripped);
        }
        return null;
    }

    /// <summary>Best (most frequent) reading of a word among several languages.</summary>
    private static Hit? BestLookup(IEnumerable<Lang> langs, string word)
    {
        Hit? best = null;
        foreach (Lang lang in langs)
        {
            Hit? hit = Lookup(lang, word);
            if (hit is not null && (best is null || hit.Value.Rank < best.Value.Rank)) best = hit;
        }
        return best;
    }

    private static bool IsValid(Lang lang, string word, int streak)
    {
        Hit? h = Lookup(lang, word);
        if (h is null) return false;
        int stem = word.Length - h.Value.Stripped;
        return h.Value.Rank < RankLimit(stem, streak) || stem >= 5;
    }

    private static bool ModelSaysFlip(double typedScore, double targetScore) =>
        targetScore - typedScore >= Tuning.ModelMargin
        && targetScore >= Tuning.ModelMinTarget
        && typedScore <= Tuning.ModelMaxTyped;

    /// <summary>The script (and so the layout) the token was typed in, or null if it is not a word of any enabled language.</summary>
    private Source? SourceOf(string word)
    {
        List<Lang> latin = _langs.Where(l => l.Spec.IsLatin).ToList();
        if (latin.Any(l => l.Spec.Typed.IsMatch(word) && l.Spec.Letter.IsMatch(word)))
        {
            return new Source(latin, latin[0].Layout, IsLatin: true);
        }
        foreach (Lang lang in _langs)
        {
            if (!lang.Spec.IsLatin && lang.Spec.Typed.IsMatch(word) && lang.Spec.Letter.IsMatch(word))
            {
                return new Source(new[] { lang }, lang.Layout, IsLatin: false);
            }
        }
        return null;
    }

    private double TypedScore(Source source, string word) => source.Langs.Max(l => ModelOf(l).Score(word));

    private string? FixWord(string word, int streak, bool allowModel, bool sandwich)
    {
        if (word.Length < 2) return null;
        if (Forbidden.IsMatch(word)) return null;
        if (UpperCase.IsMatch(word)) return null; // names, acronyms, sentence starts, camelCase (any script)

        Source? source = SourceOf(word);
        if (source is null) return null;
        Hit? typedHit = BestLookup(source.Langs, word);

        var candidates = new List<Candidate>();
        foreach (Lang target in _langs.Where(l => l.Spec.IsLatin != source.IsLatin))
        {
            Candidate? c = CandidateFor(source, target, word, typedHit, streak, allowModel, sandwich);
            if (c is not null) candidates.Add(c);
        }
        return Choose(candidates);
    }

    /// <summary>The correction into one target language, if the rules allow it.</summary>
    private Candidate? CandidateFor(Source source, Lang target, string word, Hit? typedHit, int streak, bool allowModel, bool sandwich)
    {
        string converted = source.Layout.ConvertTo(word, target.Layout);
        bool ok = target.Spec.Word.IsMatch(converted);

        if (typedHit is not null)
        {
            // Also a valid word as typed: flip only when the other reading is far more frequent,
            // or when a short word sits between two corrected words.
            Hit? hit = ok ? Lookup(target, converted) : null;
            bool clear = (word.Length >= 3 || streak > 0) && hit is not null
                && typedHit.Value.Rank >= Tuning.DualMinRank && hit.Value.Rank * Tuning.DualRatio < typedHit.Value.Rank;
            bool between = sandwich && word.Length <= 3 && hit is not null && hit.Value.Rank < Tuning.SandwichRank;
            return (clear || between) && IsValid(target, converted, Math.Max(streak, between ? 1 : 0))
                ? new Candidate(converted, hit!.Value.Rank, 0)
                : null;
        }

        if (!ok) return null;
        if (IsValid(target, converted, streak)) return new Candidate(converted, Lookup(target, converted)!.Value.Rank, 0);
        bool abbreviation = source.IsLatin && word.Length <= Tuning.ModelVowelMaxLen
            && !source.Langs.Any(l => l.Spec.Vowels?.IsMatch(word) == true);
        if (allowModel && converted.Length >= Tuning.ModelMinLen && Lookup(target, converted) is null && !abbreviation)
        {
            double typed = TypedScore(source, word);
            double score = ModelOf(target).Score(converted);
            if (ModelSaysFlip(typed, score)) return new Candidate(converted, null, score - typed);
        }
        return null;
    }

    /// <summary>
    /// Picks among corrections into different target languages (e.g. Latin letters that could be Hebrew or Russian).
    /// Dictionary readings beat model-only ones; a reading must clearly beat the runner-up, otherwise nothing is changed.
    /// </summary>
    private static string? Choose(List<Candidate> candidates)
    {
        if (candidates.Count <= 1) return candidates.Count == 1 ? candidates[0].Text : null;
        List<Candidate> dict = candidates.Where(c => c.Rank is not null).OrderBy(c => c.Rank).ToList();
        if (dict.Count == 1) return dict[0].Text;
        if (dict.Count > 1) return dict[0].Rank!.Value * Tuning.DualRatio < dict[1].Rank!.Value ? dict[0].Text : null;
        List<Candidate> model = candidates.OrderByDescending(c => c.Margin).ToList();
        return model[0].Margin - model[1].Margin >= Tuning.ModelTieMargin ? model[0].Text : null;
    }

    /// <summary>
    /// Manual conversion: the language a run of Latin words was meant to be in (e.g. Hebrew or Russian), by how many
    /// converted words are in each dictionary; the models only break a tie. Null when no other language is enabled.
    /// </summary>
    public (string Id, Layout Layout)? PickTarget(IReadOnlyList<string> latinWords)
    {
        Lang? latin = _langs.FirstOrDefault(l => l.Spec.IsLatin);
        List<Lang> targets = _langs.Where(l => !l.Spec.IsLatin).ToList();
        if (latin is null || targets.Count == 0) return null;
        if (targets.Count == 1) return (targets[0].Spec.Id, targets[0].Layout);
        List<string> Converted(Lang lang) => latinWords
            .Select(w => latin.Layout.ConvertTo(w.ToLowerInvariant(), lang.Layout))
            .Where(w => lang.Spec.Word.IsMatch(w))
            .ToList();
        var ranked = targets
            .Select(lang => (Lang: lang, Hits: Converted(lang).Count(w => Lookup(lang, w) is not null)))
            .OrderByDescending(r => r.Hits)
            .ToList();
        Lang best = ranked[0].Lang;
        var tied = ranked.Where(r => r.Hits == ranked[0].Hits).ToList();
        if (tied.Count > 1)
        {
            // Only when the dictionaries cannot decide: which reading looks more like real words.
            best = tied.OrderByDescending(r => Converted(r.Lang).Sum(w => ModelOf(r.Lang).Score(w))).First().Lang;
        }
        return (best.Spec.Id, best.Layout);
    }

    /// <summary>The enabled non-Latin language whose script a token is written in, or null.</summary>
    public (string Id, Layout Layout)? OtherLanguageOf(string token)
    {
        Lang? lang = _langs.FirstOrDefault(l => !l.Spec.IsLatin && l.Spec.Letter.IsMatch(token));
        return lang is null ? null : (lang.Spec.Id, lang.Layout);
    }

    /// <summary>
    /// Examines a whitespace-free token that was just completed. <paramref name="streak"/> is the number of words just
    /// corrected in a row (wrong-layout typing tends to continue). <paramref name="sandwich"/> means the word sits between
    /// words that were just corrected, so a short word valid in both languages is flipped when the other reading is very common.
    /// Trailing sentence punctuation is tried both as punctuation and as layout-mapped letters (e.g. "," is the Hebrew ת key).
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
