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

    /// <summary>Primary language id of each KeyFlip layout, for finding the matching Windows keyboard.</summary>
    private static readonly Dictionary<string, int> PrimaryLanguageOfLayout = new()
    {
        ["he"] = 0x0d,
        ["ru"] = 0x19,
        ["ar"] = 0x01,
        ["us"] = 0x09,
        ["fr"] = 0x0c,
        ["de"] = 0x07,
        ["es"] = 0x0a,
    };

    private static IReadOnlyList<IntPtr> InstalledHandles()
    {
        try
        {
            int count = NativeMethods.GetKeyboardLayoutList(0, null);
            if (count <= 0) return Array.Empty<IntPtr>();
            var layouts = new IntPtr[count];
            count = NativeMethods.GetKeyboardLayoutList(count, layouts);
            return layouts.Take(count).ToList();
        }
        catch (Exception)
        {
            return Array.Empty<IntPtr>();
        }
    }

    private static IReadOnlyList<int> InstalledLangIds() => InstalledHandles().Select(hkl => (int)(hkl.ToInt64() & 0xFFFF)).ToList();

    /// <summary>
    /// The installed Windows keyboard (HKL) that matches a KeyFlip layout id, or zero when none is installed. For the
    /// Latin layouts the exact variant is preferred (French (France) for "fr"), then any keyboard of that language.
    /// </summary>
    public static IntPtr HandleFor(string layoutId)
    {
        if (!PrimaryLanguageOfLayout.TryGetValue(layoutId, out int primary)) return IntPtr.Zero;
        IReadOnlyList<IntPtr> handles = InstalledHandles();
        IntPtr exact = handles.FirstOrDefault(hkl =>
            LatinLayoutByLangId.TryGetValue((int)(hkl.ToInt64() & 0xFFFF), out string? id) && id == layoutId);
        if (exact != IntPtr.Zero) return exact;
        return handles.FirstOrDefault(hkl => (hkl.ToInt64() & 0x3FF) == primary);
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
