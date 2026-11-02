using System.Text;
using System.Text.RegularExpressions;

namespace KeyFlip.Core;

public enum Direction
{
    EnToHe,
    HeToEn,
}

/// <summary>Hebrew/English helpers for manual conversion, on top of <see cref="Layouts"/>.</summary>
public static class LayoutMap
{
    private static readonly Regex Whitespace = new(@"(\s+)", RegexOptions.Compiled);

    internal static Stream OpenResource(string name) =>
        typeof(LayoutMap).Assembly.GetManifestResourceStream(name)
        ?? throw new InvalidOperationException($"Missing embedded resource '{name}'.");

    public static bool IsHebrewLetter(char c) => c >= 'א' && c <= 'ת';

    public static bool IsLatinLetter(char c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

    public static bool HasHebrew(string text) => text.Any(IsHebrewLetter);

    /// <summary>A letter of a non-Latin script KeyFlip supports (Hebrew, Cyrillic, Arabic).</summary>
    public static bool IsOtherLetter(char c) => IsHebrewLetter(c) || (c >= '\u0400' && c <= '\u04FF') || (c >= '\u0600' && c <= '\u06FF');

    /// <summary>Maps every character between the US and Hebrew layouts; unmapped characters are kept.</summary>
    public static string Convert(string text, Direction direction) =>
        direction == Direction.EnToHe ? Layouts.Us.ConvertTo(text, Layouts.Hebrew) : Layouts.Hebrew.ConvertTo(text, Layouts.Us);

    /// <summary>Majority direction by letters, or null when the text has no letters.</summary>
    public static Direction? DetectDirection(string text)
    {
        int he = 0, latin = 0;
        foreach (char ch in text)
        {
            if (IsOtherLetter(ch)) he++;
            else if (IsLatinLetter(ch)) latin++;
        }
        if (he == 0 && latin == 0) return null;
        return latin >= he ? Direction.EnToHe : Direction.HeToEn;
    }

    /// <summary>Each word is converted from its own script; neutral tokens follow the dominant direction.</summary>
    public static string ConvertAuto(string text)
    {
        Direction? dominant = DetectDirection(text);
        if (dominant is null) return text;
        var sb = new StringBuilder(text.Length);
        foreach (string token in Whitespace.Split(text))
        {
            if (token.Length == 0) continue;
            if (token.All(char.IsWhiteSpace))
            {
                sb.Append(token);
                continue;
            }
            sb.Append(Convert(token, DetectDirection(token) ?? dominant.Value));
        }
        return sb.ToString();
    }

    /// <summary>
    /// Start index of the trailing run of words (never crossing a newline) that share the script of the last word.
    /// </summary>
    public static int TrailingRunStart(string text)
    {
        int lineStart = text.LastIndexOf('\n') + 1;
        string line = text[lineStart..];
        Direction? target = null;
        int start = line.Length;
        MatchCollection tokens = Regex.Matches(line, @"\S+");
        for (int i = tokens.Count - 1; i >= 0; i--)
        {
            Match m = tokens[i];
            Direction? dir = DetectDirection(m.Value);
            if (dir is null) continue; // digits/punctuation-only tokens do not break the run
            target ??= dir;
            if (dir != target) break;
            start = m.Index;
        }
        return lineStart + start;
    }
}
