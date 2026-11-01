namespace KeyFlip.App;

/// <summary>Which of KeyFlip's optional languages have a keyboard layout installed in Windows (read-only query).</summary>
internal static class InstalledLayouts
{
    /// <summary>Primary language id (low 10 bits of the layout's LANGID) to KeyFlip language id.</summary>
    private static readonly Dictionary<int, string> ByPrimaryLanguage = new()
    {
        [0x19] = "ru",
        [0x01] = "ar",
    };

    public static IReadOnlyList<string> LanguageIds()
    {
        try
        {
            int count = NativeMethods.GetKeyboardLayoutList(0, null);
            if (count <= 0) return Array.Empty<string>();
            var layouts = new IntPtr[count];
            count = NativeMethods.GetKeyboardLayoutList(count, layouts);
            return layouts.Take(count)
                .Select(hkl => (int)(hkl.ToInt64() & 0x3FF))
                .Where(ByPrimaryLanguage.ContainsKey)
                .Select(primary => ByPrimaryLanguage[primary])
                .Distinct()
                .ToList();
        }
        catch (Exception)
        {
            return Array.Empty<string>();
        }
    }
}
