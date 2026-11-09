# S3-F · Packaging & Release — Standalone Installer (Windows-first)

**Role.** Release engineer. **Context anchors:** `src-tauri/tauri.conf.json` (CSP `null`), `public/favicon.svg`, generated Windows icons (`src-tauri/icons/`), `package.json` scripts (`tauri`, `tauri:dev`, `tauri:build`), no `.icns`, no updater, no signing notes. WebView2 present on dev machine (v156).

**Why P3.** This is the button that turns the harness from dev project to product. Ship after D's a11y gate if WCAG tagging is planned.

**Build:**
1. **Clean release build**: `npm run tauri:build` on a fresh target dir; output NSIS `.exe` + `.msi`; verify on clean VM/profile (install → launch → all 12 modules render → LLM call via Credential Manager).
2. **CSP hardening**: `default-src 'self'`; `connect-src` allowlist = provider hosts from `src/llm/client.ts` registry (openai, anthropic, openrouter, groq, generativelanguage, localhost/127.0.0.1 for Ollama+custom) + `ipc:` for keyring; `img-src 'self' data: blob:`; remove `csp: null`. Vendor Inter + IBM Plex locally (no Google Fonts runtime dependency).
3. **Icons**: regenerate from 1024 master (existing PowerShell System.Drawing pipeline) → Windows set + macOS `.icns` (via `png2icns` or Tauri icon tool) + Linux 512/256.
4. **Updater decision** (with user): `tauri-plugin-updater` + GitHub Releases endpoint, configured or **explicitly disabled** with a one-line rationale in README.
5. **Signing notes**: SmartScreen reality for unsigned builds; EV-cert signtool step documented as release checklist; `tauri.conf.json` `bundle.windows.wix`/`nsis` installers set `.exe` name `OntologyHarness-Setup-<v>.exe`.
6. **Version file**: `src-tauri/Cargo.toml` + `tauri.conf.json` + `package.json` all pinned to same version; `npm run version:sync` script.

**Acceptance.** Installer runs on a second Windows profile/VM with internet blocked except allowlist — app launches, key saved/used, screenshots identical to dev; `tauri-dev` explicitly documented vs `tauri:build`; uninstall leaves no stray files; `tauri.conf.json` CSP active (Electron-style console shows no CSP violations).

**Output contract.** Installer artifacts · CSP diff + hosts list rationale · icon set (Win/mac/Linux) · updater config or disable note · RELEASE.md checklist (sign, smoke, tag, GitHub release) · version-sync script.

**Non-goals.** No auto-update infrastructure until endpoint exists; no code-signing certificate purchase in this step; no notarization (Windows-first).
