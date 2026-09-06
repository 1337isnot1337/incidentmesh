# Concept lock: IncidentMesh

IncidentMesh is a concurrent incident-response room where three independent investigators can disagree, and that disagreement changes what the system is allowed to do. Responders inspect different signals at the same time, publish structured hypotheses into shared runtime state, and let later evidence invalidate plans that were formed against an older state revision.

Concurrency is necessary because request-path telemetry, dependency health, and customer impact are independent streams that arrive on different clocks. A sequential pipeline can leave a plan temporarily “fresh” simply because contradictory evidence has not arrived yet. IncidentMesh instead allows evidence to advance while planning is still in flight, then rechecks the plan at the action boundary.

Participants and roles:

- **Trace** — latency and request-path evidence.
- **Dependency** — deploy, queue, and dependency evidence.
- **Impact** — customer blast radius and mitigation cost.
- **Safety Gate** — aggregates required evidence, confidence, degradation, and contradiction state; destructive action fails closed unless strict approval conditions are met.
- **Action Controller** — performs the separate post-aggregation planning/action phase, freezes a revision-stamped `PlanContext`, and sends bounded/destructive tool proposals through the Mozaik action boundary.
- **Incident Console / observer** — records the auditable event timeline, responder spans, attempts, and evidence transitions.
- **Incident Commander** — opens the incident.

The final policy has three action tiers:

- `request_corroboration` — safe;
- `targeted_canary_probe` — bounded, reversible, proposal-only, and allowed only from a fresh plan with sufficient consistent evidence for its target;
- `rollback_production` — destructive, proposal-only, and subject to complete strict approval plus freshness.

Every accepted action-relevant hypothesis or required-responder closure advances `decisionRevision`. The Action Controller freezes the revision and evidence it actually reasons over. Every bounded/destructive proposal then receives its own immutable `ActionAttemptSnapshot`; if the plan is stale or its action-specific policy is not satisfied, Mozaik interception rewrites it to the safe corroboration path before execution.

The deterministic fixture uses controlled delays and fixed hypotheses to make overlap, revisions, interception, degradation, and causal scheduling comparisons reproducible. Provider-backed mode uses real model inference for Phase 1 and a separate Phase-2 Action Controller while preserving the same shared-state and action-boundary machinery.

Current provider evidence is deliberately split by claim scope:

- a fresh authenticated Google `gemini-3.5-flash-lite` run against frozen release runtime `e98376445c42ea532cbe4993095911d932a3a57a` records **1,363 ms** common three-way Phase-1 provider-call overlap and 3/3 accepted hypotheses, but did not propose `rollback_production`;
- a separate historical authenticated Gemini receipt records **1,389 ms** common three-way provider-call overlap plus the full provider-backed Phase-2 rollback/interception/safe-tool/follow-up path.

The core product claim is therefore not merely “three agents run at once.” It is: **concurrency changes which decisions are still valid.**
