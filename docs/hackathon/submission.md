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

`npm run ablation` holds the incident, evidence, confidence values, safety rule, proposed rollback, and fixed 205 ms action boundary constant. Only evidence scheduling differs.

- Concurrent: 3 hypotheses / 2 contradictions are available by the boundary → `BLOCKED` → Mozaik interception → `request_corroboration`.
- Sequential: only Trace evidence is available by the same boundary → `APPROVED` → no interception → proposal-only `rollback_production`; the same contradictory evidence arrives later and changes the final gate to `BLOCKED`, too late to retroactively intercept that call.

This is a control-flow ablation, not a claim that a real production rollback was executed.

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
- aggregate disagreement driving the Safety Gate
- canonical blocked gate driving deterministic Impact canary replanning
- replanned event driving two peer corroboration responses
- canonical end-to-end Mozaik rollback interception plus focused interception tests
- two-phase model-mode lifecycle test: aggregate evidence → Phase-2 Action Controller → real interceptor → safe tool → follow-up model recommendation
- tests, production build, built smoke verification, and GitHub Actions CI
