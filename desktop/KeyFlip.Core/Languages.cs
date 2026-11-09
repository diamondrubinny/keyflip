using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>
/// A language the detector understands: its layout and the few morphology rules it uses.
/// Port of extension/src/languages.ts (see docs/MULTILANG_PLAN.md). Latin languages (English, French, German,
/// Spanish) share the user's Latin layout; <see cref="Layout"/> is null for them. Which characters a token typed on a
/// layout may contain is derived from the layout by the detector.
/// </summary>
public sealed record LanguageSpec(
    string Id,
    bool IsLatin,
    string? Layout,
    Regex Word,
    Regex Letter,
    IReadOnlyList<string> Suffixes,
    string Prefixes,
    Regex? Vowels,
    string SingleLetters = "",
    IReadOnlyList<string>? Elisions = null);

public static class Languages
{
    private const RegexOptions Opts = RegexOptions.Compiled | RegexOptions.CultureInvariant;

    /// <summary>A Latin letter, including the accented letters of French, German and Spanish.</summary>
    public static readonly Regex LatinLetter = new(@"[a-zA-ZÀ-ÖØ-öø-ɏ]", Opts);

    private const string Fr = "a-zàâäæçéèêëîïôöœùûüÿ";
    private const string De = "a-zäöüß";
    private const string Es = "a-záéíóúüñ";

    public static readonly LanguageSpec English = new(
        "en", IsLatin: true, Layout: null,
        Word: new Regex("^[a-z]+$", Opts),
        Letter: new Regex("[a-z]", Opts),
        Suffixes: new[] { "'s", "s", "es", "ed", "d", "ing", "ly", "'ll", "'re", "'ve", "n't", "er", "est", "ies" },
        Prefixes: "",
        Vowels: new Regex("[aeiouy]", Opts),
        SingleLetters: "a");

    public static readonly LanguageSpec Hebrew = new(
        "he", IsLatin: false, "he",
        Word: new Regex("^[א-ת]+$", Opts),
        Letter: new Regex("[א-ת]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "והבלמשכ",
        Vowels: null);

    public static readonly LanguageSpec Russian = new(
        "ru", IsLatin: false, "ru",
        Word: new Regex("^[а-яё]+$", Opts),
        Letter: new Regex("[а-яё]", Opts),
        Suffixes: Array.Empty<string>(), // the word list already holds inflected forms
        Prefixes: "",
        Vowels: null,
        SingleLetters: "вускиаоя");

    // Letters ء..غ and ف..ي (no tatweel, no diacritics). أ إ آ are Shift keys on the Arabic layout.
    public static readonly LanguageSpec Arabic = new(
        "ar", IsLatin: false, "ar",
        Word: new Regex("^[ء-غف-ي]+$", Opts),
        Letter: new Regex("[ء-غف-ي]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "",
        Vowels: null);

    // One apostrophe inside a word: c'est, l'école, aujourd'hui.
    public static readonly LanguageSpec French = new(
        "fr", IsLatin: true, Layout: null,
        Word: new Regex($"^(?:[{Fr}]+')?[{Fr}]+$", Opts),
        Letter: new Regex($"[{Fr}]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "",
        Vowels: new Regex("[aeiouyàâäéèêëîïôöùûüÿœæ]", Opts),
        SingleLetters: "ay",
        Elisions: new[] { "c'", "d'", "j'", "l'", "m'", "n'", "s'", "t'", "qu'" });

    public static readonly LanguageSpec German = new(
        "de", IsLatin: true, Layout: null,
        Word: new Regex($"^[{De}]+$", Opts),
        Letter: new Regex($"[{De}]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "",
        Vowels: new Regex("[aeiouyäöü]", Opts));

    public static readonly LanguageSpec Spanish = new(
        "es", IsLatin: true, Layout: null,
        Word: new Regex($"^[{Es}]+$", Opts),
        Letter: new Regex($"[{Es}]", Opts),
        Suffixes: Array.Empty<string>(),
        Prefixes: "",
        Vowels: new Regex("[aeiouáéíóúü]", Opts),
        SingleLetters: "ayoeu");

    /// <summary>All languages, in the order the detector considers them (same order as the extension).</summary>
    public static readonly IReadOnlyList<LanguageSpec> All = new[] { English, Hebrew, Russian, Arabic, French, German, Spanish };

    /// <summary>Languages that are always on; the others are optional.</summary>
    public static readonly IReadOnlyList<string> Always = new[] { "en", "he" };

    public static readonly IReadOnlyList<string> Optional = new[] { "ru", "ar", "fr", "de", "es" };
}
