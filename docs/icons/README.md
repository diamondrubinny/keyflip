# Language icons

Variants of the KeyFlip icon, one per language: `he` (א), `ru` (Я), `ar` (ع). Each folder has `icon.svg` and PNGs at 16, 32, 48, 128, 300 and 512 px with a transparent background (300 px is the size the source icon uses).

Rebuild: `FONTS=<folder with Inter.ttf, Heebo.ttf, NotoSansArabic.ttf> node extension/scripts/make-language-icons.cjs` (Playwright). The SVGs reference the fonts by name; use the PNGs where those fonts are not installed.

The extension and the Windows app still use the original icon (`extension/icons/`, `desktop/KeyFlip.Package/Assets/`).
