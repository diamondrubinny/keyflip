using System.Text.Json;

namespace KeyFlip.App;

/// <summary>User settings stored in %APPDATA%\KeyFlip\settings.json. Contains no typed text.</summary>
internal sealed class AppSettings
{
    /// <summary>Browsers are handled by the Chrome extension; the rest hold secrets or are terminals.</summary>
    public static readonly string[] DefaultIgnoredProcesses =
    {
        "chrome", "msedge", "firefox", "brave", "opera", "vivaldi",
        "keepass", "keepassxc", "1password", "bitwarden", "lastpass", "dashlane",
        "windowsterminal", "cmd", "powershell", "pwsh", "conhost", "mintty", "putty",
        "mstsc", "vmconnect", "teamviewer", "anydesk",
    };

    /// <summary>Window classes where Ctrl+C means "interrupt", so the clipboard path is never used.</summary>
    public static readonly string[] ConsoleWindowClasses =
    {
        "ConsoleWindowClass", "CASCADIA_HOSTING_WINDOW_CLASS", "mintty", "PuTTY", "VirtualConsoleClass",
    };

    public bool Auto { get; set; } = true;

    public List<string> IgnoredProcesses { get; set; } = new(DefaultIgnoredProcesses);

    private static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "KeyFlip", "settings.json");

    public static AppSettings Load()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                AppSettings? loaded = JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(FilePath));
                if (loaded is not null) return loaded;
            }
        }
        catch (Exception)
        {
            // Corrupt settings fall back to defaults.
        }
        return new AppSettings();
    }

    public void Save()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            File.WriteAllText(FilePath, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        }
        catch (Exception)
        {
            // Read-only profile: the setting just won't persist.
        }
    }

    public bool IsProcessIgnored(string? processName) =>
        processName is null || IgnoredProcesses.Any(p => string.Equals(p, processName, StringComparison.OrdinalIgnoreCase));
}
