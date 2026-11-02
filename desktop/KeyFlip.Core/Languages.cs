using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>
/// A language the detector understands: its layout and the few morphology rules it uses.
/// Port of extension/src/languages.ts (see docs/MULTILANG_PLAN.md).
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
        Typed: new Regex(@"^[a-z';,./`\[\]]+$", Opts), // [ ] ; ' , . ` are letters on the Russian layout
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

    public static readonly LanguageSpec Russian = new(
        "ru", IsLatin: false, "ru",
        Word: new Regex("^[а-яё]+$", Opts),
        Typed: new Regex("^[а-яё]+$", Opts),
        Letter: new Regex("[а-яё]", Opts),
        Suffixes: Array.Empty<string>(), // the word list already holds inflected forms
        Prefixes: "",
        Vowels: null);

    // Letters ء..غ and ف..ي (no tatweel, no diacritics). أ إ آ are Shift keys on the Arabic layout.
    public static readonly LanguageSpec Arabic = new(
        "ar", IsLatin: false, "ar",
        Word: new Regex("^[\u0621-\u063A\u0641-\u064A]+$", Opts),
        Typed: new Regex("^[\u0621-\u063A\u0641-\u064A]+$", Opts),
        Letter: new Regex("[\u0621-\u063A\u0641-\u064A]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "",
        Vowels: null);

    /// <summary>All languages, in the order the detector considers them.</summary>
    public static readonly IReadOnlyList<LanguageSpec> All = new[] { English, Hebrew, Russian, Arabic };

    /// <summary>Languages that are always on; the others are optional.</summary>
    public static readonly IReadOnlyList<string> Always = new[] { "en", "he" };

    public static readonly IReadOnlyList<string> Optional = new[] { "ru", "ar" };
}
