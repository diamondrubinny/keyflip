namespace KeyFlip.App;

/// <summary>
/// Builds clipboard content that Windows keeps out of Clipboard History (Win+V), cloud clipboard sync and
/// clipboard monitors. Used for KeyFlip's own temporary sentinel and for restoring the user's clipboard.
/// Text copied by the target application itself (Ctrl+C on the selection) cannot be marked this way.
/// </summary>
internal static class ClipboardPrivacy
{
    private static MemoryStream Dword(int value) => new(BitConverter.GetBytes(value));

    public static DataObject PrivateText(string text)
    {
        var data = new DataObject();
        data.SetData(DataFormats.UnicodeText, text);
        data.SetData("ExcludeClipboardContentFromMonitorProcessing", Dword(0));
        data.SetData("CanIncludeInClipboardHistory", Dword(0));
        data.SetData("CanUploadToCloudClipboard", Dword(0));
        return data;
    }

    public static void SetPrivateText(string text) => Clipboard.SetDataObject(PrivateText(text), copy: true);
}
