# Code signing policy

> Draft prepared for the SignPath Foundation application. Replace the bracketed fields before publishing.
> This exact heading ("Code signing policy") must appear on the project home page and the download page.

Free code signing provided by [SignPath.io](https://signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## What is signed
Only the Windows executable `KeyFlip.exe`, built from this repository by the public GitHub Actions workflow
(`.github/workflows/keyflip.yml`). Product name (`KeyFlip`) and version are enforced identically on every build.
The Chrome extension is not signed by SignPath.

## Team roles
| Role | Responsibility | Member |
|---|---|---|
| Author | Modifies source code directly | [GitHub username] |
| Reviewer | Reviews changes from non-committers | [GitHub username] |
| Approver | Approves every signing request manually | [GitHub username] |

All team members use multi-factor authentication on GitHub and SignPath.

## Release and signing process
1. Source is committed to the public repository; the binary is built only by GitHub Actions from that source.
2. Each release requires manual approval of the signing request by an Approver.
3. Unsigned or unverifiable builds are never published as releases.

## Privacy policy
KeyFlip does not send any data to any server. It processes typed text locally and in memory only.
See [PRIVACY.md](PRIVACY.md). The Windows app uses a keyboard hook solely to detect the end of a typed word;
it stores at most the current line (200 characters) in memory and never writes it to disk, logs or the network.

## System changes
The only system change KeyFlip can make is the optional "Start with Windows" entry in
`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, controlled by a checkbox in the tray menu. Settings are stored in `%APPDATA%\KeyFlip`.

## Uninstallation
KeyFlip is a portable executable: exit it from the tray menu, untick "Start with Windows", then delete the file and `%APPDATA%\KeyFlip`.
(An installer with an uninstaller is planned and required before wider distribution.)

## Third-party components and data
See [NOTICE.md](../NOTICE.md) (word lists derived from FrequencyWords, CC BY-SA).
