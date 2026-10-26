using System.Runtime.InteropServices;
using System.Text;
using KeyFlip.Core;

namespace KeyFlip.App;

internal readonly record struct WordEvent(string Word, long Epoch, IntPtr Window);

/// <summary>
/// Low-level keyboard hook that keeps a bounded in-memory record of the current line so that a
/// finished word can be checked. Nothing is logged, persisted or sent anywhere; the record is
/// cleared on Enter/Tab/navigation keys, mouse clicks, window changes and after 30 s of inactivity.
/// </summary>
internal sealed class KeyboardMonitor : IDisposable
{
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WH_MOUSE_LL = 14;
    private const long IdleResetMs = 30_000;

    private readonly NativeMethods.LowLevelKeyboardProc _keyboardProc;
    private readonly NativeMethods.LowLevelKeyboardProc _mouseProc;
    private IntPtr _keyboardHook;
    private IntPtr _mouseHook;
    private IntPtr _lastWindow;
    private long _lastKeyTick = Environment.TickCount64;

    public LineBuffer Line { get; } = new();

    /// <summary>Increments on every real (non-injected, non-modifier) key press.</summary>
    public long Epoch { get; private set; }

    public event Action<WordEvent>? WordCompleted;

    public KeyboardMonitor()
    {
        _keyboardProc = KeyboardCallback;
        _mouseProc = MouseCallback;
    }

    public void Start()
    {
        IntPtr module = NativeMethods.GetModuleHandle(null);
        _keyboardHook = NativeMethods.SetWindowsHookEx(NativeMethods.WH_KEYBOARD_LL, _keyboardProc, module, 0);
        if (_keyboardHook == IntPtr.Zero)
        {
            throw new InvalidOperationException("Could not install the keyboard hook.");
        }
        _mouseHook = NativeMethods.SetWindowsHookEx(WH_MOUSE_LL, _mouseProc, module, 0);
    }

    private IntPtr MouseCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = (int)wParam;
            if (msg is WM_LBUTTONDOWN or WM_RBUTTONDOWN or WM_MBUTTONDOWN)
            {
                Line.Reset();
                Epoch++;
            }
        }
        return NativeMethods.CallNextHookEx(_mouseHook, nCode, wParam, lParam);
    }

    private IntPtr KeyboardCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int msg = (int)wParam;
            if (msg is NativeMethods.WM_KEYDOWN or NativeMethods.WM_SYSKEYDOWN)
            {
                var data = Marshal.PtrToStructure<NativeMethods.KBDLLHOOKSTRUCT>(lParam);
                bool injected = (data.flags & NativeMethods.LLKHF_INJECTED) != 0 || data.dwExtraInfo == NativeMethods.InjectedMarker;
                if (!injected)
                {
                    try
                    {
                        OnKeyDown(data);
                    }
                    catch (Exception)
                    {
                        Line.Reset(); // never let tracking problems affect typing
                    }
                }
            }
        }
        return NativeMethods.CallNextHookEx(_keyboardHook, nCode, wParam, lParam);
    }

    private static bool IsDown(int vk) => (NativeMethods.GetAsyncKeyState(vk) & 0x8000) != 0;

    private static bool IsModifierKey(uint vk) =>
        vk is 0x10 or 0x11 or 0x12 or 0x14 or 0x5B or 0x5C or (>= 0xA0 and <= 0xA5);

    private void OnKeyDown(NativeMethods.KBDLLHOOKSTRUCT data)
    {
        uint vk = data.vkCode;
        if (IsModifierKey(vk)) return;

        bool ctrl = IsDown(NativeMethods.VK_CONTROL);
        bool alt = IsDown(NativeMethods.VK_MENU);
        // Our own hotkey (Ctrl+Alt+Space) must not look like typing, or "undo" could never see an unchanged epoch.
        if ((int)vk == NativeMethods.VK_SPACE && ctrl && alt) return;

        long now = Environment.TickCount64;
        IntPtr window = WindowInfo.Foreground;
        if (window != _lastWindow || now - _lastKeyTick > IdleResetMs)
        {
            Line.Reset();
            _lastWindow = window;
        }
        _lastKeyTick = now;
        Epoch++;

        bool altGr = ctrl && alt; // AltGr reports as Ctrl+Alt and produces characters
        if ((ctrl || alt) && !altGr)
        {
            Line.Reset();
            return;
        }

        switch ((int)vk)
        {
            case NativeMethods.VK_BACK:
                Line.Backspace();
                return;
            case NativeMethods.VK_RETURN:
            case NativeMethods.VK_TAB:
            case NativeMethods.VK_ESCAPE:
                Line.Reset();
                return;
        }
        // Navigation and editing keys (PgUp..Down, Insert, Delete) move the caret in ways we cannot follow.
        if ((vk >= 0x21 && vk <= 0x28) || vk == 0x2D || vk == 0x2E)
        {
            Line.Reset();
            return;
        }

        string? text = Translate(vk, data.scanCode);
        if (text is null) return;
        if (text.Length != 1)
        {
            Line.Reset();
            return;
        }

        char c = text[0];
        if (c == ' ')
        {
            string word = Line.CurrentWord;
            Line.Append(' ');
            if (word.Length > 0) WordCompleted?.Invoke(new WordEvent(word, Epoch, window));
        }
        else if (!char.IsControl(c))
        {
            Line.Append(c);
        }
    }

    private static string? Translate(uint vk, uint scan)
    {
        var state = new byte[256];
        if (IsDown(NativeMethods.VK_SHIFT)) state[NativeMethods.VK_SHIFT] = 0x80;
        if (IsDown(NativeMethods.VK_CONTROL)) state[NativeMethods.VK_CONTROL] = 0x80;
        if (IsDown(NativeMethods.VK_MENU)) state[NativeMethods.VK_MENU] = 0x80;
        if ((NativeMethods.GetKeyState(NativeMethods.VK_CAPITAL) & 1) != 0) state[NativeMethods.VK_CAPITAL] = 0x01;

        IntPtr layout = NativeMethods.GetKeyboardLayout(WindowInfo.ThreadOf(WindowInfo.Foreground));
        var buffer = new StringBuilder(8);
        // Flag 0x4: do not change the keyboard state (dead keys keep working for the application).
        int result = NativeMethods.ToUnicodeEx(vk, scan, state, buffer, buffer.Capacity, 0x4, layout);
        return result > 0 ? buffer.ToString(0, result) : null;
    }

    public void Dispose()
    {
        if (_keyboardHook != IntPtr.Zero) NativeMethods.UnhookWindowsHookEx(_keyboardHook);
        if (_mouseHook != IntPtr.Zero) NativeMethods.UnhookWindowsHookEx(_mouseHook);
        _keyboardHook = _mouseHook = IntPtr.Zero;
        Line.Reset();
    }
}
