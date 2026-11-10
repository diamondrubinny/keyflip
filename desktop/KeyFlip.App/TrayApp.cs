using System.Reflection;
using KeyFlip.Core;

namespace KeyFlip.App;

/// <summary>Tray application: automatic correction after each word plus a manual "convert now" hotkey.</summary>
internal sealed class TrayApp : ApplicationContext
{
    private const int HotkeyId = 0x4B46;

    private sealed record LastFix(string Original, string Retyped, long Epoch, IntPtr Window, DateTime At, IntPtr PreviousLayout);

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
    private Detector _detector;
    private readonly KeyboardMonitor _monitor = new();
    private readonly MessageWindow _window = new();
    private readonly NotifyIcon _tray;
    private readonly ContextMenuStrip _menu;
    private readonly ToolStripMenuItem _autoItem;
    private readonly ToolStripMenuItem _startupItem;
    private readonly ToolStripMenuItem _browsersItem;
    private readonly ToolStripMenuItem _switchLayoutItem;
    private LastFix? _lastFix;
    private bool _busy;
    private bool _syncingStartup;

    public TrayApp()
    {
        _detector = Detector.Create(_settings.EnabledLanguages(), _settings.ResolvedLatinLayout());
        _autoItem = new ToolStripMenuItem("תיקון אוטומטי") { CheckOnClick = true, Checked = _settings.Auto };
        _autoItem.CheckedChanged += (_, _) =>
        {
            _settings.Auto = _autoItem.Checked;
            _settings.Save();
        };

        _browsersItem = new ToolStripMenuItem("פעל גם בדפדפנים") { CheckOnClick = true, Checked = _settings.IncludeBrowsers };
        _browsersItem.CheckedChanged += (_, _) =>
        {
            _settings.IncludeBrowsers = _browsersItem.Checked;
            _settings.Save();
            _monitor.InvalidateWindow();
            if (_browsersItem.Checked)
            {
                Notify("מופעל גם בדפדפנים. כבו את התוסף של KeyFlip בכרום כדי למנוע תיקון כפול, ושימו לב: אין זיהוי של שדות סיסמה בדפדפן.");
            }
        };

        _switchLayoutItem = new ToolStripMenuItem("החלף את שפת המקלדת אחרי תיקון") { CheckOnClick = true, Checked = _settings.SwitchLayoutAfterFix };
        _switchLayoutItem.CheckedChanged += (_, _) =>
        {
            _settings.SwitchLayoutAfterFix = _switchLayoutItem.Checked;
            _settings.Save();
            if (_switchLayoutItem.Checked)
            {
                Notify("אחרי תיקון, המקלדת של החלון תעבור לשפה של המילה המתוקנת (רק אם השפה מותקנת ב-Windows). ביטול התיקון (Ctrl+Alt+Space) מחזיר גם את המקלדת.");
            }
        };

        var convertItem = new ToolStripMenuItem("המר עכשיו (Ctrl+Alt+Space)");
        convertItem.Click += async (_, _) => await ConvertNowAsync();

        _startupItem = new ToolStripMenuItem("הפעל עם Windows") { CheckOnClick = true };
        _startupItem.CheckedChanged += async (_, _) =>
        {
            if (_syncingStartup) return;
            StartupResult result = await StartupRegistration.SetAsync(_startupItem.Checked);
            SetStartupChecked(result.Enabled);
            if (result.Message is not null) Notify(result.Message);
        };

        ToolStripMenuItem languagesItem = BuildLanguagesMenu();

        var aboutItem = new ToolStripMenuItem("פרטיות ומידע");
        aboutItem.Click += (_, _) => ShowAbout();

        var exitItem = new ToolStripMenuItem("יציאה");
        exitItem.Click += (_, _) => ExitThread();

        _menu = new ContextMenuStrip { RightToLeft = RightToLeft.Yes };
        _menu.Items.AddRange(new ToolStripItem[]
        {
            _autoItem, _browsersItem, convertItem, languagesItem, _switchLayoutItem, _startupItem, new ToolStripSeparator(), aboutItem, exitItem,
        });

        _tray = new NotifyIcon
        {
            Icon = LoadIcon(),
            Text = "KeyFlip",
            ContextMenuStrip = _menu,
            Visible = true,
        };

        _window.HotkeyPressed += () => _ = ConvertNowAsync();
        if (!NativeMethods.RegisterHotKey(_window.Handle, HotkeyId,
                NativeMethods.MOD_CONTROL | NativeMethods.MOD_ALT | NativeMethods.MOD_NOREPEAT, NativeMethods.VK_SPACE))
        {
            Notify("הקיצור Ctrl+Alt+Space תפוס ע\"י תוכנה אחרת. ההמרה הידנית זמינה מתפריט המגש.");
        }

        _monitor.ShouldTrackWindow = hwnd => !_settings.IsProcessIgnored(WindowInfo.ProcessName(hwnd));
        _monitor.WordCompleted += OnWordCompleted;
        _monitor.Start();

        _ = RefreshStartupItemAsync();

        // A tray app has no window: tell first-time users (and Store reviewers) where KeyFlip went.
        if (!_settings.Welcomed)
        {
            Notify("KeyFlip פועל ברקע. האייקון נמצא באזור ההודעות ליד השעון (לפעמים מתחת לחץ ^). לחיצה ימנית פותחת את התפריט.");
            _settings.Welcomed = true;
            _settings.Save();
        }
    }

    private static readonly (string Id, string Label)[] OptionalLanguageLabels =
    {
        ("ru", "Русский – רוסית"),
        ("ar", "العربية – ערבית"),
        ("fr", "Français – צרפתית"),
        ("de", "Deutsch – גרמנית"),
        ("es", "Español – ספרדית"),
    };

    private static readonly (string Id, string Label)[] LatinLayoutLabels =
    {
        ("us", "English (US) QWERTY"),
        ("fr", "Français AZERTY"),
        ("de", "Deutsch QWERTZ"),
        ("es", "Español"),
    };

    /// <summary>
    /// "שפות" submenu: a check item per optional language (English and Hebrew are always on) and the Latin keyboard the
    /// user types on. "אוטומטי" follows the keyboard layouts installed in Windows.
    /// </summary>
    private ToolStripMenuItem BuildLanguagesMenu()
    {
        var menu = new ToolStripMenuItem("שפות ומקלדת");
        var autoItem = new ToolStripMenuItem("אוטומטי לפי המקלדות המותקנות ב-Windows") { CheckOnClick = true };
        var languageItems = new List<ToolStripMenuItem>();
        var layoutItems = new List<ToolStripMenuItem>();

        void Refresh()
        {
            bool automatic = _settings.Languages is null && _settings.LatinLayout is null;
            autoItem.Checked = automatic;
            IReadOnlyList<string> enabled = _settings.EnabledLanguages();
            string layout = _settings.ResolvedLatinLayout();
            foreach (ToolStripMenuItem item in languageItems) item.Checked = enabled.Contains((string)item.Tag!);
            foreach (ToolStripMenuItem item in layoutItems) item.Checked = layout == (string)item.Tag!;
        }

        void Apply()
        {
            _settings.Save();
            Refresh();
            // Building the word lists takes a moment; keep correcting with the old detector until the new one is ready.
            IReadOnlyList<string> languages = _settings.EnabledLanguages();
            string layout = _settings.ResolvedLatinLayout();
            _ = Task.Run(() => _detector = Detector.Create(languages, layout));
        }

        autoItem.CheckedChanged += (_, _) =>
        {
            if (!autoItem.Checked || (_settings.Languages is null && _settings.LatinLayout is null)) return;
            _settings.Languages = null;
            _settings.LatinLayout = null;
            Apply();
        };
        menu.DropDownItems.Add(autoItem);
        menu.DropDownItems.Add(new ToolStripSeparator());
        menu.DropDownItems.Add(new ToolStripMenuItem("אנגלית ועברית תמיד פעילות") { Enabled = false });
        foreach (var (id, label) in OptionalLanguageLabels)
        {
            var item = new ToolStripMenuItem(label) { CheckOnClick = true, Tag = id };
            item.CheckedChanged += (_, _) =>
            {
                var chosen = new List<string>(_settings.EnabledLanguages().Where(l => !KeyFlip.Core.Languages.Always.Contains(l)));
                if (item.Checked) chosen.Add(id); else chosen.Remove(id);
                if (chosen.Distinct().OrderBy(x => x).SequenceEqual(_settings.EnabledLanguages().Where(l => !KeyFlip.Core.Languages.Always.Contains(l)).OrderBy(x => x))) return;
                _settings.Languages = chosen.Distinct().ToList();
                _settings.LatinLayout ??= _settings.ResolvedLatinLayout();
                Apply();
            };
            languageItems.Add(item);
            menu.DropDownItems.Add(item);
        }
        menu.DropDownItems.Add(new ToolStripSeparator());
        menu.DropDownItems.Add(new ToolStripMenuItem("המקלדת הלטינית שלי:") { Enabled = false });
        foreach (var (id, label) in LatinLayoutLabels)
        {
            var item = new ToolStripMenuItem(label) { Tag = id };
            item.Click += (_, _) =>
            {
                if (_settings.ResolvedLatinLayout() == id && _settings.LatinLayout is not null) return;
                _settings.LatinLayout = id;
                _settings.Languages ??= _settings.EnabledLanguages().Where(l => !KeyFlip.Core.Languages.Always.Contains(l)).ToList();
                Apply();
            };
            layoutItems.Add(item);
            menu.DropDownItems.Add(item);
        }
        menu.DropDownOpening += (_, _) => Refresh();
        Refresh();
        return menu;
    }

    private async Task RefreshStartupItemAsync() => SetStartupChecked(await StartupRegistration.IsEnabledAsync());

    /// <summary>Updates the menu check without re-running the CheckedChanged handler.</summary>
    private void SetStartupChecked(bool enabled)
    {
        if (_menu.IsDisposed) return;
        if (_menu.InvokeRequired)
        {
            _menu.BeginInvoke(() => SetStartupChecked(enabled));
            return;
        }
        _syncingStartup = true;
        try
        {
            _startupItem.Checked = enabled;
        }
        finally
        {
            _syncingStartup = false;
        }
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
            "KeyFlip מתקן טקסט שהוקלד בשפה שגויה (עברית, אנגלית, רוסית, ערבית, צרפתית, גרמנית, ספרדית).\n\n" +
            "פרטיות:\n" +
            "• התוכנה עוקבת אחרי המקשים שנלחצים כדי לזהות מילה שהסתיימה, ושומרת רק את השורה הנוכחית בזיכרון (עד 200 תווים).\n" +
            "• שום דבר לא נכתב לדיסק, לא נרשם ביומן ולא נשלח לרשת.\n" +
            "• כברירת מחדל התוכנה לא פועלת בדפדפנים (התוסף מטפל בהם; אפשר להפעיל מתפריט המגש), ולעולם לא במנהלי סיסמאות, בטרמינלים ובשדות סיסמה קלאסיים.\n" +
            "• ההגדרות נשמרות ב-%APPDATA%\\KeyFlip\\settings.json (בגרסת Microsoft Store: בתיקייה הפרטית של האפליקציה, ונמחקות בהסרה).\n\n" +
            "ביטול תיקון אוטומטי: Ctrl+Alt+Space מיד אחריו.\n\n" +
            $"גרסה {Application.ProductVersion}. קוד פתוח ברישיון Apache-2.0: https://github.com/diamondrubinny/keyflip\n" +
            "מילוני הזיהוי נגזרים מ-FrequencyWords (hermitdave, נתוני OpenSubtitles 2018) ברישיון CC BY-SA 4.0.",
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

    // Wrong-layout typing tends to continue: after a fix, short words are fixed more readily for a while.
    private const double StreakWindowSeconds = 20;
    private int _streakCount;
    private DateTime _streakAt = DateTime.MinValue;
    private IntPtr _streakWindow;

    private int CurrentStreak(IntPtr window) =>
        window == _streakWindow && (DateTime.UtcNow - _streakAt).TotalSeconds < StreakWindowSeconds ? _streakCount : 0;

    private void NoteResult(IntPtr window, bool fixedWord, int tokenLength)
    {
        if (fixedWord)
        {
            _streakCount = CurrentStreak(window) + 1;
        }
        else if (tokenLength >= 3)
        {
            _streakCount = 0;
        }
        else
        {
            return; // short unfixed words neither start nor break a streak
        }
        _streakWindow = window;
        _streakAt = DateTime.UtcNow;
    }

    private void TryAutoFix(WordEvent e)
    {
        try
        {
            if (_monitor.Epoch != e.Epoch || WindowInfo.Foreground != e.Window) return; // the user kept typing

            int streakBefore = CurrentStreak(e.Window);
            Fix? fix = _detector.FixToken(e.Word, streakBefore);
            if (fix is null)
            {
                NoteResult(e.Window, fixedWord: false, e.Word.Length);
                return;
            }

            if (_settings.IsProcessIgnored(WindowInfo.ProcessName(e.Window))) return;
            if (WindowInfo.IsPasswordFieldFocused() || FocusInspector.IsPasswordFocused()) return;
            // The checks above can take a moment; give up if the user typed meanwhile.
            if (_monitor.Epoch != e.Epoch || WindowInfo.Foreground != e.Window) return;

            string original = e.Word + " ";
            string retyped = fix.Replacement + e.Word[fix.Consumed..] + " ";

            // Short words typed just before this one in the same wrong layout ("kt tck" -> "לא אבל") are repaired too.
            // A short word that is also valid in the other language is repaired only between two corrected words.
            // Conversions never change the length, so the whole stretch is retyped in one go and undone as one.
            string line = _monitor.Line.Text;
            int wordStart = line.Length - original.Length;
            string segment = original;
            string newSegment = retyped;
            if (wordStart >= 0 && line.EndsWith(original, StringComparison.Ordinal))
            {
                var edits = new List<(int Start, string Token, Fix Fix)>();
                foreach (var (start, token) in LineBuffer.PreviousShortTokens(line, wordStart))
                {
                    Fix? retro = _detector.FixToken(token, 1, sandwich: streakBefore >= 1);
                    if (retro is null) break;
                    edits.Add((start, token, retro));
                }
                if (edits.Count > 0)
                {
                    int segStart = edits[^1].Start; // nearest first, so the last edit is the earliest
                    // Fixes can change the length (Arabic 'b' types لا): edit from the end so earlier offsets stay valid.
                    var sb = new System.Text.StringBuilder(line[segStart..]);
                    sb.Remove(wordStart - segStart, original.Length);
                    sb.Insert(wordStart - segStart, retyped);
                    foreach (var (start, token, retro) in edits) // nearest first = right to left
                    {
                        sb.Remove(start - segStart, token.Length);
                        sb.Insert(start - segStart, retro.Replacement + token[retro.Consumed..]);
                    }
                    segment = line[segStart..];
                    newSegment = sb.ToString();
                }
            }

            TextInjector.Backspace(segment.Length);
            TextInjector.Type(newSegment);
            _monitor.Line.ReplaceTail(segment.Length, newSegment);
            IntPtr previousLayout = _settings.SwitchLayoutAfterFix
                ? LayoutSwitcher.SwitchTo(e.Window, _detector.LayoutIdOf(fix.Language ?? ""))
                : IntPtr.Zero;
            _lastFix = new LastFix(segment, newSegment, _monitor.Epoch, e.Window, DateTime.UtcNow, previousLayout);
            NoteResult(e.Window, fixedWord: true, e.Word.Length);
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
                LayoutSwitcher.Restore(window, last.PreviousLayout); // the user meant that layout after all
                _lastFix = null;
                return;
            }
            _lastFix = null;

            if (AppSettings.IsPasswordManager(WindowInfo.ProcessName(window))) return;
            if (WindowInfo.IsPasswordFieldFocused() || FocusInspector.IsPasswordFocused()) return;

            // 2. The current selection (copied through the clipboard, which is restored afterwards).
            bool isConsole = AppSettings.ConsoleWindowClasses.Contains(WindowInfo.ClassName(window));
            if (!isConsole)
            {
                string? selected = await TryReadSelectionAsync();
                if (!string.IsNullOrEmpty(selected))
                {
                    string converted = ManualConverter.Convert(selected, _detector);
                    if (converted != selected)
                    {
                        TextInjector.Type(converted);
                        if (_settings.SwitchLayoutAfterFix) LayoutSwitcher.SwitchTo(window, _detector.LayoutIdForText(converted));
                    }
                    _monitor.Line.Reset();
                    return;
                }
            }

            // 3. The trailing run of words typed on the current line.
            string line = _monitor.Line.Text;
            int start = LayoutMap.TrailingRunStart(line);
            if (start >= line.Length) return;
            string run = line[start..];
            string fixedRun = ManualConverter.Convert(run, _detector);
            if (fixedRun == run) return;
            TextInjector.Backspace(run.Length);
            TextInjector.Type(fixedRun);
            _monitor.Line.ReplaceTail(run.Length, fixedRun);
            if (_settings.SwitchLayoutAfterFix) LayoutSwitcher.SwitchTo(window, _detector.LayoutIdForText(fixedRun));
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
        string? backup = null;
        if (hasText && !await RetryAsync(() => backup = Clipboard.GetText(TextDataFormat.UnicodeText))) return null;

        string sentinel = "keyflip-" + Guid.NewGuid().ToString("N");
        if (!await RetryAsync(() => ClipboardPrivacy.SetPrivateText(sentinel))) return null;

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
            if (!string.IsNullOrEmpty(backup)) ClipboardPrivacy.SetPrivateText(backup);
            else Clipboard.Clear();
        });
        return copied;
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
