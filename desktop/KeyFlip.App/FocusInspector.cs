using System.Windows.Automation;

namespace KeyFlip.App;

/// <summary>
/// UI Automation checks for the focused control. Covers password fields that the classic Win32 check in
/// <see cref="WindowInfo.IsPasswordFieldFocused"/> cannot see (Electron/Chromium, WPF, UWP/WinUI).
/// Never called from the keyboard hook: UI Automation can block on a busy target application.
/// </summary>
internal static class FocusInspector
{
    private static readonly TimeSpan Timeout = TimeSpan.FromMilliseconds(250);

    /// <summary>
    /// True when the focused element reports <c>IsPassword</c>. A check that does not answer in time counts as a
    /// password field (fail closed); an element that cannot be inspected counts as a normal field.
    /// </summary>
    public static bool IsPasswordFocused()
    {
        try
        {
            Task<bool> check = Task.Run(() =>
            {
                AutomationElement? element = AutomationElement.FocusedElement;
                return element is not null && element.Current.IsPassword;
            });
            return !check.Wait(Timeout) || check.Result;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
