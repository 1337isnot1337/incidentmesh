# IncidentMesh — 90-second judge demo

From a fresh clone:

```bash
npm ci
npm run demo
```

Core line:

> Three independent investigators disagree, and that disagreement changes what the system is allowed to do.

Narration:

1. “One `incident.opened` event wakes Trace, Dependency, and Impact independently. They are separate Mozaik participants, and all three measured responder spans overlap.”
2. “Peer hypothesis events are already being observed by runtime handlers while other responder work is still active. The hypotheses enter one typed `IncidentState`; this is runtime awareness, not a claim that the Phase-1 LLMs see peer hypotheses.”
3. “The three responders produce three distinct root-cause hypotheses. Shared state therefore records two contradictions, not three.”
4. “That aggregate disagreement drives the Safety Gate to `BLOCKED`. This is the important transition: disagreement changes what the system is allowed to do.”
5. “The pending rollback now reaches its fixed action boundary. The gate evaluates the evidence already available and blocks. Watch the framework events: Mozaik emits `interception.started`; the Safety Gate rewrites `rollback_production` to `request_corroboration`; Mozaik emits `interception.finished`; then the registered safe tool actually executes.”
6. “In this zero-key fixture, deterministic application logic replans Impact to a canary, then Trace and Dependency add two corroborating evidence responses. The span bars also show 3-of-3 pairwise overlap; the roughly 2.3× number is only an overlap/latency proxy.”

The deterministic demo visibly proves:

```text
parallel investigation
→ conflicting hypotheses
→ disagreement in shared state
→ SAFETY GATE: BLOCKED
→ rollback reaches action boundary
→ Mozaik InterceptionHandler rewrites rollback_production → request_corroboration
→ safe tool executes
→ Impact replans to canary
→ Trace + Dependency corroborate
```

The deterministic `InferenceRunner` supplies the reproducible rollback function call, but the interception events, handler invocation, rewritten transition, function-call state, and safe tool execution all run through Mozaik itself.

The strongest follow-up is the causal ablation:

```bash
npm run ablation
```

It holds the evidence, confidence values, gate rule, proposed rollback, and 205 ms action boundary constant. Only evidence scheduling changes. Concurrent evidence reaches the boundary with three hypotheses and two contradictions, so the gate blocks and Mozaik executes `request_corroboration`. Sequential evidence reaches the same boundary with only Trace's hypothesis, so the same gate rule approves and the proposal-only `rollback_production` tool crosses the boundary; the same contradictory evidence arrives later and tightens the final gate to blocked.

Other useful commands:

```bash
npm run benchmark
npm run verify
npm run demo:built
```

For the framework path, start at `src/app.ts`: `defineRuntime`, typed `IncidentState`, separate responder handlers, semantic-event fan-out, aggregate gate logic, adaptive follow-up, structured provider hypotheses, and `SafetyGateInterception` are all in one reviewable implementation.

For a submission video, generate the visual replay from the same scenario output:

```bash
npm run replay:visual
```

The generated `docs/evidence/replay.svg` is paired with `replay.json`, so every displayed timestamp and transition can be audited against the report.

A separate robustness check is available with `npm run degradation`: Dependency times out before publishing evidence, the failure becomes explicit shared state, and the action boundary remains fail-closed while surviving responders continue.

## Optional model-mode architecture

Model mode is explicitly two-phase. Trace, Dependency, and Impact first run independent structured-output investigation loops. After all three hypotheses enter shared state, the Safety Gate evaluates them and opens a separate Action Controller loop. That Phase-2 prompt contains the aggregate evidence and gate state. A rollback tool call from that loop therefore occurs after the gate decision and is reachable by the same `SafetyGateInterception`; after a rewritten `request_corroboration` tool result, the Action Controller's final `model.answer` is recorded as its recommendation.

The repository tests this lifecycle with a scripted `InferenceRunner`. It does not claim that a real provider has executed it, that the three Phase-1 models see peer hypotheses, or that provider-backed calls overlap until sanitized provider evidence exists.
