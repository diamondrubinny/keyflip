using System.Text.Json;

namespace KeyFlip.App;

/// <summary>User settings stored in %APPDATA%\KeyFlip\settings.json. Contains no typed text.</summary>
internal sealed class AppSettings
{
    /// <summary>Bump when <see cref="DefaultIgnoredProcesses"/> gains entries so existing files are migrated.</summary>
    public const int CurrentVersion = 2;

    /// <summary>Browsers are skipped by default because the Chrome extension handles them (and password fields there are undetectable).</summary>
    public static readonly string[] BrowserProcesses = { "chrome", "msedge", "firefox", "brave", "opera", "vivaldi" };

    /// <summary>
    /// Processes where KeyFlip never tracks or changes typing: password managers, terminals and remote shells,
    /// remote-control tools, and code editors/IDEs (where a "wrong layout" word is usually code).
    /// </summary>
    public static readonly string[] DefaultIgnoredProcesses =
    {
        // password managers
        "keepass", "keepassxc", "1password", "bitwarden", "lastpass", "dashlane", "enpass", "roboform",
        "nordpass", "protonpass", "keeper",
        // terminals and remote shells
        "windowsterminal", "cmd", "powershell", "pwsh", "conhost", "mintty", "putty", "kitty", "winscp",
        "mobaxterm", "wsl", "wslhost", "alacritty", "wezterm-gui",
        // remote control
        "mstsc", "vmconnect", "teamviewer", "anydesk", "rustdesk",
        // code editors and IDEs
        "code", "code - insiders", "cursor", "windsurf", "devenv", "notepad++", "sublime_text", "idea64",
        "rider64", "pycharm64", "webstorm64", "phpstorm64", "clion64", "goland64", "datagrip64",
        "studio64", "eclipse", "zed",
    };

    /// <summary>Password managers: manual conversion is refused there as well (not only automatic correction).</summary>
    public static readonly string[] PasswordManagerProcesses =
    {
        "keepass", "keepassxc", "1password", "bitwarden", "lastpass", "dashlane", "enpass", "roboform",
        "nordpass", "protonpass", "keeper",
    };

    /// <summary>Window classes where Ctrl+C means "interrupt", so the clipboard path is never used.</summary>
    public static readonly string[] ConsoleWindowClasses =
    {
        "ConsoleWindowClass", "CASCADIA_HOSTING_WINDOW_CLASS", "mintty", "PuTTY", "VirtualConsoleClass",
    };

    /// <summary>0 when read from a file written before versioning existed.</summary>
    public int SettingsVersion { get; set; }

    public bool Auto { get; set; } = true;

    /// <summary>When true the desktop app also corrects text typed in browsers (use it if the extension is not installed).</summary>
    public bool IncludeBrowsers { get; set; }

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
                if (loaded is not null)
                {
                    loaded.Migrate();
                    return loaded;
                }
            }
        }
        catch (Exception)
        {
            // Corrupt settings fall back to defaults.
        }
        return new AppSettings { SettingsVersion = CurrentVersion };
    }

    /// <summary>Brings files written by older versions up to date without dropping the user's own entries.</summary>
    private void Migrate()
    {
        IgnoredProcesses ??= new List<string>();
        // Older files listed browsers here; they are governed by IncludeBrowsers now.
        IgnoredProcesses.RemoveAll(p => BrowserProcesses.Contains(p, StringComparer.OrdinalIgnoreCase));
        if (SettingsVersion < CurrentVersion)
        {
            foreach (string p in DefaultIgnoredProcesses)
            {
                if (!IgnoredProcesses.Contains(p, StringComparer.OrdinalIgnoreCase)) IgnoredProcesses.Add(p);
            }
            SettingsVersion = CurrentVersion;
            Save();
        }
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

    public static bool IsPasswordManager(string? processName) =>
        processName is not null && PasswordManagerProcesses.Contains(processName, StringComparer.OrdinalIgnoreCase);

    public bool IsProcessIgnored(string? processName)
    {
        if (processName is null) return true; // unknown or elevated: input cannot be injected anyway
        if (BrowserProcesses.Contains(processName, StringComparer.OrdinalIgnoreCase)) return !IncludeBrowsers;
        return IgnoredProcesses.Any(p => string.Equals(p, processName, StringComparison.OrdinalIgnoreCase));
    }
}
