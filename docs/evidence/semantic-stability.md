# IncidentMesh semantic-stability receipt

Repeated deterministic fixture runs under ordinary host timer scheduling. This measures semantic stability, not production latency.

- Repetitions per arm: 25
- Total runs: 100
- Semantic mismatches: **0**
- Stale-plan semantic mismatches: **0**

The expected projections include boundary gate reason, evidence available, safe action, interception, executed tool, final gate, and stale-plan freshness/crossing outcomes. Wall-clock values are intentionally excluded because this receipt proves repeatable semantics, not production latency or MTTR.
