use tauri::Manager;

mod keys;
mod llm;
mod storage;

/// T1 folder install — scan `%APPDATA%/OntologyHarness/plugins` (via
/// `app_data_dir()/plugins`) and return installed pack manifests as JSON.
/// One entry per immediate subdirectory that contains a `pack.json`:
/// `{ dir, manifest, files }` where `manifest` is the raw pack.json text and
/// `files` maps sibling payload file names to their text contents.
/// Additive only; does not alter storage/LLM/key commands.
#[tauri::command]
fn list_local_packs(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("plugins");
    if !base.exists() {
        return Ok(serde_json::json!([]));
    }
    let mut out = Vec::new();
    let entries = std::fs::read_dir(&base).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("pack.json");
        if !manifest_path.is_file() {
            continue;
        }
        let manifest = std::fs::read_to_string(&manifest_path).unwrap_or_default();
        if manifest.is_empty() {
            continue;
        }
        let dir = entry.file_name().to_string_lossy().into_owned();
        let mut files = serde_json::Map::new();
        if let Ok(inner) = std::fs::read_dir(&path) {
            for f in inner.flatten() {
                let fp = f.path();
                if !fp.is_file() {
                    continue;
                }
                let name = f.file_name().to_string_lossy().into_owned();
                if name == "pack.json" {
                    continue;
                }
                if let Ok(text) = std::fs::read_to_string(&fp) {
                    files.insert(name, serde_json::Value::String(text));
                }
            }
        }
        out.push(serde_json::json!({ "dir": dir, "manifest": manifest, "files": files }));
    }
    Ok(serde_json::Value::Array(out))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let db = storage::init(app.handle()).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            llm::llm_chat,
            llm::llm_chat_stream,
            llm::llm_chat_tools,
            keys::key_save,
            keys::key_has,
            keys::key_delete,
            storage::ws_load,
            storage::ws_save_jobs,
            storage::ws_save_workers,
            storage::ws_save_object_types,
            storage::ws_save_datasets,
            storage::ws_save_meta,
            storage::ws_append_trace,
            storage::ws_append_audit,
            list_local_packs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ontology Harness");
}
