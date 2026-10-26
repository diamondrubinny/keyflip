## What and why

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Checklist
- [ ] `npm run typecheck && npm test` (extension) pass
- [ ] `npm run build && npm run e2e && npm run a11y` pass, if the extension changed
- [ ] `dotnet test desktop/KeyFlip.Core.Tests` passes, if the desktop app or `shared/` changed
- [ ] Shared behaviour changed in both implementations, with a case in `shared/test-cases.json`
- [ ] No network access, telemetry, logging of typed text, or new permissions (or explained below)
- [ ] Docs updated (`README.md`, `docs/PRIVACY.md`, `CHANGELOG.md`) when behaviour or data handling changed
- [ ] Version unchanged, or bumped in all three places (`npm run check-version`)

## Privacy / security impact
<!-- "None", or describe what changes in how typed text, the clipboard or settings are handled. -->
