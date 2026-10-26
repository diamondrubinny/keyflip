# SignPath Foundation – setup guide

Status: **not applied yet.** Facts below come from https://signpath.org/terms (checked 2026-10-26); re-verify before applying.

## Eligibility vs. KeyFlip today
| Requirement | Status |
|---|---|
| OSI-approved license, no proprietary parts | ✅ Apache-2.0 (`LICENSE`) |
| Project owns its repository, builds from source | ⬜ create the empty public repo `diamondrubinny/keyflip` and push the project (see README, "העברה לריפו עצמאי"); `.github/workflows/ci.yml` is ready for the new root |
| Actively maintained, already released | ✅ pre-release exists; ⬜ publish a proper release |
| Functionality documented on download page | ✅ README (Hebrew); ⬜ add an English README section |
| Not a hacking tool | ✅ the keyboard hook only detects word boundaries; no exploitation or evasion |
| Privacy statement, no undisclosed data sending | ✅ no network access at all |
| System changes warned, uninstall offered | ⚠ portable app only; add an installer with uninstaller |
| MFA for all members on GitHub and SignPath | ⬜ the owner enables it |
| "Code signing policy" on home and download page | ✅ `docs/CODE_SIGNING_POLICY.md`; ⬜ link it from the README |
| Verifiable **reputation** for executables | ⚠ **main risk.** A brand-new project with no users or history may be declined. Acceptance is discretionary. |

## Steps
1. Create the dedicated public repo, move `keyboard-fixer/` content to its root, add `LICENSE`, enable 2FA, tag a release.
2. Add the "Code signing policy" link to the README and to the release notes.
3. Apply at https://signpath.org/apply (they review the project's reputation once).
4. After approval: install the SignPath GitHub App, create a project + signing policy (manual approval), add the
   organization id as a repository variable and the API token as a repository secret.
5. Extend the workflow: upload the unsigned `KeyFlip.exe` with `actions/upload-artifact@v4`, then call
   `signpath/github-action-submit-signing-request` (exact inputs: verify in the SignPath docs) and publish the signed file.
6. Keep product name/version stable per build as required by the enforced metadata.

## If SignPath declines
- Build reputation (users, stars, issues, regular releases) and re-apply.
- Meanwhile: self-signed certificate for own machines only, or `Unblock` + Defender false-positive report.
