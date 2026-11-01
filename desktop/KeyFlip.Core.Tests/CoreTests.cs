using System.Text.Json;
using KeyFlip.Core;
using Xunit;

namespace KeyFlip.Core.Tests;

public class CoreTests
{
    private static readonly Lazy<Detector> SharedDetector = new(Detector.CreateDefault);

    private static JsonElement Cases(string section)
    {
        string path = Path.Combine(AppContext.BaseDirectory, "test-cases.json");
        using JsonDocument doc = JsonDocument.Parse(File.ReadAllText(path));
        return doc.RootElement.GetProperty(section).Clone();
    }

    [Fact]
    public void Convert_SharedCases()
    {
        foreach (JsonElement c in Cases("convert").EnumerateArray())
        {
            var dir = c.GetProperty("dir").GetString() == "en-to-he" ? Direction.EnToHe : Direction.HeToEn;
            string input = c.GetProperty("input").GetString()!;
            Assert.Equal(c.GetProperty("expected").GetString(), LayoutMap.Convert(input, dir));
        }
    }

    [Fact]
    public void ConvertAuto_SharedCases()
    {
        foreach (JsonElement c in Cases("convertAuto").EnumerateArray())
        {
            Assert.Equal(c.GetProperty("expected").GetString(), LayoutMap.ConvertAuto(c.GetProperty("input").GetString()!));
        }
    }

    [Fact]
    public void TrailingRunStart_SharedCases()
    {
        foreach (JsonElement c in Cases("trailingRunStart").EnumerateArray())
        {
            Assert.Equal(c.GetProperty("expected").GetInt32(), LayoutMap.TrailingRunStart(c.GetProperty("text").GetString()!));
        }
    }

    [Fact]
    public void Detector_SharedCases()
    {
        foreach (JsonElement c in Cases("detect").EnumerateArray())
        {
            string token = c.GetProperty("token").GetString()!;
            JsonElement expected = c.GetProperty("fix");
            int streak = c.TryGetProperty("streak", out JsonElement st) ? st.GetInt32() : 0;
            bool sandwich = c.TryGetProperty("sandwich", out JsonElement sw) && sw.GetBoolean();
            Fix? actual = SharedDetector.Value.FixToken(token, streak, sandwich);
            if (expected.ValueKind == JsonValueKind.Null)
            {
                Assert.True(actual is null, $"'{token}' (streak {streak}) should be left alone but became '{actual?.Replacement}'");
            }
            else
            {
                Assert.NotNull(actual);
                Assert.Equal(expected.GetProperty("consumed").GetInt32(), actual!.Consumed);
                Assert.Equal(expected.GetProperty("replacement").GetString(), actual.Replacement);
            }
        }
    }

    [Fact]
    public void RoundTrip_MappedCharacters()
    {
        const string s = "qwertyuiopasdfghjkl;'zxcvbnm,./`";
        Assert.Equal(s, LayoutMap.Convert(LayoutMap.Convert(s, Direction.EnToHe), Direction.HeToEn));
    }

    [Fact]
    public void LineBuffer_TracksWordsAndBackspace()
    {
        var b = new LineBuffer(8);
        foreach (char c in "ab cd") b.Append(c);
        Assert.Equal("cd", b.CurrentWord);
        b.Backspace();
        Assert.Equal("c", b.CurrentWord);
        b.ReplaceTail(1, "xyz");
        Assert.Equal("ab xyz", b.Text);
        foreach (char c in "123456789") b.Append(c);
        Assert.Equal(8, b.Text.Length); // bounded
        b.Reset();
        Assert.Equal("", b.Text);
    }

    [Fact]
    public void PreviousShortTokens_FindsAdjacentShortWords()
    {
        var found = LineBuffer.PreviousShortTokens("kt zv tck ", 6);
        Assert.Equal(new[] { (3, "zv"), (0, "kt") }, found.ToArray());
        Assert.Empty(LineBuffer.PreviousShortTokens("hello tck ", 6)); // longer than 4 chars
        Assert.Empty(LineBuffer.PreviousShortTokens("kt  tck ", 4));   // double space breaks adjacency
    }

    [Fact]
    public void NgramModel_PrefersRealWordsOverRandomStrings()
    {
        var words = File.ReadAllLines(Path.Combine(AppContext.BaseDirectory, "en.txt")).Where(w => w.Length > 0).ToList();
        var model = new NgramModel(words);
        Assert.True(model.Score("information") > model.Score("xqzvkpw"));
    }
}
