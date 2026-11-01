using System.Runtime.InteropServices;

namespace KeyFlip.App;

/// <summary>Detects whether KeyFlip runs inside an MSIX package (Microsoft Store build).</summary>
internal static class PackageInfo
{
    private const int APPMODEL_ERROR_NO_PACKAGE = 15700;
    private const int ERROR_INSUFFICIENT_BUFFER = 122;

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetCurrentPackageFullName(ref int packageFullNameLength, char[]? packageFullName);

    private static readonly Lazy<bool> s_isPackaged = new(() =>
    {
        try
        {
            int length = 0;
            int result = GetCurrentPackageFullName(ref length, null);
            return result != APPMODEL_ERROR_NO_PACKAGE && (result == ERROR_INSUFFICIENT_BUFFER || result == 0);
        }
        catch (EntryPointNotFoundException)
        {
            return false; // Windows 7/8 – never packaged.
        }
    });

    /// <summary>True when running with package identity (installed from the Store / MSIX).</summary>
    public static bool IsPackaged => s_isPackaged.Value;
}
