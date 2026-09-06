# IncidentMesh seeded safety stress

Deterministic property-style execution over generated evidence schedules. No provider calls or wall-clock timers are used.

- Seed: `1cedb00c`
- Cases: 10000
- Approved boundary snapshots: 988
- Blocked boundary snapshots: 9012
- Approved rollback crossings (proposal-only): 988
- Blocked rollback rewrites: 9012
- Unauthorized rollback crossings: **0**
- Snapshot mutation violations: **0**
- Invariant violations: **0**

The critical invariant is: an immutable action-boundary snapshot permits the rollback proposal only when its decision is affirmatively APPROVED; every other decision rewrites the proposal to `request_corroboration`.

Generated profiles: approved=1621, missing=1717, conflicting=1670, low-confidence=1701, adversarial=1677, late-evidence=1614.
