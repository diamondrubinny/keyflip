namespace KeyFlip.App;

/// <summary>
/// Switches the keyboard layout of the window that just received a correction, so the next words come out right
/// (docs/MULTILANG_PLAN.md, step 5). Only layouts installed in Windows are used; the request goes to the window
/// itself (WM_INPUTLANGCHANGEREQUEST), exactly as the language bar does, and the application may refuse it.
/// </summary>
internal static class LayoutSwitcher
{
    /// <summary>The layout the window uses now (for undo), or zero.</summary>
    public static IntPtr Current(IntPtr window)
    {
        try
        {
            return NativeMethods.GetKeyboardLayout(WindowInfo.ThreadOf(window));
        }
        catch (Exception)
        {
            return IntPtr.Zero;
        }
    }

    /// <summary>Switches <paramref name="window"/> to the installed keyboard matching a KeyFlip layout id. Returns the previous layout, or zero when nothing changed.</summary>
    public static IntPtr SwitchTo(IntPtr window, string? layoutId)
    {
        if (window == IntPtr.Zero || layoutId is null) return IntPtr.Zero;
        IntPtr target = InstalledLayouts.HandleFor(layoutId);
        if (target == IntPtr.Zero) return IntPtr.Zero; // not installed: the text is fixed, the layout stays
        IntPtr current = Current(window);
        if (current == target) return IntPtr.Zero;
        return Post(window, target) ? current : IntPtr.Zero;
    }

    /// <summary>Restores a layout returned by <see cref="SwitchTo"/> (after an undo).</summary>
    public static void Restore(IntPtr window, IntPtr previous)
    {
        if (window != IntPtr.Zero && previous != IntPtr.Zero) Post(window, previous);
    }

    private static bool Post(IntPtr window, IntPtr hkl)
    {
        try
        {
            return NativeMethods.PostMessage(window, NativeMethods.WM_INPUTLANGCHANGEREQUEST, IntPtr.Zero, hkl);
        }
        catch (Exception)
        {
            return false;
        }
    }
}
