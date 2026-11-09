// Workspace persistence — SQLite (bundled) at app_data_dir/workspace.db.
// Full-snapshot load + targeted upserts; atomic via single-writer mutes.
use rusqlite::{params, Connection};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct WsDb(pub Mutex<Connection>);

fn open_db(app: &AppHandle) -> Result<Connection, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let conn = Connection::open(dir.join("workspace.db")).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS workers (id TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS object_types (id TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS datasets (id TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS traces (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, value TEXT NOT NULL);",
    ).map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn init(app: &AppHandle) -> Result<WsDb, String> {
    Ok(WsDb(Mutex::new(open_db(app)?)))
}

fn rows_to_vec(conn: &Connection, table: &str) -> Result<Vec<Value>, String> {
    let mut stmt = conn.prepare(&format!("SELECT value FROM {table}")).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        let s = r.map_err(|e| e.to_string())?;
        out.push(serde_json::from_str(&s).unwrap_or(Value::Null));
    }
    Ok(out)
}

#[tauri::command]
pub fn ws_load(db: tauri::State<'_, WsDb>) -> Result<Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let meta: Value = conn
        .query_row("SELECT value FROM kv WHERE key='meta'", [], |r| r.get::<_, String>(0))
        .map(|s| serde_json::from_str(&s).unwrap_or(json!({})))
        .unwrap_or(json!({}));
    Ok(json!({
        "meta": meta,
        "jobs": rows_to_vec(&conn, "jobs")?,
        "workers": rows_to_vec(&conn, "workers")?,
        "objectTypes": rows_to_vec(&conn, "object_types")?,
        "datasets": rows_to_vec(&conn, "datasets")?,
        "traces": rows_to_vec(&conn, "traces")?,
    }))
}

fn upsert_all(conn: &Connection, table: &str, id_field: &str, items: &[Value]) -> Result<(), String> {
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    tx.execute(&format!("DELETE FROM {table}"), []).map_err(|e| e.to_string())?;
    for item in items {
        let id = item.get(id_field).and_then(|v| v.as_str()).unwrap_or("unknown").to_string();
        tx.execute(&format!("INSERT OR REPLACE INTO {table}(id, value) VALUES(?1, ?2)"), params![id, item.to_string()])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ws_save_jobs(db: tauri::State<'_, WsDb>, jobs: Vec<Value>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    upsert_all(&conn, "jobs", "id", &jobs)
}

#[tauri::command]
pub fn ws_save_workers(db: tauri::State<'_, WsDb>, workers: Vec<Value>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    upsert_all(&conn, "workers", "id", &workers)
}

#[tauri::command]
pub fn ws_save_object_types(db: tauri::State<'_, WsDb>, object_types: Vec<Value>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    upsert_all(&conn, "object_types", "id", &object_types)
}

#[tauri::command]
pub fn ws_save_datasets(db: tauri::State<'_, WsDb>, datasets: Vec<Value>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    upsert_all(&conn, "datasets", "id", &datasets)
}

#[tauri::command]
pub fn ws_save_meta(db: tauri::State<'_, WsDb>, meta: Value) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO kv(key, value) VALUES('meta', ?1)",
        params![meta.to_string()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn ws_append_trace(db: tauri::State<'_, WsDb>, value: Value) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO traces(at, value) VALUES(?1, ?2)",
        params![chrono_stamp(), value.to_string()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn ws_append_audit(db: tauri::State<'_, WsDb>, value: Value) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO audit(at, value) VALUES(?1, ?2)",
        params![chrono_stamp(), value.to_string()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

fn chrono_stamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| format!("{}", d.as_secs()))
        .unwrap_or_else(|_| "0".into())
}
