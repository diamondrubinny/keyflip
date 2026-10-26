namespace KeyFlip.Core;

/// <summary>
/// In-memory record of the characters typed on the current line (bounded, never persisted).
/// Reset on anything that moves the caret or changes context.
/// </summary>
public sealed class LineBuffer
{
    private readonly System.Text.StringBuilder _text = new();
    private readonly int _capacity;

    public LineBuffer(int capacity = 200) => _capacity = capacity;

    public string Text => _text.ToString();

    /// <summary>Characters after the last whitespace.</summary>
    public string CurrentWord
    {
        get
        {
            string s = Text;
            int i = s.Length;
            while (i > 0 && !char.IsWhiteSpace(s[i - 1])) i--;
            return s[i..];
        }
    }

    public void Append(char c)
    {
        _text.Append(c);
        if (_text.Length > _capacity) _text.Remove(0, _text.Length - _capacity);
    }

    public void Backspace()
    {
        if (_text.Length > 0) _text.Length--;
    }

    /// <summary>Replaces the last <paramref name="count"/> characters.</summary>
    public void ReplaceTail(int count, string replacement)
    {
        int n = Math.Min(count, _text.Length);
        _text.Length -= n;
        foreach (char c in replacement) Append(c);
    }

    public void Reset() => _text.Clear();
}
