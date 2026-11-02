using System.Text;
using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>
/// Manual conversion (Ctrl+Alt+Space) for any set of enabled languages. Port of extension/src/manual.ts.
/// Each word is converted from its own script (by majority of letters): Latin words onto the layout of the language
/// they read best in, other words onto the Latin layout; tokens with no letters follow the dominant side of the text.
/// With only English and Hebrew enabled this equals <see cref="LayoutMap.ConvertAuto"/>.
/// </summary>
public static class ManualConverter
{
    private static readonly Regex Whitespace = new(@"(\s+)", RegexOptions.Compiled);

    private static bool IsLatin(char c) => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');

    private readonly record struct Counts(int Latin, int Other, Layout? Layout);

    private static Counts Count(string text, Detector detector)
    {
        int latin = 0, other = 0;
        Layout? layout = null;
        foreach (char ch in text)
        {
            if (IsLatin(ch))
            {
                latin++;
                continue;
            }
            var lang = detector.OtherLanguageOf(ch.ToString());
            if (lang is not null)
            {
                other++;
                layout ??= lang.Value.Layout;
            }
        }
        return new Counts(latin, other, layout);
    }

    public static string Convert(string text, Detector detector)
    {
        Counts all = Count(text, detector);
        if (all.Latin == 0 && all.Other == 0) return text;
        string[] tokens = Whitespace.Split(text);
        var target = all.Latin > 0 ? detector.PickTarget(tokens.Where(t => t.Any(IsLatin)).ToList()) : null;
        string ToOther(string t) => target is null ? t : Layouts.Us.ConvertTo(t, target.Value.Layout);
        static string ToLatin(string t, Layout? from) => from is null ? t : from.ConvertTo(t, Layouts.Us);

        var sb = new StringBuilder(text.Length);
        foreach (string token in tokens)
        {
            if (token.Length == 0) continue;
            if (token.All(char.IsWhiteSpace))
            {
                sb.Append(token);
                continue;
            }
            Counts c = Count(token, detector);
            if (c.Latin == 0 && c.Other == 0) sb.Append(all.Latin >= all.Other ? ToOther(token) : ToLatin(token, all.Layout));
            else sb.Append(c.Latin >= c.Other ? ToOther(token) : ToLatin(token, c.Layout));
        }
        return sb.ToString();
    }
}
