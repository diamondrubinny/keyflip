namespace KeyFlip.App;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();

        using var mutex = new Mutex(initiallyOwned: true, @"Local\KeyFlip.SingleInstance", out bool isFirst);
        if (!isFirst)
        {
            // Launched again (e.g. from the Start menu) while already running: explain instead of doing nothing.
            MessageBox.Show(
                "KeyFlip כבר פועל. האייקון שלו נמצא באזור ההודעות ליד השעון – לחיצה ימנית פותחת את התפריט.",
                "KeyFlip",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information,
                MessageBoxDefaultButton.Button1,
                MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
            return;
        }

        Application.Run(new TrayApp());
    }
}
