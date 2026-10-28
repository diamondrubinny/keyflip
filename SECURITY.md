# Security policy

KeyFlip handles what people type, so security reports are taken seriously.

## Supported versions
Only the latest release (and `main`) receives fixes. KeyFlip is pre-1.0; preview builds are unsigned (see the [Code signing policy](docs/CODE_SIGNING_POLICY.md)).

## Reporting a vulnerability
- **Privately** through GitHub: [Report a vulnerability](https://github.com/diamondrubinny/keyflip/security/advisories/new) (Security → Advisories).
- Please do **not** open a public issue, and never include real passwords or private text in a report.
- Expect an acknowledgement within 5 business days and a fix or mitigation plan within 30 days for confirmed issues. Credit is given in the advisory unless you prefer otherwise.

## Scope – what counts as a vulnerability
- Typed text, clipboard content or settings leaving the device, being written to disk/logs, or being kept longer than documented in [docs/PRIVACY.md](docs/PRIVACY.md).
- Correction or tracking inside password fields, password managers or other excluded applications.
- Another extension or web page being able to drive the KeyFlip extension (message spoofing, permission escalation).
- Supply-chain issues in the build or release workflow.

## Design guarantees (verify them yourself)
- No network code in either product; the extension declares no host permissions beyond its content script.
- The Windows app keeps at most the current line (200 characters) in memory, never in ignored applications or password boxes.
- Releases are built only by the public GitHub Actions workflow (`.github/workflows/ci.yml`) and ship `SHA256SUMS.txt`.
