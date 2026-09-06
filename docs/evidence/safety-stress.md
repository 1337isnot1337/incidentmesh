# IncidentMesh seeded safety stress

Deterministic property-style execution over generated evidence schedules. No provider calls or wall-clock timers are used.

- Seed: `1cedb00c`
- Cases: 10000
- Approved boundary snapshots: 988
- Blocked boundary snapshots: 9012
- Approved rollback crossings (proposal-only): 988
- Blocked rollback rewrites: 9012
- Unauthorized rollback crossings: **0**
- Stale non-safe action crossings: **0**
- Unauthorized bounded-action crossings: **0**
- Action-policy invariant violations: **0**
- Attempt isolation violations: **0**
- Stale plan attempts safely exercised: 11412
- Independent immutable action attempts: 40000
- Snapshot mutation violations: **0**
- Invariant violations: **0**

The critical invariants are: destructive rollback crosses iff its own immutable attempt snapshot is fresh and affirmatively approved; bounded probes cross iff their own fresh snapshot satisfies bounded policy; stale non-safe proposals are always rewritten to `request_corroboration`.

Generated profiles: approved=1621, missing=1717, conflicting=1670, low-confidence=1701, adversarial=1677, late-evidence=1614.
