# Concept lock: IncidentMesh

IncidentMesh is a live incident-response room for an outage. Independent responders inspect different signals at the same time, publish hypotheses and confidence into one shared runtime, and react when another responder changes the situation.

Why concurrency is necessary: telemetry, dependency health, and customer impact are independent streams that arrive on different clocks. A sequential pipeline makes the incident wait for the slowest investigation and prevents early signals from changing the next responder's behavior. A shared room lets the first reliable signal raise or lower confidence while other responders are still working.

Participants:

- **Trace** — latency, error-rate, and request-path evidence.
- **Dependency** — deploys, queues, and upstream/downstream health.
- **Impact** — user-visible blast radius and mitigation cost.
- **Safety Gate** — watches contradictions and confidence, blocks unsafe mitigation, and requests corroboration when the room is uncertain.

Runtime state is the incident phase, hypotheses, evidence count, confidence, contradictions, and gate decision. Situations wake responders on `incident.opened`, `hypothesis.emitted`, `evidence.added`, and `participant.left`. A deterministic replay uses controlled delays to produce auditable overlap; the optional real-model mode uses the same event-driven handlers and Mozaik agent loops.
