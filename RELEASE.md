# RELEASE — Ontology Harness (Windows installer)

> Self-contained desktop binary via `npm run tauri:build`. CSP is active (see `tauri.conf.json`); fonts + assets are self-hosted (no Google Fonts at runtime). Icons: `src-tauri/icons/` (regen via `src-tauri` PowerShell icon script + `tauri icon` if adding `.icns`).

## Pre-flight (must be green)

```powershell
npm run verify       # tsc + build + vitest (24/24)
npm run acceptance   # ACCEPTANCE_REPORT.md — must be all PASS
npm run version:sync # pins Cargo + tauri.conf + package.json
```

## Build the installer

```powershell
$env:Path += ";$env:USERPROFILE\.cargo\bin"
npm run tauri:build
```

Outputs in `src-tauri/target/release/bundle/`:
- `Ontology Harness_<version>_x64-setup.exe` (NSIS, currentUser)
- `Ontology Harness_<version>_x64_en-US.msi` (WiX)

## Smoke test (fresh profile / VM)

1. Install → launch → all 12 modules render → dark mode toggles → no CSP console errors.
2. Providers → save a key → Test connection reaches the allow-listed host through the Rust gateway.
3. Import `unit_throughput.csv` in Data Hub → dataset appears; round-trip button shows ✓ hash match.
4. AIP Logic → TB question → cursors + citations render.

## CI

`ci.yml` runs on Windows (Node 24): install → `tsc` → `vitest` → `npm run build` → `acceptance` → uploads `dist/` + report as artifacts. Badge in README.

## Signing (post-launch note)

Unsigned builds trigger a SmartScreen warning — expected until we sign. To sign: EV cert → `signtool sign /fd SHA256 /tr <timestamp> /td SHA256 <exe>`. Installer name, bundle metadata and icon set are ready for it. No updater is configured by design (decided: keep updates manual via new installer; revisit when a stable releases endpoint exists).

## Rollback plan

Keep the previous installer. The app reads `workspace.db` from `%APPDATA%/com.berry.ontologyharness/` — reinstalling preserves data. Data safety: export jobs (`Analyst Jobs → Export JSON`) and workspace JSON backup before a major-version jump.
