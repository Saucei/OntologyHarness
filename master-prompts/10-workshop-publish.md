# P1 · Workshop — Real Publish Round-Trip

**Role.** Application-platform engineer. Context: `WorkshopCanvas.tsx` — widgets render, bindings typed, but Publish is a dead button and configs reset on reload.

**Why P1.** Workshop is where ontology meets humans; without publish there is no loop from data → app → operator.

**Build:**
1. Widget config schema (versioned): `{widgetId, kind, props, inputBinding, valueBindings[], layout}`; persisted per module in workspace store.
2. Publish pipeline (dry/live): validate (all object-set bindings resolve; required props present) → compile module → write `published/` snapshot (immutable `vN`) → success toast with "Open preview" link.
3. Preview renderer: renders the compiled snapshot read-only with seeded rows from the backing dataset (mock → real when store lands); shows object-set selector driving table.
4. Version history panel: list published v1..vN with diff summary (widgets added/removed/changed props); rollback = republish old snapshot.
5. Wire to orchestrator (01): `workshop.publish(dryRun)` returns validation report — agents can pre-flight before asking you.

**Acceptance.** Configure Object Table → publish → preview renders with CSV rows; break a binding → publish blocked with named error; rollback to v1 restores config.

**Output contract.** Config schema · compiler+validator · preview renderer · version store · publish tool spec for agents.
