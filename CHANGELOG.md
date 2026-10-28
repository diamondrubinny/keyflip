# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]
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
