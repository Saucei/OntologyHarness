# T-34 — Native tool-calling bridge + LFM2.5 local model + 0.0.3 installer

**Layer:** L1-LLM-BRIDGE (orchestrator/client/Rust gateway) · **Status:** DONE (2026-11-10)
**Date opened:** 2026-11-10 · **Requested by:** user ("use my local Ollama LFM 2.5-2.6b heretic on the interface and test its agentic capabilities")

## Problem

1. The agent orchestrator speaks only the `<tool>{"name","args"}</tool>` text protocol. Pre-flight
   (live curl against Ollama 0.40.15) proved `lfm2.5-2.6b-heretic:latest` — a 2.7B, 128K-ctx,
   thinking + tools-capable model — ignores that protocol entirely and emits its native template
   (`<|tool_call_start|>[ontology.list()]<|tool_call_end|>`), with `think:false` accepted but
   protocol adherence unchanged. With a native OpenAI `tools` param, Ollama parses its output into
   correct `tool_calls` (`ontology_get {"id":"Process Stage"}`). The model's agentic ability is
   real; the interface doesn't speak its dialect.
2. Tauri gateway bug: `resolve_key` hard-errors when no Credential Manager entry exists — exactly
   the keyless-Ollama case — so local models could never work in the installed app.
3. Model catalog had no entry for the user's model; the Ollama provider default (`llama3.1`) isn't
   even pulled on this machine.

## Approach

- `src/agent/tools.ts`: every ToolDef gains JSON-Schema `parameters`.
- `src/llm/client.ts`: `llmChatTools()` (browser fetch + Tauri invoke), `toOpenAiTools`,
  `parseNativeToolCalls`, dot→underscore name mapping (OpenAI name charset), LFM2.5 catalog entry,
  Ollama default model fix.
- `src-tauri/src/llm.rs`: `tools` field on `LlmRequest`, new `llm_chat_tools` command (returns
  `{content, toolCalls}`), lenient `resolve_key` (missing credential → no auth header; hosted
  providers surface their own 401).
- `src/agent/orchestrator.ts`: native-first loop for OpenAI-kind providers (up to 3 calls/hop),
  text-protocol fallback retained for anthropic and for models that emit `<tool>` anyway; shared
  approval gate + trace/audit path for both dialects.
- Version 0.0.2 → 0.0.3, `version:sync`, RELEASE.md changelog, installer rebuild + silent reinstall.

## Gates

1. `npx tsc -b` clean; `cargo check` exit 0.
2. `npx vitest run` green, increment ≥ 2 (new: orchestrator.test.ts ×6 incl. first-ever orchestrator
   coverage, catalog native-bridge tests ×2).
3. `npm run build` exit 0.
4. Browser agentic test on :1420 — provider=Ollama/model=LFM2.5: Test connection reachable; agent
   run executes a real tool (ontology.get) and answers from the result; traces show llm-call +
   tool-call rows. Console clean.
5. `npm run tauri:build` → silent NSIS reinstall of 0.0.3.
6. Commit → push → CI green; GOALS.md T-34 row DONE.

## Findings (pre-flight, 2026-11-10)

- First call after boot ~142 s (model cold load, 1.7 GB); warm hops 5–28 s (thinking model; CPU or
  partial GPU offload — acceptable for agent loops, notable).
- Native `tools` param → `tool_calls` parsed correctly, arguments as JSON string.
- `think:false` yields empty content on trivial pings at tiny max_tokens budgets (32) — the app's
  real budgets (512–4096) are safe; thinking arrives in a separate field, `content` stays clean.

## Gate results (2026-11-10)

1. ✅ `npx tsc -b` exit 0 · `cargo check` exit 0.
2. ✅ vitest 44 files / **351 tests green** (+8: first-ever orchestrator coverage ×6 — native happy
   path, decline, approval-granted, anthropic text path, text-fallback-in-native, hop-limit; catalog
   bridge tests ×2 — LFM entry + name mapping).
3. ✅ `npm run build` exit 0.
4. ✅ Browser agentic test on :1420, provider=Ollama model=lfm2.5-2.6b-heretic:latest:
   - Test connection → "reachable" chip (11 s round-trip, think:false live).
   - Probe 1: "how many properties does Process Stage have" → native hops `ontology.list {}` →
     `ontology.get {"id":"ot-process"}` (id **threaded from the list result**) → grounded answer
     "**4 properties** … stageId, name, taktSeconds, linePosition … id: ot-process" with the
     Action·Evidence·Verification·Next step format. Traces: llm-call rows (123.7 s cold, 29.4 s,
     34.6 s warm) + tool-call rows, all ok.
   - Probe 2: graph.query generalization → `graph_query {"focus":"stage","depth":5,"kind":"stage"}`
     → answer names real node kinds (warehouse/material/stage/product/customer) and cites real
     nodes (wh-Distribution Center; stamping, weld, paint, trim).
   - Verdict: LFM2.5-2.6B-heretic IS agentic via the native bridge — plans, threads args between
     hops, grounds answers, cites IDs. Quirk: ignores JSON-Schema bounds (depth=5 vs 1-3) — tools
     must clamp (ours do). Latency: cold ~2 min, warm hop 9-35 s, full run 2-4 min.
5. ✅ `npm run tauri:build` → NSIS + MSI 0.0.3 bundles; silent NSIS reinstall on this machine.
6. ✅ Commit → push → CI (see run for SHA).

Known cosmetic issue (pre-existing, dev-only): React duplicate-key warnings ("1","2") fire in
AgentConsole while the permissions/mode panels re-render mid-run — no functional impact; both runs
rendered correctly. Not a T-34 regression (T-34 keys are UUID/index-prefixed).
