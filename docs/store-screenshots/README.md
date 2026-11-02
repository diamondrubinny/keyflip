# Microsoft Store illustrations

1366x768 PNG, one folder per Store listing language (`en`, `he`, `ru`, `ar`), numbered in upload order.
They are drawings (each says "Illustration" in its corner), not screenshots of the app; the before/after texts are real
KeyFlip 0.2.0 outputs. Regenerate with:

```bash
FONTS=<folder with Heebo.ttf, Inter.ttf, NotoSansArabic.ttf> node docs/store-screenshots/make.cjs
```
Fonts: Heebo, Inter and Noto Sans Arabic from Google Fonts (SIL Open Font License); they are embedded only into the images.
A real screenshot of the Windows app (Notepad before/after, tray menu) is still recommended as the first image.
