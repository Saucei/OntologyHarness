// LLM gateway — native HTTP (no webview CORS), keys pulled from Windows
// Credential Manager at call time, SSE streaming via Tauri events, 3-try backoff.
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmRequest {
    /// "openai" (OpenAI-compatible) or "anthropic"
    pub provider: String,
    /// Registered provider id, used to look up the credential when apiKey is empty/"__keyring__"
    pub provider_id: Option<String>,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub system: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    /// OpenAI `tools` array (T-34 native tool-calling bridge) — passed through verbatim.
    #[serde(default)]
    pub tools: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn resolve_key(req: &LlmRequest) -> Result<String, String> {
    let k = req.api_key.trim();
    if !k.is_empty() && k != "__keyring__" {
        return Ok(k.to_string());
    }
    // Keyless providers (Ollama, custom) store no credential — proceed without an
    // Authorization header; hosted providers then surface the provider's own 401.
    let id = req.provider_id.clone().unwrap_or_else(|| "openai".into());
    Ok(crate::keys::load_api_key(&id).unwrap_or_default())
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| format!("client build failed: {e}"))
}

/* ── non-streaming with backoff ───────────────────────────────── */
#[tauri::command]
pub async fn llm_chat(req: LlmRequest) -> Result<String, String> {
    let key = resolve_key(&req)?;
    let client = build_client()?;
    let mut last_err = String::new();
    for attempt in 1..=3u32 {
        match call_once(&client, &req, &key).await {
            Ok(s) => return Ok(s),
            Err(e) => {
                last_err = e;
                // don't retry auth failures — they will never succeed
                if last_err.contains("401") || last_err.contains("403") { break; }
                tokio::time::sleep(std::time::Duration::from_millis(400 * (1 << attempt))).await;
            }
        }
    }
    Err(last_err)
}

async fn call_once(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<String, String> {
    match req.provider.as_str() {
        "anthropic" => anthropic_chat(client, req, key).await,
        _ => openai_compatible_chat(client, req, key).await,
    }
}

/* ── streaming (SSE) — emits "llm-token" {chunk, done, usage?} ── */
#[tauri::command]
pub async fn llm_chat_stream(app: tauri::AppHandle, req: LlmRequest) -> Result<String, String> {
    use futures_util::StreamExt;
    use tauri::Emitter;

    let key = resolve_key(&req)?;
    let client = build_client()?;

    let res = match req.provider.as_str() {
        "anthropic" => anthropic_stream_req(&client, &req, &key).await?,
        _ => openai_stream_req(&client, &req, &key).await?,
    };    let status = res.status();
    if !status.is_success() {
        let text = res.text().await.map_err(|e| e.to_string())?;
        return Err(format!("provider returned {status}: {}", truncate(&text, 600)));
    }

    let mut stream = res.bytes_stream();
    let mut buf = String::new();
    let mut full = String::new();
    let mut usage: Option<Value> = None;

    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("stream read failed: {e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        // process complete lines
        while let Some(idx) = buf.find('\n') {
            let line: String = buf.drain(..=idx).collect();
            let line = line.trim();
            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" { continue; }
                if let Ok(v) = serde_json::from_str::<Value>(data) {
                    // OpenAI: choices[0].delta.content · Anthropic: delta.text · usage in final chunk
                    let tok = v.pointer("/choices/0/delta/content")
                        .or_else(|| v.pointer("/delta/text"))
                        .and_then(|c| c.as_str())
                        .unwrap_or("");
                    if !tok.is_empty() {
                        full.push_str(tok);
                        let _ = app.emit("llm-token", json!({ "chunk": tok, "done": false }));
                    }
                    if let Some(u) = v.get("usage") { usage = Some(u.clone()); }
                    if let Some(u) = v.pointer("/message/usage") { usage = Some(u.clone()); }
                }
            }
        }
    }
    let _ = app.emit("llm-token", json!({ "chunk": "", "done": true, "usage": usage }));
    Ok(full)
}

async fn openai_stream_req(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<reqwest::Response, String> {
    let url = format!("{}/chat/completions", req.base_url.trim_end_matches('/'));
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system) = &req.system {
        messages.push(json!({ "role": "system", "content": system }));
    }
    for m in &req.messages {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }
    let mut body = json!({
        "model": req.model, "messages": messages,
        "temperature": req.temperature.unwrap_or(0.2),
        "max_tokens": req.max_tokens.unwrap_or(1024),
        "stream": true, "stream_options": { "include_usage": true },
    });
    // Ollama thinking models otherwise burn the whole budget before content (T-34).
    if req.provider_id.as_deref() == Some("ollama") { body["think"] = json!(false); }
    let mut b = client.post(&url).json(&body);
    if !key.is_empty() { b = b.bearer_auth(key); }
    b.send().await.map_err(|e| format!("request failed: {e}"))
}

async fn anthropic_stream_req(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<reqwest::Response, String> {
    let url = format!("{}/messages", req.base_url.trim_end_matches('/'));
    let messages: Vec<Value> = req.messages.iter().map(|m| json!({ "role": m.role, "content": m.content })).collect();
    let mut body = json!({
        "model": req.model,
        "max_tokens": req.max_tokens.unwrap_or(1024),
        "temperature": req.temperature.unwrap_or(0.2),
        "messages": messages,
        "stream": true,
    });
    if let Some(system) = &req.system { body["system"] = json!(system); }
    client.post(&url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send().await.map_err(|e| format!("request failed: {e}"))
}

/* ── non-streaming internals ──────────────────────────────────── */
/* ── T-34 native tool-calling — returns the full assistant message ── */
#[tauri::command]
pub async fn llm_chat_tools(req: LlmRequest) -> Result<Value, String> {
    let key = resolve_key(&req)?;
    let client = build_client()?;
    let mut last_err = String::new();
    for attempt in 1..=3u32 {
        match chat_tools_once(&client, &req, &key).await {
            Ok(v) => return Ok(v),
            Err(e) => {
                last_err = e;
                if last_err.contains("401") || last_err.contains("403") { break; }
                tokio::time::sleep(std::time::Duration::from_millis(400 * (1 << attempt))).await;
            }
        }
    }
    Err(last_err)
}

async fn chat_tools_once(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<Value, String> {
    let url = format!("{}/chat/completions", req.base_url.trim_end_matches('/'));
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system) = &req.system {
        messages.push(json!({ "role": "system", "content": system }));
    }
    for m in &req.messages {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }
    let mut body = json!({
        "model": req.model, "messages": messages,
        "temperature": req.temperature.unwrap_or(0.2),
        "max_tokens": req.max_tokens.unwrap_or(1024),
        "tool_choice": "auto",
    });
    if let Some(tools) = &req.tools {
        body["tools"] = tools.clone();
    }
    // Ollama thinking models otherwise burn the whole budget before content (T-34).
    if req.provider_id.as_deref() == Some("ollama") { body["think"] = json!(false); }
    let mut builder = client.post(&url).json(&body);
    if !key.is_empty() { builder = builder.bearer_auth(key); }
    let res = builder.send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| format!("read body failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("provider returned {status}: {}", truncate(&text, 600)));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))?;
    let msg = v.pointer("/choices/0/message")
        .cloned()
        .ok_or_else(|| format!("unexpected response shape: {}", truncate(&text, 400)))?;
    let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
    let tool_calls: Vec<Value> = msg.get("tool_calls").and_then(|t| t.as_array()).map(|arr| {
        arr.iter().filter_map(|tc| {
            let f = tc.get("function")?;
            let name = f.get("name")?.as_str()?;
            Some(json!({ "name": name, "arguments": f.get("arguments").cloned().unwrap_or(json!("{}")) }))
        }).collect()
    }).unwrap_or_default();
    Ok(json!({ "content": content, "toolCalls": tool_calls }))
}

async fn openai_compatible_chat(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<String, String> {
    let url = format!("{}/chat/completions", req.base_url.trim_end_matches('/'));
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system) = &req.system {
        messages.push(json!({ "role": "system", "content": system }));
    }
    for m in &req.messages {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }
    let mut body = json!({
        "model": req.model, "messages": messages,
        "temperature": req.temperature.unwrap_or(0.2),
        "max_tokens": req.max_tokens.unwrap_or(1024),
    });
    // Ollama thinking models otherwise burn the whole budget before content (T-34).
    if req.provider_id.as_deref() == Some("ollama") { body["think"] = json!(false); }
    let mut builder = client.post(&url).json(&body);
    if !key.is_empty() { builder = builder.bearer_auth(key); }
    let res = builder.send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| format!("read body failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("provider returned {status}: {}", truncate(&text, 600)));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))?;
    v.pointer("/choices/0/message/content").and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("unexpected response shape: {}", truncate(&text, 400)))
}

async fn anthropic_chat(client: &reqwest::Client, req: &LlmRequest, key: &str) -> Result<String, String> {
    let url = format!("{}/messages", req.base_url.trim_end_matches('/'));
    let messages: Vec<Value> = req.messages.iter().map(|m| json!({ "role": m.role, "content": m.content })).collect();
    let mut body = json!({
        "model": req.model,
        "max_tokens": req.max_tokens.unwrap_or(1024),
        "temperature": req.temperature.unwrap_or(0.2),
        "messages": messages,
    });
    if let Some(system) = &req.system { body["system"] = json!(system); }
    let res = client.post(&url)
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send().await.map_err(|e| format!("request failed: {e}"))?;
    let status = res.status();
    let text = res.text().await.map_err(|e| format!("read body failed: {e}"))?;
    if !status.is_success() {
        return Err(format!("provider returned {status}: {}", truncate(&text, 600)));
    }
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("invalid JSON: {e}"))?;
    v.pointer("/content/0/text").and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("unexpected response shape: {}", truncate(&text, 400)))
}

fn truncate(s: &str, n: usize) -> &str {
    if s.len() <= n { s } else { &s[..n] }
}
