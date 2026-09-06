- Two-phase model-mode architecture: concurrent structured investigations feed aggregate gate state, then a dedicated Action Controller receives shared evidence with `SafetyGateInterception` attached.
- Scripted model-mode integration test proves post-aggregation rollback interception and follow-up model recommendation without claiming a real-provider run.
- Provider CLI preflight rejects missing credentials before loops start; later rejected inference terminates nonzero at a process-level boundary because Mozaik 4.0.5 `runLoop` returns `void`.
- README/demo language now distinguishes runtime peer observation, deterministic application replanning, and actual model-context evidence.
# 1.0.0 — IncidentMesh hackathon release

IncidentMesh is a concurrent incident-response prototype built on `@mozaik-ai/core` 4.0.5.

Current release highlights:

- Three independent responder lifecycles with 3 / 3 measured pairwise overlap.
- Peer hypothesis observations while responder work is active.
- Typed shared `IncidentState` where three distinct root-cause hypotheses produce two contradictions.
- A Safety Gate whose blocked decision changes Impact's behavior from rollback intent to a canary plan.
- Trace and Dependency reactions to that new plan, producing two follow-up corroboration events.
- Canonical zero-key traversal of Mozaik's interception path: `rollback_production` is rewritten to the registered proposal-only `request_corroboration` tool and the safe tool executes.
- Structured provider hypotheses that preserve claim, confidence, and root-cause data.
- Fail-closed action-boundary handling for missing required evidence, including explicit timeout and generally hanging responder degradation.
- A fixed-action-boundary causal ablation where evidence scheduling alone changes the safe control path available: conflict-informed canary immediately versus a conservative hold for missing evidence.
- Event-driven scenario completion, bounded timeout behavior, and stable returned snapshots.
- Product-first README, causal hero, social-preview asset, cleaned documentation layout, and GitHub Actions verification.

The deterministic path is the canonical reproducible demo. It does not ingest live telemetry or execute real production changes; it does traverse Mozaik's real interception and function-call machinery using a deterministic inference fixture.
