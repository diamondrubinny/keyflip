# Microsoft Store display images

Per listing language (`en`, `he`, `ru`, `ar`), for Partner Center → Store listing → Store logos / Store display images. All PNG, opaque, under 5 MB.

| File | Partner Center slot |
|---|---|
| `tile-300x300.png` | 1:1 App tile icon 300 x 300 |
| `tile-150x150.png` | 1:1 150 x 150 |
| `tile-71x71.png` | 1:1 71 x 71 |
| `box-art-2160x2160.png` | 1:1 Box art 2160 x 2160 (optional, recommended) |
| `poster-art-1440x2160.png` | 2:3 Poster art 1440 x 2160 (required only for Xbox) |

`en` uses the original A/א icon. The Russian and Arabic poster lines should be checked by a native speaker.

Rebuild: `FONTS=<folder with Inter.ttf, Heebo.ttf, NotoSansArabic.ttf> node extension/scripts/make-store-images.cjs`
