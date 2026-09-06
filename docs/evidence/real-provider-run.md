# IncidentMesh authenticated Gemini Phase-1 receipt

This file summarizes one bounded provider-backed Phase-1 execution. It is evidence of authenticated responder concurrency, not a production-readiness claim and not a claim of provider-backed Phase-2 tool execution.

- Capture started: 2026-09-06T05:22:18.110Z
- Capture process ended: 2026-09-06T05:22:48.358Z
- Captured commit: `d2f50acb08c476e56f8975ebda11219b8fe3ce47`
- Node: v24.19.0
- Mozaik: 4.0.5
- Provider: Google
- Model: `gemini-3.5-flash`
- Command: `RUN_MODEL=1 DRY_RUN=0 PHASE1_ONLY=1 MODEL=gemini-3.5-flash node dist/index.js`
- Provider credential required: yes
- Phase-1 responder inference completed: yes
- Structured hypotheses received by shared state: 3
- Aggregate gate after Phase 1: `BLOCKED — conflicting-evidence`
- Phase-2 action execution in this receipt: not attempted
- Interception in this receipt: not attempted

## Provider inference windows

| Responder | Inference started | Inference completed | Duration |
| --- | ---: | ---: | ---: |
| Trace | 4 ms | 2,418 ms | 2,414 ms |
| Dependency | 5 ms | 2,881 ms | 2,876 ms |
| Impact | 5 ms | 2,602 ms | 2,597 ms |

All three authenticated provider calls were simultaneously in flight.

`max(start) = 5 ms`

`min(completion) = 2,418 ms`

Therefore the measured three-way provider-inference overlap is **2,413 ms**.

The wider responder spans also overlap pairwise in all three combinations:

- Trace ↔ Dependency: 2,416 ms
- Trace ↔ Impact: 2,416 ms
- Dependency ↔ Impact: 2,599 ms

## Structured hypotheses

The three real model calls returned distinct structured hypotheses that entered shared `IncidentState`:

- Trace — `downstream_dependency_exhaustion`, confidence 0.85
- Impact — `dependency_latency_spike`, confidence 0.85
- Dependency — `broken_dependency_upgrade`, confidence 0.80

After the third hypothesis arrived, the aggregate Safety Gate recorded `BLOCKED — conflicting-evidence` with two contradictions across three hypotheses.

## Scope and limitations

- This capture intentionally stops at the Phase-1 evidence layer. It does not claim a verified provider-backed Phase-2 function-call/interception execution.
- The deterministic IncidentMesh demo and tests separately prove the action-boundary and real Mozaik interception behavior; the causal ablation separately controls the scheduling comparison.
- The raw report contains an `incident.scenario.timeout` at approximately 30 seconds from the then-current Phase-1-only settling waiter. All three provider inferences had already completed by 2,881 ms, and the timeout is not used to derive the overlap measurement above.
- The report exposes normalized IncidentMesh/Mozaik events, not raw provider request/response bodies or authorization metadata.
- A single successful authenticated execution does not establish production reliability, reasoning quality, throughput, or MTTR improvement.

[Inspect the raw evidence JSON](real-provider-run.json)
