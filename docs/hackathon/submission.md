# Submission copy

## Project name

IncidentMesh

## Repository URL

https://github.com/1337isnot1337/incidentmesh

## What does it do?

IncidentMesh is a concurrent incident-response room where disagreement changes what the system is allowed to do. Trace, Dependency, and Impact are separate Mozaik participants that investigate different evidence streams at the same time. Their hypotheses enter shared typed runtime state. In the deterministic checkout incident, the three responders produce three distinct root-cause hypotheses, yielding two contradictions. That aggregate disagreement blocks rollback, causes Impact to replan to a canary, and causes Trace and Dependency to add corroborating evidence.

## How do the agents run concurrently?

All three responders join one `defineRuntime<IncidentState>()` runtime and register independent handlers for the same `incident.opened` event. None waits for another responder to finish. The deterministic run measures 3 / 3 pairwise span overlaps, and peer hypothesis observations occur while responder work is still active. Hypotheses, gate decisions, replanning, and follow-up evidence are semantic events fanned out through the runtime.

The causal sequence is:

```text
parallel investigation
→ conflicting hypotheses
→ disagreement enters shared state
→ SAFETY GATE: BLOCKED
→ Impact replans to canary
→ Trace + Dependency corroborate
```

## Demo

Run `npm ci && npm run demo`. The provider-free deterministic path prints the event trace, 3 / 3 overlap proof, three hypotheses / two contradictions, blocked gate, adaptive canary plan, and two corroborating evidence responses. [`../demo.md`](../demo.md) contains the 90-second narration.

The deterministic demo traverses the real Mozaik interception and function-call path: a deterministic `InferenceRunner` produces `rollback_production`, Mozaik invokes `SafetyGateInterception`, the transition is rewritten to `request_corroboration`, and the registered safe tool executes.


## Causal concurrency evidence

`npm run ablation` holds the incident, evidence, confidence values, safety rule, proposed rollback, and configured 205 ms action-boundary timer constant. Only evidence scheduling differs.

- Concurrent: all 3 required hypotheses / 2 contradictions are available by the boundary → `BLOCKED — conflicting-evidence` → Mozaik interception → `request_corroboration` → canary + targeted corroboration is actionable immediately.
- Sequential: only Trace evidence is available by the same boundary → `BLOCKED — incomplete-required-evidence` → the same Mozaik interception → `request_corroboration` → hold for missing evidence; the identical later evidence eventually reveals the same conflict and enables the canary plan later.

No arm authorizes production from incomplete evidence. The ablation demonstrates that concurrency changes the safe control path available at the action boundary, not merely wall time. It also reports time to actionable safe mitigation; that deterministic fixture metric is not MTTR or a production-speedup claim.

## Supporting overlap metric

`npm run benchmark` reports a latency/overlap proxy defined as:

```text
sum of measured responder durations / concurrent wall time
```

It is roughly 2.3× in the deterministic fixture. It is not a claim about reasoning quality, throughput, MTTR, or production performance.

## Repository checklist

- TypeScript, Node 20+, `@mozaik-ai/core` 4.0.5
- three independent concurrent responders with 3 / 3 measured pairwise overlap
- runtime peer observations while responder work is active; no claim that Phase-1 model contexts see peer hypotheses
- shared typed state and semantic event fan-out
- evolving investigation state plus an immutable fail-closed action-boundary decision
- producer-role binding, finite `[0,1]` confidence validation, duplicate-role protection, and late-evidence snapshot immutability
- canonical conflicting-evidence block driving deterministic Impact canary replanning
- replanned event driving two peer corroboration responses
- canonical and incomplete-evidence end-to-end Mozaik rollback interception; rollback passes only on affirmative approval
- two-phase model-mode lifecycle test: aggregate evidence → Phase-2 Action Controller → real interceptor → safe tool → follow-up model recommendation
- 17 focused invariant tests, production build, built smoke verification, and GitHub Actions CI
