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
4. “That aggregate disagreement drives the evolving investigation gate to `BLOCKED — conflicting-evidence` before the action boundary.”
5. “The pending rollback reaches the fixed action boundary. IncidentMesh freezes an action-boundary snapshot of the evidence and decision. Only affirmative `APPROVED` may pass; `PENDING` or `BLOCKED` is unsafe. Watch Mozaik emit `interception.started`, rewrite `rollback_production` to `request_corroboration`, emit `interception.finished`, and execute the registered safe tool.”
6. “Because the complete conflict is already known in the concurrent run, the safe path can select a canary plus targeted corroboration immediately. Trace and Dependency then add two corroborating evidence responses.”

The deterministic demo visibly proves:

```text
parallel investigation
→ complete conflicting evidence
→ SAFETY GATE: BLOCKED — conflicting-evidence
→ immutable action-boundary snapshot
→ rollback reaches action boundary
→ Mozaik InterceptionHandler rewrites rollback_production → request_corroboration
→ safe tool executes
→ Impact selects canary + targeted corroboration
→ Trace + Dependency corroborate
```

The deterministic `InferenceRunner` supplies the reproducible rollback function call, but the interception events, handler invocation, rewritten transition, function-call state, and safe tool execution all run through Mozaik itself. `rollback_production` is proposal-only; the fixture never performs a real production rollback.

The strongest follow-up is the causal ablation:

```bash
npm run ablation
```

Same evidence. Same confidence values. Same gate policy. Same rollback proposal. Same 205 ms action boundary. Only evidence scheduling changes.

```text
CONCURRENT at boundary:
3 required hypotheses + 2 contradictions
→ BLOCKED — conflicting-evidence
→ request_corroboration
→ canary + targeted corroboration is actionable immediately

SEQUENTIAL at boundary:
1 required hypothesis; Dependency + Impact still missing
→ BLOCKED — incomplete-required-evidence
→ request_corroboration / hold
→ conflict-informed canary is not yet selectable

Later in sequential run:
remaining identical evidence arrives
→ final investigation becomes BLOCKED — conflicting-evidence
→ canary + targeted corroboration becomes actionable later
```

No arm authorizes production from incomplete evidence. Concurrency changes control flow, not merely wall time: parallel evidence makes the same fail-closed gate more decisive at the fixed boundary.

Other useful commands:

```bash
npm run benchmark
npm run verify
npm run demo:built
```

For the framework path, start at `src/app.ts`: `defineRuntime`, typed `IncidentState`, responder identity binding, evidence validation, immutable boundary snapshots, separate responder handlers, semantic-event fan-out, aggregate gate logic, adaptive follow-up, structured provider hypotheses, and `SafetyGateInterception` are in one reviewable implementation.

For a submission video, generate the visual replay from the same scenario output:

```bash
npm run replay:visual
```

The generated `docs/evidence/replay.svg` is paired with `replay.json`, so every displayed timestamp and transition can be audited against the report. The canonical replay remains the complete-evidence conflict path and labels the boundary reason explicitly.

A separate robustness check is available with `npm run degradation`: Dependency misses its evidence deadline, becomes explicitly degraded, the boundary snapshot records `incomplete-required-evidence`, and the same Mozaik interceptor blocks rollback while surviving responders continue on a conservative corroboration path.

## Optional model-mode architecture

Model mode remains explicitly two-phase. Trace, Dependency, and Impact first run independent structured-output investigation loops. Once aggregate evidence produces an actionable gate state, a separate Action Controller loop receives the shared hypotheses and gate state. A rollback tool call from that loop occurs after aggregation and is reachable by the same `SafetyGateInterception`; after a rewritten `request_corroboration` tool result, the Action Controller's final `model.answer` is recorded as its recommendation.

Malformed model evidence is rejected rather than normalized into a more favorable score. Required responders that produce no valid evidence before the evidence deadline become explicitly degraded for the phase. The repository tests this lifecycle with scripted `InferenceRunner` integrations, including a generally hanging responder. It does not claim an authenticated real-provider execution, provider-backed overlap, or production latency results.
