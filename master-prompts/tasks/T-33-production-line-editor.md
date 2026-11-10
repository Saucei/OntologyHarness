# T-33 — Production Line Editor + De-Seed (Belgian Ale removal)

**Layer:** L2-ONTOLOGY (lineage editing) · **Status:** DONE — gates green (tsc clean · 43 files/343 tests · build exit 0 · console clean · ledger regen · browser-verified: add/rename/delete stage, new/switch areas, reload persistence, seedsRev migration)
**Trigger:** User: "remove all data from belgium ale… do your own research on data and make a new
production line graph… i cant remove or add my own sections to the production line or make a new
area… the program just seems to be designed around pre existing data which has its own issues."

## Problem
1. The default Lineage Graph is hardcoded brewery data (Malt/Hops → NYC/DC/PIT Ales & IPAs →
   Belgian Ale → 30 Customers) in `GraphCanvas.tsx baseNodes`. The user wants it gone.
2. Brewery seeds also live in `data/ontology.ts` (object types), `agent/graph.ts` (graph.query
   tool), `aip/corpus.ts` (grounding chunks), `jobs.ts` (seed job "Lineage audit — Belgian Ale"),
   `components/Wizard.tsx` (brewery_demand.csv), `AgentConsole.tsx` sample prompts, and the
   `packs/presets-brewery` pack.
3. The graph is **read-only**: no way to add/remove stages, rewire edges, or create a new area.
   Everything is baked — which contradicts the "user-modifiable workflow" doctrine.

## Research basis (industry-typical figures, no proprietary claim)
Automotive assembly line — the canonical production line. Documented ranges:
- Stamping: press cycle **3–5 s/panel**; die changeover **20–45 min** (US Steel/Automotive IQ).
- Body shop: **~4,000–5,000 spot welds/body** (industry consensus ~4,800), robot takt ~60 s.
- Paint shop: e-coat + primer + topcoat + clear, oven dwell **6–10 h**; line takt 1.5–3 min.
- Trim & chassis + final assembly (marriage): **takt 56–66 s** (Toyota Georgetown ≈56 s).
- Test & inspection: roll/brake/leak/ADAS **12–18 min**, off-line, rework loop 2–4 %.
- Line rate ≈ **950 units/day** at 2 shifts (takt 58 s ≈ 993 theoretical → OEE losses).

## Deliverables
1. **New default lineage** (`GraphCanvas.tsx`): automotive supply/production chain — Steel Coil,
   Polymer Resin → Stamping Cell, Injection Molding → Body Weld → Paint Shop → Trim & Chassis →
   Final Assembly (Marriage) → Test & Inspection → Quality Gate → Distribution Center → Dealer
   Network. Edge labels carry real flow figures (welds/body, takt, units/day).
2. **New machinery fixture** `assembly-line` (mach.ts): duration-encoded state graph — Paint (≈9.5 h
   oven dwell) dwarfs takt-speed stages; Paint Rework deviation loop (3.2 h, 4 %), Test→Trim repair
   loop (2 %), terminal Shipped. Drives the duration histogram/path explorer meaningfully.
3. **Graph editor (the core ask)** — in Lineage mode:
   - **Add stage** button + auto-position; **Delete stage**; editable **label/sub** in a side
     inspector; **connect** handles (ReactFlow `onConnect`); **delete edge**; duplicate-safe ids.
   - **Areas**: multiple user graphs. Switcher + **New area** (empty, guided) + Delete area.
     Default area = researched production line. Persist per-area in `ws.meta.graphAreas`
     (patchMeta → debounced persist; unload flush from the tier-4 fix covers fast exits).
4. **De-seed brewery** everywhere listed in Problem 2. Remove `packs/presets-brewery`.
5. **Seed-revision migration**: `ontology-harness.seedsRev` in localStorage; bump re-seeds
   jobs/objectTypes/graph areas ONCE so existing installs lose Belgian Ale too (user asked for
   removal). Docs state the overwrite.

## Gates
`npx tsc -b` clean · vitest green (update any test that asserts brewery fixtures; add tests for
the new editor helpers + migration) · dev-tab console clean · ledger regen if new corpus-function
rows apply · GOALS.md flip · `npm run build` exit 0 · push → CI green.

## Non-goals
Machinery fixtures stay read-only (corpus tiles); Geo Map airline data untouched; no backend.
