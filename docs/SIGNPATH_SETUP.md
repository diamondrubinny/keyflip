# SignPath Foundation – setup guide

Status (2026-10-26): **not applied yet.** Facts below come from https://signpath.org/terms (checked 2026-10-26); re-verify before applying.

## Eligibility vs. KeyFlip today
| Requirement | Status |
|---|---|
| OSI-approved license, no proprietary parts | ✅ Apache-2.0 (`LICENSE`). 🔎 Word lists are CC BY-SA 4.0 data (not proprietary, not OSI) – confirm acceptance with SignPath |
| Project owns its repository, builds from source | ✅ `diamondrubinny/keyflip`, binaries built only by `.github/workflows/ci.yml` |
| Actively maintained, already released | ⬜ publish the first preview pre-release in this repository (run CI manually with *release = true*), then a stable release |
| Functionality documented on download page | ✅ README in English and Hebrew |
| Not a hacking tool | ✅ the keyboard hook only detects word boundaries; nothing is recorded in excluded apps/password fields; no exploitation or evasion |
| Privacy statement, no undisclosed data sending | ✅ no network access at all; `docs/PRIVACY.md` |
| System changes warned, uninstall offered | ⚠ portable app with documented manual uninstall; installer with uninstaller still planned |
| MFA for all members on GitHub and SignPath | ⬜ owner confirms 2FA on GitHub; enable on SignPath when the account exists |
| "Code signing policy" on home and download page | ✅ linked from README and from every release's notes |
| Security process | ✅ `SECURITY.md`, private vulnerability reporting, CodeQL, Dependabot |
| Verifiable **reputation** for executables | ⚠ **main risk.** A brand-new project with no users or history may be declined. Acceptance is discretionary. |

## Steps
1. Publish a preview pre-release; collect real usage (issues, stars) for a few weeks.
2. Apply at https://signpath.org/apply (they review the project's reputation once).
3. After approval: install the SignPath GitHub App, create a project + signing policy (manual approval), add the
   organization id as a repository variable and the API token as a repository **secret** (never in the repo).
4. Extend the workflow: keep uploading the unsigned `KeyFlip.exe` with `actions/upload-artifact`, then call
   `signpath/github-action-submit-signing-request` (exact inputs: verify in the SignPath docs) and attach the signed file to a **stable** release.
5. Keep product name/version stable per build as required by the enforced metadata (`npm run check-version`).

## If SignPath declines
- Build reputation (users, stars, issues, regular releases) and re-apply.
- Meanwhile: Defender false-positive submission for each release, and `SHA256SUMS.txt` verification.
