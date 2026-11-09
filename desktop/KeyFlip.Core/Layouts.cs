using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace KeyFlip.Core;

/// <summary>
/// A keyboard layout as a map from physical key to the text it types. Keys are identified by the character they
/// produce on US QWERTY (uppercase = with Shift), so converting between any two layouts goes text -> key -> text.
/// A key may type more than one character (Arabic 'b' types لا), and a layout may have dead keys (Spanish ´ + a = á).
/// Port of extension/src/layouts.ts.
/// </summary>
public sealed class Layout
{
    /// <summary>Key ids that mean "with Shift": capital letters and the US Shift positions of the punctuation keys.</summary>
    private static readonly Regex ShiftKey = new(@"^[A-Z~!@#$%^&*()_+{}|:""<>?]$", RegexOptions.Compiled);

    private readonly Dictionary<string, string> _toChar;
    private readonly Dictionary<string, string> _toKey;
    private readonly Dictionary<string, Dictionary<string, string>> _dead;
    private readonly Dictionary<string, string> _decompose;

    private Layout(string id, string script, bool foldCase, Dictionary<string, string> toChar,
        Dictionary<string, Dictionary<string, string>> dead)
    {
        Id = id;
        Script = script;
        FoldCase = foldCase;
        _toChar = toChar;
        _toKey = new Dictionary<string, string>();
        foreach (var (key, output) in toChar) _toKey[output] = key;
        Multi = _toKey.Keys.Where(o => o.Length > 1)
            .OrderByDescending(o => o.Length).ToList();
        _dead = dead;
        _decompose = new Dictionary<string, string>();
        foreach (var (deadChar, table) in dead)
        {
            foreach (var (letter, composed) in table)
            {
                if (!_toKey.ContainsKey(composed)) _decompose.TryAdd(composed, deadChar + letter);
            }
        }
    }

    public string Id { get; }

    public string Script { get; }

    /// <summary>Latin layouts are matched case-insensitively ("AKUO" is the same keys as "akuo").</summary>
    public bool FoldCase { get; }

    /// <summary>Outputs longer than one character, longest first (e.g. لآ, لا).</summary>
    public IReadOnlyList<string> Multi { get; }

    /// <summary>Key ids that exist on this layout (e.g. "b", "H").</summary>
    public IEnumerable<string> Keys => _toChar.Keys;

    /// <summary>True when the layout has dead keys (French ^, Spanish ´).</summary>
    public bool HasDeadKeys => _dead.Count > 0;

    /// <summary>What a key types on this layout, if it is mapped.</summary>
    public string? Output(string key) => _toChar.GetValueOrDefault(key);

    internal static Layout Load(string id)
    {
        using Stream stream = LayoutMap.OpenResource($"layouts.{id}.json");
        using JsonDocument doc = JsonDocument.Parse(stream);
        JsonElement root = doc.RootElement;
        var toChar = new Dictionary<string, string>();
        foreach (JsonProperty key in root.GetProperty("keys").EnumerateObject()) toChar[key.Name] = key.Value.GetString()!;
        var dead = new Dictionary<string, Dictionary<string, string>>();
        if (root.TryGetProperty("dead", out JsonElement deadElement))
        {
            foreach (JsonProperty deadKey in deadElement.EnumerateObject())
            {
                var table = new Dictionary<string, string>();
                foreach (JsonProperty entry in deadKey.Value.EnumerateObject()) table[entry.Name] = entry.Value.GetString()!;
                dead[deadKey.Name] = table;
            }
        }
        return new Layout(root.GetProperty("id").GetString()!, root.GetProperty("script").GetString()!,
            root.GetProperty("foldCase").GetBoolean(), toChar, dead);
    }

    /// <summary>The text a key types here; a layout without a Shift entry types its lowercase entry.</summary>
    private string? TypeKey(string key) => _toChar.GetValueOrDefault(key) ?? _toChar.GetValueOrDefault(key.ToLowerInvariant());

    private string? KeyOf(string ch) =>
        _toKey.GetValueOrDefault(ch) ?? (FoldCase ? _toKey.GetValueOrDefault(ch.ToLowerInvariant()) : null);

    private string Single(string ch, Layout to)
    {
        string? key = KeyOf(ch);
        return key is null ? ch : to.TypeKey(key) ?? ch;
    }

    /// <summary>Letters typed with a dead key become dead key + letter, so that each maps to a physical key (á on Spanish = ´ a).</summary>
    private string DecomposeDead(string text)
    {
        if (_decompose.Count == 0) return text;
        var sb = new StringBuilder(text.Length + 4);
        foreach (char ch in text)
        {
            string s = ch.ToString();
            string? parts = _decompose.GetValueOrDefault(s) ?? (FoldCase ? _decompose.GetValueOrDefault(s.ToLowerInvariant()) : null);
            sb.Append(parts ?? s);
        }
        return sb.ToString();
    }

    /// <summary>A dead key followed by a letter it combines with becomes the composed letter (´ a -> á).</summary>
    private string ComposeDead(string text)
    {
        if (_dead.Count == 0) return text;
        var sb = new StringBuilder(text.Length);
        for (int i = 0; i < text.Length; i++)
        {
            string? composed = null;
            if (i + 1 < text.Length && _dead.TryGetValue(text[i].ToString(), out var table))
            {
                composed = table.GetValueOrDefault(text[i + 1].ToString());
            }
            if (composed is not null)
            {
                sb.Append(composed);
                i++;
            }
            else
            {
                sb.Append(text[i]);
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// Every way the text could have been typed here, re-typed on <paramref name="to"/> (at most <paramref name="limit"/>).
    /// Only layouts with multi-character keys are ambiguous: "لا" is the 'b' key or 'g' + 'h'. The first result uses the
    /// longest keys.
    /// </summary>
    public IReadOnlyList<string> ConvertVariants(string text, Layout to, int limit = 8)
    {
        text = DecomposeDead(text);
        var results = new List<string> { "" };
        int i = 0;
        while (i < text.Length)
        {
            string? multi = Multi.FirstOrDefault(m => string.CompareOrdinal(text, i, m, 0, m.Length) == 0);
            if (multi is not null)
            {
                string asOneKey = to.TypeKey(_toKey[multi]) ?? multi;
                var sb = new StringBuilder();
                foreach (char c in multi) sb.Append(Single(c.ToString(), to));
                string asSingles = sb.ToString();
                results = results
                    .SelectMany(r => asOneKey == asSingles ? new[] { r + asOneKey } : new[] { r + asOneKey, r + asSingles })
                    .Take(limit)
                    .ToList();
                i += multi.Length;
                continue;
            }
            string single = Single(text[i].ToString(), to);
            for (int r = 0; r < results.Count; r++) results[r] += single;
            i++;
        }
        return to.HasDeadKeys ? results.Select(to.ComposeDead).ToList() : results;
    }

    /// <summary>Re-types text on another layout. Characters without a key here (digits, spaces, emoji) are kept.</summary>
    public string ConvertTo(string text, Layout to)
    {
        if (Multi.Count > 0 || _decompose.Count > 0 || to.HasDeadKeys) return ConvertVariants(text, to, 1)[0];
        var sb = new StringBuilder(text.Length);
        foreach (char ch in text) sb.Append(Single(ch.ToString(), to));
        return sb.ToString();
    }

    /// <summary>The characters this layout types without Shift (what a token typed on it may contain), digits and spaces excluded.</summary>
    public IReadOnlyList<string> UnshiftedChars()
    {
        var set = new HashSet<string>();
        foreach (var (key, text) in _toChar)
        {
            if (ShiftKey.IsMatch(key)) continue;
            foreach (char ch in text)
            {
                if (!char.IsDigit(ch) && !char.IsWhiteSpace(ch)) set.Add(ch.ToString());
            }
        }
        foreach (string composed in _decompose.Keys) set.Add(composed);
        return set.ToList();
    }
}

/// <summary>The layouts shipped with KeyFlip.</summary>
public static class Layouts
{
    private static readonly Dictionary<string, Layout> Cache = new();

    /// <summary>The Latin layouts a user can type on: US QWERTY, French AZERTY, German QWERTZ, Spanish.</summary>
    public static readonly IReadOnlyList<string> LatinLayouts = new[] { "us", "fr", "de", "es" };

    public const string DefaultLatinLayout = "us";

    public static Layout Get(string id)
    {
        lock (Cache)
        {
            if (!Cache.TryGetValue(id, out Layout? layout)) Cache[id] = layout = Layout.Load(id);
            return layout;
        }
    }

    public static Layout Us => Get("us");

    public static Layout Hebrew => Get("he");
}
