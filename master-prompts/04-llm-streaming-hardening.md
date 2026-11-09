# P0 · LLM Streaming, Retries & Model Routing

**Role.** LLM-platform engineer. Context: `src-tauri/src/llm.rs` (blocking, no stream), `src/llm/client.ts` (loadSettings), `AipLogicPanel` (spinner-only UX).

**Why P0.** Streaming is the difference between a tool and a toy; swarm workers (P0-05) need this to be believable.

**Build:**
1. Rust: `llm_chat_stream` command — SSE parsing for OpenAI-compatible (`data:` frames) and Anthropic (`content_block_delta`); emit Tauri `llm-token` events via channel; propagate `finish_reason` + usage.
2. Frontend client: token callback API `llmChatStream(settings, messages, {onToken, onDone, onError})`; AIP Logic + Agent Console render tokens live (no layout thrash — buffer 30ms chunks).
3. Resilience: 2 retries w/ exponential backoff + jitter on 429/5xx/network; per-call timeout (default 60s, configurable); user-facing abort button.
4. Routing: `routeModel(taskClass)` — `reasoning | extraction | code | cheap` → configured model per class (settings UI gets 4 optional override fields; blank = use default model).
5. Telemetry: each call logs `{provider, model, class, tokensIn, tokensOut, latencyMs, ok}` to the store.

**Acceptance.** AIP Logic preview streams tokens visibly; killing network mid-stream shows partial answer + retry toast; 429 from provider triggers backoff then succeeds/surfaces error; stats appear in worker card.

**Output contract.** SSE parser · streaming client · routing settings UI · telemetry schema.
