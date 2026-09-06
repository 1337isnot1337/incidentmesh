# Concept lock: IncidentMesh

IncidentMesh is a concurrent incident-response room. Independent responders inspect different signals at the same time, publish hypotheses and confidence into shared runtime state, and react when another participant changes the situation.

Concurrency is necessary because request-path telemetry, dependency health, and customer impact are independent streams that arrive on different clocks. A sequential pipeline forces incident response to wait for unrelated work. A shared room lets evidence become visible while other responders are still investigating.

Participants:

- **Trace** — latency and request-path evidence.
- **Dependency** — deploy, queue, and dependency evidence.
- **Impact** — customer blast radius and mitigation cost.
- **Safety Gate** — aggregates contradictions and confidence, blocks unsafe rollback, and requires corroboration when evidence conflicts.
- **Incident Console** — records the auditable event timeline and responder spans.
- **Incident Commander** — opens the incident.

The deterministic fixture uses controlled delays and fixed hypotheses to make overlap and state transitions reproducible. Optional provider-backed turns use the same participants and event handlers, with model output normalized into a structured hypothesis.
