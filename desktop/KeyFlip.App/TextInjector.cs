using System.Runtime.InteropServices;

namespace KeyFlip.App;

/// <summary>Synthesizes keyboard input. Everything sent is tagged so the keyboard hook ignores it.</summary>
internal static class TextInjector
{
    private static NativeMethods.INPUT Key(ushort vk, ushort scan, uint flags) => new()
    {
        type = NativeMethods.INPUT_KEYBOARD,
        u = new NativeMethods.InputUnion
        {
            ki = new NativeMethods.KEYBDINPUT
            {
                wVk = vk,
                wScan = scan,
                dwFlags = flags,
                time = 0,
                dwExtraInfo = NativeMethods.InjectedMarker,
            },
        },
    };

    private static void Send(List<NativeMethods.INPUT> inputs)
    {
        if (inputs.Count == 0) return;
        NativeMethods.INPUT[] array = inputs.ToArray();
        NativeMethods.SendInput((uint)array.Length, array, Marshal.SizeOf<NativeMethods.INPUT>());
    }

    public static void Backspace(int count)
    {
        var inputs = new List<NativeMethods.INPUT>(count * 2);
        for (int i = 0; i < count; i++)
        {
            inputs.Add(Key(NativeMethods.VK_BACK, 0, 0));
            inputs.Add(Key(NativeMethods.VK_BACK, 0, NativeMethods.KEYEVENTF_KEYUP));
        }
        Send(inputs);
    }

    /// <summary>Types text as Unicode characters, independent of the active keyboard layout.</summary>
    public static void Type(string text)
    {
        var inputs = new List<NativeMethods.INPUT>(text.Length * 2);
        foreach (char c in text)
        {
            inputs.Add(Key(0, c, NativeMethods.KEYEVENTF_UNICODE));
            inputs.Add(Key(0, c, NativeMethods.KEYEVENTF_UNICODE | NativeMethods.KEYEVENTF_KEYUP));
        }
        Send(inputs);
    }

    public static void CtrlC()
    {
        Send(new List<NativeMethods.INPUT>
        {
            Key(NativeMethods.VK_CONTROL, 0, 0),
            Key(NativeMethods.VK_C, 0, 0),
            Key(NativeMethods.VK_C, 0, NativeMethods.KEYEVENTF_KEYUP),
            Key(NativeMethods.VK_CONTROL, 0, NativeMethods.KEYEVENTF_KEYUP),
        });
    }
}
