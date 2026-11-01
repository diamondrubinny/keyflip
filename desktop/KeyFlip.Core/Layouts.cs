using System.Text;
using System.Text.Json;

namespace KeyFlip.Core;

/// <summary>
/// A keyboard layout as a map from physical key to character. Keys are identified by the character they produce on
/// US QWERTY, so converting between any two layouts goes character -> key -> character.
/// Port of extension/src/layouts.ts; the data comes from shared/layouts/*.json.
/// </summary>
public sealed class Layout
{
    private readonly Dictionary<char, char> _toChar;
    private readonly Dictionary<char, char> _toKey;

    private Layout(string id, string script, bool foldCase, Dictionary<char, char> toChar)
    {
        Id = id;
        Script = script;
        FoldCase = foldCase;
        _toChar = toChar;
        _toKey = new Dictionary<char, char>();
        foreach (var (key, ch) in toChar) _toKey[ch] = key;
    }

    public string Id { get; }

    public string Script { get; }

    /// <summary>Latin layouts are matched case-insensitively ("AKUO" is the same keys as "akuo").</summary>
    public bool FoldCase { get; }

    internal static Layout Load(string id)
    {
        using Stream stream = LayoutMap.OpenResource($"layouts.{id}.json");
        using JsonDocument doc = JsonDocument.Parse(stream);
        JsonElement root = doc.RootElement;
        var toChar = new Dictionary<char, char>();
        foreach (JsonProperty key in root.GetProperty("keys").EnumerateObject())
        {
            toChar[key.Name[0]] = key.Value.GetString()![0];
        }
        return new Layout(root.GetProperty("id").GetString()!, root.GetProperty("script").GetString()!,
            root.GetProperty("foldCase").GetBoolean(), toChar);
    }

    /// <summary>Re-types text on another layout. Characters without a key here (digits, spaces, emoji) are kept.</summary>
    public string ConvertTo(string text, Layout to)
    {
        var sb = new StringBuilder(text.Length);
        foreach (char ch in text)
        {
            char lookup = FoldCase ? char.ToLowerInvariant(ch) : ch;
            sb.Append(_toKey.TryGetValue(lookup, out char key) && to._toChar.TryGetValue(key, out char mapped) ? mapped : ch);
        }
        return sb.ToString();
    }
}

/// <summary>The layouts shipped with KeyFlip.</summary>
public static class Layouts
{
    private static readonly Dictionary<string, Layout> Cache = new();

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
