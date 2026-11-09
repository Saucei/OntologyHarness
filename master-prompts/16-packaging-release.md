# P3 · Packaging & Release — Standalone Installer

**Role.** Release engineer (Windows-first). Context: only dev exe exists; `tauri.conf.json` CSP null; icons Windows-only; no updater/signing.

**Why P3.** Ships when features stabilize — packaging too early bakes in debt.

**Build:**
1. `npm run tauri:build` clean pass: produces NSIS `.exe` + `.msi`; verify fresh-machine install (WebView2 bootstrapper included or documented).
2. CSP in `tauri.conf.json`: `default-src 'self'`, `connect-src` scoped to provider hosts (driven from providers registry), `img-src 'self' data:`; verify app still works (fonts are self-hosted — vendor Inter/IBM Plex locally now).
3. Icons: keep Windows set (already generated); add macOS `.icns` + Linux 512px/256px for future; `tauri icon` regenerate from 1024px master.
4. Updater: `tauri-plugin-updater` with GitHub Releases endpoint (document repo layout) or disable explicitly with reason — decision with user.
5. Signing: document EV cert requirement + `signtool` step in release checklist; unsigned build prints SmartScreen warning (expected for now).

**Acceptance.** Installer runs on clean VM (or second profile) → app launches, icons correct, no console CSP errors; network blocked to non-allowlisted hosts except during configured LLM calls.

**Output contract.** Release checklist · CSP diff · icon set · updater config (or explicit disable) · installer artifacts.
