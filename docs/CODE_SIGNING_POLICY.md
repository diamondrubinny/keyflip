# Code signing policy

> Prepared for the SignPath Foundation application. The heading "Code signing policy" is linked from the project home page (README) and from every release.

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org) – **once the application is approved.** Until then every published build is an **unsigned preview** (see "Release and signing process").

## What is signed
Only the Windows executable `KeyFlip.exe`, built from this repository by the public GitHub Actions workflow
(`.github/workflows/ci.yml`). The product name (`KeyFlip`) and version (`desktop/Directory.Build.props`, checked against the extension's version in CI) are identical on every build.
The Chrome extension is not signed by SignPath (the Chrome Web Store signs extensions it distributes).

## Team roles
| Role | Responsibility | Member |
|---|---|---|
| Author | Modifies source code directly | [@diamondrubinny](https://github.com/diamondrubinny) |
| Reviewer | Reviews every pull request from non-committers (`CODEOWNERS`) | [@diamondrubinny](https://github.com/diamondrubinny) |
| Approver | Approves every signing request manually | [@diamondrubinny](https://github.com/diamondrubinny) |

All team members use multi-factor authentication on GitHub and SignPath. Changes to `main` go through pull requests with passing CI.

## Release and signing process
1. Source is committed to this public repository; binaries are built **only** by GitHub Actions from that source.
2. **Preview builds:** until signing is available, a maintainer may publish an *unsigned* build, always marked as a GitHub **pre-release** named `v<version>-preview.<run>` with "Unsigned PREVIEW build" in its notes and a `SHA256SUMS.txt`.
3. **Stable releases** (not marked pre-release) are published only after the signing request has been approved manually by an Approver. Unsigned or unverifiable builds are never published as stable releases.

## Privacy policy
KeyFlip does not send any data to any server. It processes typed text locally and in memory only.
See [PRIVACY.md](PRIVACY.md). The Windows app uses a keyboard hook solely to detect the end of a typed word;
it keeps at most the current line (200 characters) in memory, records nothing in ignored applications or password fields, and never writes typed text to disk, logs or the network.

## System changes
The only system change KeyFlip can make is the optional "Start with Windows" entry in
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, controlled by a checkbox in the tray menu. Settings are stored in `%APPDATA%\KeyFlip`.

## Uninstallation
KeyFlip is a portable executable: exit it from the tray menu, untick "Start with Windows", then delete the file and `%APPDATA%\KeyFlip`.
(An installer with an uninstaller is planned before wider distribution.)

## Third-party components and data
See [NOTICE.md](../NOTICE.md) (word lists derived from FrequencyWords, CC BY-SA 4.0).
