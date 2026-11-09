# P0 · Secrets & API Key Security

**Role.** Security engineer (desktop). Context: keys currently live in `localStorage` (`src/llm/client.ts` STORAGE_KEY). Anyone (or any script) with webview access reads them.

**Why P0.** Standalone app + stored provider keys = credential store, period.

**Build:**
1. `keyring` crate (Windows Credential Manager backend) in `src-tauri`: `key_save(provider, key)`, `key_get`, `key_delete`, `key_exists`.
2. Frontend: Providers module stores only `{provider, baseUrl, model, temperature, maxTokens, systemPrompt}` + `hasKey: bool` — never the secret. Rust `llm_chat` reads the key at call time.
3. Migration: on first run, detect localStorage keys → move into credential store → wipe localStorage copy → toast "Keys migrated to Windows Credential Manager".
4. UI: show `•••• configured` / `not set`, a Test button that never reveals characters, and Delete-key action.
5. CSP tightening in `tauri.conf.json`: default-src 'self'; connect-src only to configured provider hosts (document why null was removed).

**Acceptance.** `localStorage` contains zero secrets after migration (verified by test). `llm_chat` works with Credential Manager-backed key. Deleting key from UI → next call returns auth error, chip flips to "not set".

**Output contract.** keyring integration · migration path · CSP diff · security note in README.
