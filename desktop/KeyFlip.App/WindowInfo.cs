using System.Diagnostics;
using System.Text;

namespace KeyFlip.App;

/// <summary>Read-only queries about the foreground window used to decide where KeyFlip must stay out.</summary>
internal static class WindowInfo
{
    public static IntPtr Foreground => NativeMethods.GetForegroundWindow();

    public static uint ThreadOf(IntPtr hwnd) => NativeMethods.GetWindowThreadProcessId(hwnd, out _);

    public static string? ProcessName(IntPtr hwnd)
    {
        try
        {
            NativeMethods.GetWindowThreadProcessId(hwnd, out uint pid);
            if (pid == 0) return null;
            using Process p = Process.GetProcessById((int)pid);
            return p.ProcessName;
        }
        catch (Exception)
        {
            return null; // elevated or gone: treated as unknown
        }
    }

    public static string ClassName(IntPtr hwnd)
    {
        var sb = new StringBuilder(256);
        return NativeMethods.GetClassName(hwnd, sb, sb.Capacity) > 0 ? sb.ToString() : string.Empty;
    }

    /// <summary>True when the focused control is a classic Win32 password edit box.</summary>
    public static bool IsPasswordFieldFocused()
    {
        try
        {
            IntPtr fg = Foreground;
            var info = new NativeMethods.GUITHREADINFO { cbSize = System.Runtime.InteropServices.Marshal.SizeOf<NativeMethods.GUITHREADINFO>() };
            if (!NativeMethods.GetGUIThreadInfo(ThreadOf(fg), ref info) || info.hwndFocus == IntPtr.Zero) return false;
            bool isEdit = ClassName(info.hwndFocus).Contains("edit", StringComparison.OrdinalIgnoreCase);
            return isEdit && (NativeMethods.GetWindowLong(info.hwndFocus, NativeMethods.GWL_STYLE) & NativeMethods.ES_PASSWORD) != 0;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
