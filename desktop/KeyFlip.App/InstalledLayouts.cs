namespace KeyFlip.App;

/// <summary>Which of KeyFlip's optional languages have a keyboard layout installed in Windows (read-only query).</summary>
internal static class InstalledLayouts
{
    /// <summary>Primary language id (low 10 bits of the layout's LANGID) to KeyFlip language id.</summary>
    private static readonly Dictionary<int, string> ByPrimaryLanguage = new()
    {
        [0x19] = "ru",
        [0x01] = "ar",
        [0x0c] = "fr",
        [0x07] = "de",
        [0x0a] = "es",
    };

    /// <summary>
    /// Full LANGID (low 16 bits of the HKL) of the Windows layouts that match the Latin layouts KeyFlip ships.
    /// Canadian French, Belgian, Swiss and Latin American keyboards differ, so they are not listed and keep US QWERTY.
    /// </summary>
    private static readonly Dictionary<int, string> LatinLayoutByLangId = new()
    {
        [0x040c] = "fr", // French (France) - AZERTY
        [0x0407] = "de", // German (Germany) - QWERTZ
        [0x0c07] = "de", // German (Austria)
        [0x040a] = "es", // Spanish (Spain, traditional sort)
        [0x0c0a] = "es", // Spanish (Spain, international sort)
    };

    private static IReadOnlyList<int> InstalledLangIds()
    {
        try
        {
            int count = NativeMethods.GetKeyboardLayoutList(0, null);
            if (count <= 0) return Array.Empty<int>();
            var layouts = new IntPtr[count];
            count = NativeMethods.GetKeyboardLayoutList(count, layouts);
            return layouts.Take(count).Select(hkl => (int)(hkl.ToInt64() & 0xFFFF)).ToList();
        }
        catch (Exception)
        {
            return Array.Empty<int>();
        }
    }

    public static IReadOnlyList<string> LanguageIds() => InstalledLangIds()
        .Select(langId => langId & 0x3FF)
        .Where(ByPrimaryLanguage.ContainsKey)
        .Select(primary => ByPrimaryLanguage[primary])
        .Distinct()
        .ToList();

    /// <summary>The Latin layout to assume: the one installed AZERTY/QWERTZ/Spanish layout, or US QWERTY when none or several.</summary>
    public static string LatinLayoutId()
    {
        List<string> latin = InstalledLangIds()
            .Where(LatinLayoutByLangId.ContainsKey)
            .Select(langId => LatinLayoutByLangId[langId])
            .Distinct()
            .ToList();
        return latin.Count == 1 ? latin[0] : KeyFlip.Core.Layouts.DefaultLatinLayout;
    }
}
