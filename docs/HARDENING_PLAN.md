# KeyFlip – Hardening plan (2026-10-26)

Source: `keyflip-audit.md` (2026-10-26). Each item is ticked when done. Verified locally: extension typecheck, 16 unit, 11 e2e, 4 a11y; .NET 10 build of all projects with 0 warnings, 6 core tests, no vulnerable packages.

## A. Code
- [x] A1 .NET 8 (EOL 2026-11-10) → .NET 10 LTS: all csproj, root `global.json`, CI, README.
- [x] A2 `desktop/KeyFlip.slnx`, `desktop/Directory.Build.props` (shared Version/Nullable/LangVersion).
- [x] A3 Desktop: do not buffer keystrokes while an ignored process or a password field is in focus (`KeyboardMonitor` gets a `ShouldTrack` predicate, cached per HWND).
- [x] A4 Desktop: UI Automation `IsPassword` check (Electron/WPF/UWP) before auto-fix and manual conversion, with timeout.
- [x] A5 Desktop: clipboard sentinel/restore marked `ExcludeClipboardContentFromMonitorProcessing`, `CanIncludeInClipboardHistory=0`, `CanUploadToCloudClipboard=0`.
- [x] A6 Desktop: ignore code editors/IDEs and more password managers; settings migration (`SettingsVersion`).
- [x] A7 Desktop: About shows license + third-party notice.
- [x] A8 Extension: `playwright` devDependency; dependency upgrades (TypeScript 5.9.x, @types/chrome, esbuild, axe-core).
- [x] A9 Extension: `match_origin_as_fallback`, `_locales` (en/he), context-menu title via i18n.
- [x] A10 Extension build ships `LICENSE` + `NOTICE.md` inside `dist`.
- [x] A11 `scripts/check-version.mjs`: one version (0.1.0) enforced across package.json / manifest / Directory.Build.props.

## B. CI / GitHub files
- [x] B1 `ci.yml`: push(main)+PR, actions pinned to SHA, concurrency, timeouts, version check, `npm audit`, e2e+a11y job, `dotnet list package --vulnerable`, release tag `v<version>-preview.N`, LICENSE/NOTICE in release.
- [x] B2 `codeql.yml` (JS/TS + C# build-mode none), `dependabot.yml` (npm, nuget, actions).
- [x] B3 `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `CODEOWNERS`, issue templates, PR template.
- [x] B4 `.gitignore` additions.

## C. Docs
- [x] C1 README: full English section, fix `ci.yml` references, remove "move to standalone repo", .NET 10.
- [x] C2 PLAN.md refreshed to current reality (hook-based threat model, structure, status).
- [x] C3 SIGNPATH_SETUP / CODE_SIGNING_POLICY (preview pre-release policy, roles = diamondrubinny, `ci.yml`).
- [x] C4 PRIVACY (clipboard history, password detection limits), TERMS (Apache-2.0), ACCESSIBILITY, STORE_LISTING, PRODUCTION_CHECKLIST (single truth on manual testing).

## D. Delivery
- [x] D1 Pushed to branch `hardening-2026-10-26` through the GitHub web UI (owner account), merged by squash PR. Fallback: `deploy-keyflip-hardening.bat`.
- [x] D2 GitHub settings via browser: About/topics, private vulnerability reporting, Dependabot alerts.
- [ ] D3 After push: verify CI, merge, ruleset for `main`, run release workflow.

## Open decisions (defaults taken)
- Contact channel in public docs = GitHub Issues / private security advisories (no personal email published).
- Jurisdiction in TERMS = Israel, marked for legal review.
- TypeScript stays on 5.9.x (6.x/7.x migration is a separate step).
