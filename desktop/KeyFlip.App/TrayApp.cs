using System.Reflection;
using KeyFlip.Core;
using Microsoft.Win32;

namespace KeyFlip.App;

/// <summary>Tray application: automatic correction after each word plus a manual "convert now" hotkey.</summary>
internal sealed class TrayApp : ApplicationContext
{
    private const int HotkeyId = 0x4B46;
    private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValueName = "KeyFlip";

    private sealed record LastFix(string Original, string Retyped, long Epoch, IntPtr Window, DateTime At);

    private sealed class MessageWindow : NativeWindow, IDisposable
    {
        public event Action? HotkeyPressed;

        public MessageWindow() => CreateHandle(new CreateParams { Parent = new IntPtr(-3) }); // HWND_MESSAGE

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == NativeMethods.WM_HOTKEY && m.WParam.ToInt32() == HotkeyId) HotkeyPressed?.Invoke();
            base.WndProc(ref m);
        }

        public void Dispose() => DestroyHandle();
    }

    private readonly AppSettings _settings = AppSettings.Load();
    private readonly Detector _detector = Detector.CreateDefault();
    private readonly KeyboardMonitor _monitor = new();
    private readonly MessageWindow _window = new();
    private readonly NotifyIcon _tray;
    private readonly ToolStripMenuItem _autoItem;
    private readonly ToolStripMenuItem _startupItem;
    private LastFix? _lastFix;
    private bool _busy;

    public TrayApp()
    {
        _autoItem = new ToolStripMenuItem("תיקון אוטומטי") { CheckOnClick = true, Checked = _settings.Auto };
        _autoItem.CheckedChanged += (_, _) =>
        {
            _settings.Auto = _autoItem.Checked;
            _settings.Save();
        };

        var convertItem = new ToolStripMenuItem("המר עכשיו (Ctrl+Alt+Space)");
        convertItem.Click += async (_, _) => await ConvertNowAsync();

        _startupItem = new ToolStripMenuItem("הפעל עם Windows") { CheckOnClick = true, Checked = IsStartupEnabled() };
        _startupItem.CheckedChanged += (_, _) => SetStartup(_startupItem.Checked);

        var aboutItem = new ToolStripMenuItem("פרטיות ומידע");
        aboutItem.Click += (_, _) => ShowAbout();

        var exitItem = new ToolStripMenuItem("יציאה");
        exitItem.Click += (_, _) => ExitThread();

        var menu = new ContextMenuStrip { RightToLeft = RightToLeft.Yes };
        menu.Items.AddRange(new ToolStripItem[]
        {
            _autoItem, convertItem, _startupItem, new ToolStripSeparator(), aboutItem, exitItem,
        });

        _tray = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "KeyFlip",
            ContextMenuStrip = menu,
            Visible = true,
        };

        _window.HotkeyPressed += () => _ = ConvertNowAsync();
        if (!NativeMethods.RegisterHotKey(_window.Handle, HotkeyId,
                NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT | NativeMethods.MOD_NOREPEAT, NativeMethods.VK_SPACE))
        {
            Notify("הקיצור Ctrl+Alt+Space תפוס ע\"י תוכנה אחרת. ההמרה הידנית זמינה מתפריט המגש.");
        }

        _monitor.WordCompleted += OnWordCompleted;
        _monitor.Start();
    }

    private static Icon LoadIcon()
    {
        using Stream? stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("keyflip.ico");
        return stream is null ? SystemIcons.Application : new Icon(stream);
    }

    private void Notify(string text) => _tray.ShowBalloonTip(3000, "KeyFlip", text, ToolTipIcon.Info);

    private static void ShowAbout()
    {
        MessageBox.Show(
            "KeyFlip מתקן טקסט שהוקלד בשפה שגויה (עברית ↔ אנגלית).\n\n" +
            "פרטיות:\n" +
            "• התוכנה עוקבת אחרי המקשים שנלחצים כדי לזהות מילה שהסתיימה, ושומרת רק את השורה הנוכחית בזיכרון (עד 200 תווים).\n" +
            "• שום דבר לא נכתב לדיסק, לא נרשם ביומן ולא נשלח לרשת.\n" +
            "• התוכנה לא פועלת בדפדפנים (התוסף מטפל בהם), במנהלי סיסמאות, בטרמינלים ובשדות סיסמה קלאסיים.\n" +
            "• ההגדרות נשמרות ב-%APPDATA%\\KeyFlip\\settings.json.\n\n" +
            "ביטול תיקון אוטומטי: Ctrl+Alt+Space מיד אחריו.",
            "KeyFlip",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information,
            MessageBoxDefaultButton.Button1,
            MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
    }

    /* ---------- automatic correction ---------- */

    private void OnWordCompleted(WordEvent e)
    {
        if (!_settings.Auto || _busy) return;
        // Never work inside the hook callback: wait until the application has processed the space.
        var timer = new System.Windows.Forms.Timer { Interval = 40 };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            timer.Dispose();
            TryAutoFix(e);
        };
        timer.Start();
    }

    private void TryAutoFix(WordEvent e)
    {
        try
        {
            if (_monitor.Epoch != e.Epoch || WindowInfo.Foreground != e.Window) return; // the user kept typing

            Fix? fix = _detector.FixToken(e.Word);
            if (fix is null) return;

            if (_settings.IsProcessIgnored(WindowInfo.ProcessName(e.Window))) return;
            if (WindowInfo.IsPasswordFieldFocused()) return;

            string original = e.Word + " ";
            string retyped = fix.Replacement + e.Word[fix.Consumed..] + " ";
            TextInjector.Backspace(original.Length);
            TextInjector.Type(retyped);
            _monitor.Line.ReplaceTail(original.Length, retyped);
            _lastFix = new LastFix(original, retyped, _monitor.Epoch, e.Window, DateTime.UtcNow);
        }
        catch (Exception)
        {
            _monitor.Line.Reset();
        }
    }

    /* ---------- manual conversion ---------- */

    private static async Task WaitForKeyReleaseAsync()
    {
        int[] keys = { NativeMethods.VK_CONTROL, NativeMethods.VK_MENU, NativeMethods.VK_SHIFT, NativeMethods.VK_SPACE };
        for (int i = 0; i < 100; i++)
        {
            if (keys.All(k => (NativeMethods.GetAsyncKeyState(k) & 0x8000) == 0)) return;
            await Task.Delay(10);
        }
    }

    private async Task ConvertNowAsync()
    {
        if (_busy) return;
        _busy = true;
        try
        {
            await WaitForKeyReleaseAsync();
            IntPtr window = WindowInfo.Foreground;

            // 1. Undo of an automatic fix that just happened.
            if (_lastFix is { } last && last.Epoch == _monitor.Epoch && last.Window == window
                && (DateTime.UtcNow - last.At).TotalSeconds < 15)
            {
                TextInjector.Backspace(last.Retyped.Length);
                TextInjector.Type(last.Original);
                _monitor.Line.ReplaceTail(last.Retyped.Length, last.Original);
                _lastFix = null;
                return;
            }
            _lastFix = null;

            if (WindowInfo.IsPasswordFieldFocused()) return;

            // 2. The current selection (copied through the clipboard, which is restored afterwards).
            bool isConsole = AppSettings.ConsoleWindowClasses.Contains(WindowInfo.ClassName(window));
            if (!isConsole)
            {
                string? selected = await TryReadSelectionAsync();
                if (!string.IsNullOrEmpty(selected))
                {
                    string converted = LayoutMap.ConvertAuto(selected);
                    if (converted != selected) TextInjector.Type(converted);
                    _monitor.Line.Reset();
                    return;
                }
            }

            // 3. The trailing run of words typed on the current line.
            string line = _monitor.Line.Text;
            int start = LayoutMap.TrailingRunStart(line);
            if (start >= line.Length) return;
            string run = line[start..];
            string fixedRun = LayoutMap.ConvertAuto(run);
            if (fixedRun == run) return;
            TextInjector.Backspace(run.Length);
            TextInjector.Type(fixedRun);
            _monitor.Line.ReplaceTail(run.Length, fixedRun);
        }
        catch (Exception)
        {
            _monitor.Line.Reset();
        }
        finally
        {
            _busy = false;
        }
    }

    private static async Task<bool> RetryAsync(Action action)
    {
        for (int i = 0; i < 5; i++)
        {
            try
            {
                action();
                return true;
            }
            catch (System.Runtime.InteropServices.ExternalException)
            {
                await Task.Delay(20); // the clipboard is briefly owned by another process
            }
        }
        return false;
    }

    /// <summary>Copies the selection with Ctrl+C and restores the previous text clipboard. Returns null if nothing is selected.</summary>
    private static async Task<string?> TryReadSelectionAsync()
    {
        IDataObject? existing = null;
        if (!await RetryAsync(() => existing = Clipboard.GetDataObject())) return null;
        bool hasData = existing is not null && existing.GetFormats().Length > 0;
        bool hasText = existing is not null && existing.GetDataPresent(DataFormats.UnicodeText);
        // Non-text clipboard content (images, files) cannot be restored faithfully, so the selection path is skipped.
        if (hasData && !hasText) return null;
        string? backup = hasText ? existing!.GetData(DataFormats.UnicodeText) as string : null;

        string sentinel = "keyflip-" + Guid.NewGuid().ToString("N");
        if (!await RetryAsync(() => Clipboard.SetText(sentinel))) return null;

        TextInjector.CtrlC();
        string? copied = null;
        for (int i = 0; i < 15 && copied is null; i++)
        {
            await Task.Delay(20);
            string? current = null;
            try
            {
                current = Clipboard.ContainsText() ? Clipboard.GetText() : null;
            }
            catch (System.Runtime.InteropServices.ExternalException)
            {
                // retry on the next iteration
            }
            if (current is not null && current != sentinel) copied = current;
        }

        await RetryAsync(() =>
        {
            if (!string.IsNullOrEmpty(backup)) Clipboard.SetText(backup);
            else Clipboard.Clear();
        });
        return copied;
    }

    /* ---------- start with Windows ---------- */

    private static bool IsStartupEnabled()
    {
        using RegistryKey? key = Registry.CurrentUser.OpenSubKey(RunKeyPath);
        return key?.GetValue(RunValueName) is string;
    }

    private static void SetStartup(bool enabled)
    {
        try
        {
            using RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKeyPath);
            if (enabled) key.SetValue(RunValueName, $"\"{Environment.ProcessPath}\"");
            else key.DeleteValue(RunValueName, throwOnMissingValue: false);
        }
        catch (Exception)
        {
            // Policy may block writing to Run; the menu check simply won't stick.
        }
    }

    protected override void ExitThreadCore()
    {
        NativeMethods.UnregisterHotKey(_window.Handle, HotkeyId);
        _monitor.Dispose();
        _window.Dispose();
        _tray.Visible = false;
        _tray.Dispose();
        base.ExitThreadCore();
    }
}
