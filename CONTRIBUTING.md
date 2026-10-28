# Contributing to KeyFlip

Thanks for helping! Issues and pull requests are welcome in English or Hebrew.

## Ground rules
- **Local only.** No network requests, telemetry, analytics or remote code – ever.
- **Privacy first.** Never log or persist typed text. Never include real passwords or private text in issues, tests or fixtures.
- **Two implementations, one behaviour.** The extension (TypeScript) and the Windows app (C#) share `shared/mapping.json` and `shared/test-cases.json`. A behaviour change needs a shared test case and both implementations updated.
- **Accessibility.** UI changes keep RTL, keyboard navigation, visible focus and AA contrast (`npm run a11y` must pass).

## Setup
Requirements: Node.js 22+, .NET 10 SDK (Windows for running the desktop app; any OS for the core tests).

```bash
cd extension
npm ci
npm run typecheck && npm test
npm run build && npx playwright install chromium && npm run e2e && npm run a11y
cd ..
dotnet test desktop/KeyFlip.Core.Tests
```

## Pull requests
- Branch from `main`; keep PRs focused. CI (build, tests, e2e, accessibility, CodeQL, dependency audit) must be green.
- Every PR is reviewed by the maintainer (`CODEOWNERS`); signing is approved manually per the [Code signing policy](docs/CODE_SIGNING_POLICY.md).
- Update `CHANGELOG.md` under "Unreleased".
- Versions are bumped together in `extension/package.json`, `extension/static/manifest.json` and `desktop/Directory.Build.props` (`npm run check-version`).

## Security
Report vulnerabilities privately – see [SECURITY.md](SECURITY.md).

By contributing you agree that your contribution is licensed under the [Apache-2.0](LICENSE) license and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
