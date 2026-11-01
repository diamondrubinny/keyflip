using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>
/// A language the detector understands: its layout and the few morphology rules it uses.
/// Port of extension/src/languages.ts (phase 1 of docs/MULTILANG_PLAN.md: English and Hebrew).
/// </summary>
public sealed record LanguageSpec(
    string Id,
    bool IsLatin,
    string Layout,
    Regex Word,
    Regex Typed,
    Regex Letter,
    IReadOnlyList<string> Suffixes,
    string Prefixes,
    Regex? Vowels);

public static class Languages
{
    private const RegexOptions Opts = RegexOptions.Compiled | RegexOptions.CultureInvariant;

    public static readonly LanguageSpec English = new(
        "en", IsLatin: true, "us",
        Word: new Regex("^[a-z]+$", Opts),
        Typed: new Regex(@"^[a-z';,./`]+$", Opts),
        Letter: new Regex("[a-z]", Opts),
        Suffixes: new[] { "'s", "s", "es", "ed", "d", "ing", "ly", "'ll", "'re", "'ve", "n't", "er", "est", "ies" },
        Prefixes: "",
        Vowels: new Regex("[aeiouy]", Opts));

    public static readonly LanguageSpec Hebrew = new(
        "he", IsLatin: false, "he",
        Word: new Regex("^[א-ת]+$", Opts),
        Typed: new Regex("^[א-ת,.;'/]+$", Opts),
        Letter: new Regex("[א-ת]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "והבלמשכ",
        Vowels: null);

    /// <summary>All languages, in the order the detector considers them.</summary>
    public static readonly IReadOnlyList<LanguageSpec> All = new[] { English, Hebrew };
}
