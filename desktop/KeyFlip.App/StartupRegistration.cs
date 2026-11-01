#if PACKAGED
using Windows.ApplicationModel;
#else
using Microsoft.Win32;
#endif

namespace KeyFlip.App;

/// <summary>Result of a "start with Windows" change: the actual state plus an optional message for the user.</summary>
internal readonly record struct StartupResult(bool Enabled, string? Message = null);

/// <summary>
/// "Start with Windows". The unpackaged EXE uses the HKCU Run key. The MSIX (Microsoft Store) build uses the
/// <c>windows.startupTask</c> declared in AppxManifest.xml, because Run-key writes from a packaged app are
/// redirected to a private hive and would be ignored by Windows.
/// </summary>
internal static class StartupRegistration
{
#if PACKAGED
    /// <summary>Must match desktop:StartupTask/@TaskId in desktop/KeyFlip.Package/AppxManifest.xml.</summary>
    private const string TaskId = "KeyFlipStartup";

    public static async Task<bool> IsEnabledAsync()
    {
        try
        {
            StartupTask task = await StartupTask.GetAsync(TaskId);
            return task.State is StartupTaskState.Enabled or StartupTaskState.EnabledByPolicy;
        }
        catch (Exception)
        {
            return false; // not running from the package (e.g. a debug run of the packaged build)
        }
    }

    public static async Task<StartupResult> SetAsync(bool enable)
    {
        try
        {
            StartupTask task = await StartupTask.GetAsync(TaskId);
            if (!enable)
            {
                if (task.State == StartupTaskState.Enabled) task.Disable();
                return new StartupResult(task.State is StartupTaskState.Enabled or StartupTaskState.EnabledByPolicy);
            }

            StartupTaskState state = await task.RequestEnableAsync();
            return state switch
            {
                StartupTaskState.Enabled or StartupTaskState.EnabledByPolicy => new StartupResult(true),
                StartupTaskState.DisabledByUser => new StartupResult(false,
                    "ההפעלה עם Windows כובתה בהגדרות. כדי להפעיל: הגדרות Windows ← אפליקציות ← הפעלה (Startup) ← KeyFlip."),
                StartupTaskState.DisabledByPolicy => new StartupResult(false,
                    "מדיניות הארגון חוסמת הפעלה אוטומטית של אפליקציות."),
                _ => new StartupResult(false),
            };
        }
        catch (Exception)
        {
            return new StartupResult(false, "לא ניתן לשנות את ההפעלה עם Windows.");
        }
    }
#else
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "KeyFlip";

    public static Task<bool> IsEnabledAsync()
    {
        try
        {
            using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RunKeyPath);
            return Task.FromResult(key?.GetValue(RunValueName) is string);
        }
        catch (Exception)
        {
            return Task.FromResult(false);
        }
    }

    public static async Task<StartupResult> SetAsync(bool enable)
    {
        try
        {
            using RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
            if (enable) key.SetValue(RunValueName, $"\"{Environment.ProcessPath}\"");
            else key.DeleteValue(RunValueName, throwOnMissingValue: false);
        }
        catch (Exception)
        {
            // Policy may block writing to Run; the menu reflects the real state below.
        }
        return new StartupResult(await IsEnabledAsync());
    }
#endif
}
