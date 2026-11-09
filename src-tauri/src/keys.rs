// Secrets — Windows Credential Manager via the `keyring` crate.
// The webview never receives the raw key; llm_chat pulls it at call time.
const SERVICE: &str = "ontology-harness";

fn entry(provider: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, provider).map_err(|e| format!("credential entry failed: {e}"))
}

#[tauri::command]
pub fn key_save(provider: String, secret: String) -> Result<(), String> {
    if secret.trim().is_empty() {
        return Err("empty secret refused".into());
    }
    entry(&provider)?.set_password(secret.trim()).map_err(|e| format!("credential save failed: {e}"))
}

#[tauri::command]
pub fn key_has(provider: String) -> Result<bool, String> {
    Ok(entry(&provider)?.get_password().is_ok())
}

#[tauri::command]
pub fn key_delete(provider: String) -> Result<(), String> {
    match entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("credential delete failed: {e}")),
    }
}

/// Internal: read the key at call time (never exposed as a command).
pub fn load_api_key(provider: &str) -> Option<String> {
    entry(provider).ok()?.get_password().ok().filter(|s| !s.trim().is_empty())
}
