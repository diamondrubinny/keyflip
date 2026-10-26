using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>Result of an automatic correction: the first <see cref="Consumed"/> chars of the token become <see cref="Replacement"/>.</summary>
public sealed record Fix(int Consumed, string Replacement);

/// <summary>Decides whether a typed word was written in the wrong layout, using frequency word lists.</summary>
public sealed class Detector
{
    private const string HePrefixes = "והבלמשכ";
    private const string TrailingPunct = ".,;:!?'\"”’)]}/";
    private const string LeadingPunct = "\"(“‘{";
    private const int ShortLen = 3;
    private const int ShortRankLimit = 12000;

    private static readonly string[] EnSuffixes = { "'s", "s", "es", "ed", "d", "ing", "ly", "'ll", "'re", "'ve", "n't" };
    private static readonly Regex Forbidden = new(@"[0-9@\\]|://", RegexOptions.Compiled);
    private static readonly Regex UpperCase = new("[A-Z]", RegexOptions.Compiled);
    private static readonly Regex LatinWord = new(@"^[a-z';,./`]+$", RegexOptions.Compiled);
    private static readonly Regex HasLatin = new("[a-z]", RegexOptions.Compiled);
    private static readonly Regex OnlyHebrew = new("^[א-ת]+$", RegexOptions.Compiled);
    private static readonly Regex HebrewWord = new("^[א-ת,.;'/]+$", RegexOptions.Compiled);
    private static readonly Regex OnlyLatin = new("^[a-z]+$", RegexOptions.Compiled);

    private readonly Dictionary<string, int> _en;
    private readonly Dictionary<string, int> _he;

    public Detector(IReadOnlyList<string> english, IReadOnlyList<string> hebrew)
    {
        _en = Index(english);
        _he = Index(hebrew);
    }

    /// <summary>Builds a detector from the word lists embedded in the assembly.</summary>
    public static Detector CreateDefault() => new(ReadLines("en.txt"), ReadLines("he.txt"));

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

    private bool IsEnglish(string word)
    {
        if (_en.ContainsKey(word)) return true;
        foreach (string suffix in EnSuffixes)
        {
            if (word.Length > suffix.Length + 2 && word.EndsWith(suffix, StringComparison.Ordinal))
            {
                string stem = word[..^suffix.Length];
                if (_en.ContainsKey(stem) || _en.ContainsKey(stem + "e")) return true;
            }
        }
        return false;
    }

    private bool IsEnglishStrict(string word)
    {
        if (_en.TryGetValue(word, out int rank)) return !(word.Length <= ShortLen && rank > ShortRankLimit);
        return IsEnglish(word);
    }

    private bool CheckHebrew(string word, bool strict)
    {
        if (!_he.TryGetValue(word, out int rank)) return false;
        return !(strict && word.Length <= ShortLen && rank > ShortRankLimit);
    }

    private bool IsHebrew(string word, bool strict)
    {
        if (CheckHebrew(word, strict)) return true;
        // Single-letter prefixes are not in the base list.
        if (word.Length >= 4 && HePrefixes.Contains(word[0]) && CheckHebrew(word[1..], strict)) return true;
        if (word.Length >= 5 && word[0] == 'ו' && HePrefixes.Contains(word[1]) && CheckHebrew(word[2..], strict)) return true;
        return false;
    }

    private string? FixWord(string word)
    {
        if (word.Length < 3) return null;
        if (Forbidden.IsMatch(word)) return null;
        if (UpperCase.IsMatch(word)) return null; // names, acronyms, sentence starts, camelCase

        if (LatinWord.IsMatch(word) && HasLatin.IsMatch(word))
        {
            if (IsEnglish(word)) return null;
            string he = LayoutMap.Convert(word, Direction.EnToHe);
            if (!OnlyHebrew.IsMatch(he)) return null;
            return IsHebrew(he, strict: true) ? he : null;
        }

        if (HebrewWord.IsMatch(word) && LayoutMap.HasHebrew(word))
        {
            if (IsHebrew(word, strict: false)) return null;
            string en = LayoutMap.Convert(word, Direction.HeToEn);
            if (!OnlyLatin.IsMatch(en)) return null;
            return IsEnglishStrict(en) ? en : null;
        }

        return null;
    }

    /// <summary>
    /// Examines a whitespace-free token that was just completed. Trailing sentence punctuation is tried
    /// both as punctuation and as layout-mapped letters (e.g. "," is the Hebrew ת key).
    /// </summary>
    public Fix? FixToken(string token)
    {
        int lead = 0;
        while (lead < token.Length && LeadingPunct.Contains(token[lead])) lead++;
        string body = token[lead..];
        if (body.Length == 0) return null;

        int end = body.Length;
        while (true)
        {
            string candidate = body[..end];
            string? fixedWord = FixWord(candidate);
            if (fixedWord is not null) return new Fix(lead + end, token[..lead] + fixedWord);
            if (end <= 1 || !TrailingPunct.Contains(candidate[end - 1])) return null;
            end--;
        }
    }
}
