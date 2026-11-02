# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-02
### Added
- Arabic (step 3 of `docs/MULTILANG_PLAN.md`): `shared/layouts/ar.json` (Arabic 101, including Shift letters أ إ آ and the لا key), a 150k-word Arabic list, and Arabic ↔ English detection in both apps (`Hkh` -> أنا, `lvpfh` -> مرحبا, `لاخخن` -> book, `b` -> لا inside a run of fixes). Unseen 5+ letter words: 91.7% / 93.6% recovered, 0.12-0.18% wrong corrections. Enabled automatically when an Arabic keyboard is installed or Arabic is a browser language.
- Layouts may map a key to several characters and have Shift entries; text that could come from different keys is read every possible way.
### Fixed
- Corrections that change the length (Arabic) keep the caret in place and repair earlier short words correctly, in the extension and the Windows app; the Windows app no longer drops the current line when one key types several letters.
- Russian (step 2 of `docs/MULTILANG_PLAN.md`): `shared/layouts/ru.json` (ЙЦУКЕН), a 150k-word Russian list, and Russian ↔ English detection in both the extension and the Windows app (`ghbdtn` -> привет, `руддщ` -> hello). Unseen 5+ letter words: 96.6% / 97.4% recovered with 0.07-0.09% wrong corrections (`docs/ACCURACY.md`). When several target languages are possible, a reading must clearly beat the others or nothing is changed.
- Russian is enabled automatically when a Russian keyboard layout is installed in Windows, or when Russian is one of the browser's languages (`languages` in the extension's storage / `Languages` in `settings.json` override this). The extension loads the Russian list only when it is enabled.
- Manual conversion picks the target language for Latin text (Hebrew or Russian) by dictionary hits, then by the language models.
- Multi-language core (step 1 of `docs/MULTILANG_PLAN.md`): keyboard layouts live in `shared/layouts/*.json` (replacing `shared/mapping.json`) and the detector works on language definitions instead of a fixed Hebrew/English pair. Behaviour is unchanged: all decisions on a 185k-token sample and the evaluation numbers are identical; 400 sampled decisions were added to `shared/test-cases.json` so the TypeScript and C# engines must keep agreeing.
- Detection v2 (extension and Windows app, same rules, shared test cases): larger word lists (about 135k English / 143k Hebrew words), a character n-gram model for words missing from the dictionaries, a frequency rule for words valid in both languages (`tck` -> אבל), Hebrew prefixes up to three letters, and context: after a fix the next short words are fixed more readily (`kt` -> לא), short words just before a fixed word are repaired too, and a short word between two fixed words is flipped even if it is valid English (`to` -> אם). Measured on unseen words (5+ letters): Hebrew typed on an English layout 57% -> 91%, English typed on a Hebrew layout 13% -> 88%; method and numbers in `docs/ACCURACY.md`.
- Extension: also skips text fields named or labelled like passwords/PIN/OTP/card numbers and CSS-masked inputs.
- Microsoft Store package (MSIX, x64, self-contained): `desktop/KeyFlip.Package` (manifest, logos, `build-msix.ps1`) and a `msix` CI job that also install-tests a self-signed copy.
- Windows app: first-run notice that KeyFlip runs in the notification area; launching it again explains it is already running.
### Changed
- Windows app: "Start with Windows" uses the packaged `StartupTask` in the Store build (the Run key is still used by the standalone EXE).
### Security
- Windows app: keystrokes typed in ignored applications (password managers, terminals, editors) and in password boxes are no longer kept in memory at all.
- Windows app: UI Automation `IsPassword` check blocks correction and manual conversion in password fields of Electron/Chromium, WPF and UWP apps.
- Windows app: KeyFlip's own clipboard writes are excluded from Clipboard History, cloud clipboard sync and clipboard monitors.
- Windows app: manual conversion is refused in password managers.
### Changed
- Windows app moved from .NET 8 (end of support 2026-11-10) to .NET 10 LTS.
- Windows app ignores code editors/IDEs and more password managers, terminals and remote tools by default; existing settings are migrated.
- Extension: localized name/description/shortcut/menu (English + Hebrew); runs in `about:blank`/`srcdoc` editor frames (`match_origin_as_fallback`).
- Extension build and release ZIP include `LICENSE` and `NOTICE.md`.
- Dependencies: TypeScript 5.9.3, @types/chrome 0.3.6, esbuild 0.28, axe-core 4.14, Playwright 1.64 (now a declared devDependency), Microsoft.NET.Test.Sdk 18.11, xunit 2.9.3, xunit.runner.visualstudio 4.0.1.
### CI / project
- CI on `main` pushes and pull requests; actions pinned to SHAs; e2e + accessibility tests, `npm audit` and NuGet vulnerability check; version consistency check; release only on manual dispatch.
- CodeQL, Dependabot, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, `CODEOWNERS`, `desktop/KeyFlip.slnx`, `global.json`.

## [0.1.0] – 2026-10-26
### Added
- Chrome extension (MV3): automatic correction at word end, manual conversion (`Alt+Shift+Z`, context menu), per-site disable.
- Windows tray app: automatic correction, `Ctrl+Alt+Space` manual conversion/undo, start with Windows.
- Shared layout mapping and test cases; privacy, terms, accessibility drafts.
