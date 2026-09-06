# IncidentMesh final runtime release and post-freeze evidence

## Final runtime architecture

- Added monotonic `decisionRevision` for authoritative action-relevant evidence and responder closure.
- Added frozen revision-stamped `PlanContext` records.
- Replaced singleton authorization with a distinct immutable `ActionAttemptSnapshot` per action attempt while preserving the latest-snapshot report view.
- Added explicit safe / bounded / destructive action risk tiers.
- Extended `SafetyGateInterception` to reject stale bounded or destructive actions before execution and route them to `request_corroboration`.
- Added an actual Mozaik fresh replanning pass after stale invalidation.

The runtime/source freeze point for the authenticated release evidence is:

`e98376445c42ea532cbe4993095911d932a3a57a`

All repository changes after that freeze point are documentation/evidence-only; no runtime implementation, prompt, policy, dependency, test, or scheduling behavior was changed to obtain the later provider evidence.

## Deterministic proof package

- Added provider-derived stale-plan causal ablation: same plan/action/evidence/policy; only peer scheduling changes; concurrent revision 1 → 3 invalidates the in-flight bounded proposal, while serialization leaves it fresh.
- Extended seeded stress to 10,000 cases and 40,000 per-attempt authorization records with zero critical violations.
- Extended semantic stability to both causal experiments: 100 arm executions, zero mismatches.
- Added byte-stable safe-action, stale-plan, degradation, and canonical replay evidence plus strict schema/invariant validation.

## Fresh release-SHA provider proof

Authenticated Google `gemini-3.5-flash-lite` attempt #3 ran against frozen runtime `e983764...` and records:

- Trace provider call: 4 → 1,458 ms;
- Dependency provider call: 4 → 1,495 ms;
- Impact provider call: 4 → 1,367 ms;
- **1,363 ms common three-way provider-call overlap**;
- 3/3 accepted responder hypotheses;
- shared gate `blocked`;
- no production mutation.

The verbatim raw JSON is committed at [`../evidence/release-phase1-provider-run.json`](../evidence/release-phase1-provider-run.json), SHA-256 `6a53fd13cac4eae9e02ba2e1361881432a98e9cc23e58808ace6b006c1ebf313`.

This stochastic run did **not** propose `rollback_production`, so no interception rewrite was observed. It is intentionally scoped to fresh authenticated Phase-1 provider concurrency and is not presented as fresh authenticated Phase 2.

## Preserved historical full provider proof

The historical authenticated Gemini Flash-Lite receipt remains unmodified. It records **1,389 ms** common three-way provider-call overlap, 3/3 hypotheses, blocked conflict, a real provider rollback proposal, real Mozaik interception, `request_corroboration` execution, and provider follow-up.

The fresh release-SHA Phase-1 artifact and the historical full Phase-2 artifact support different claims and are kept separate rather than being merged into a synthetic “final-SHA full path” claim.

## Safety retained

Rollback remains proposal-only and requires a fresh immutable attempt with complete authoritative, non-degraded, individually high-confidence, consistent evidence. Missing, conflicting, malformed, spoofed, duplicate, stale, or closed-role evidence cannot authorize destructive action. Complete valid evidence still permits the approved proposal-only path, proving symmetry rather than an always-block design.

## Public submission

The published JigJoy entry remains `incidentmesh-40ad9c` with the final 83-second YouTube demo, four screenshots, and the exact field copy preserved in [`submission.md`](submission.md). The public text truthfully references the historical 1,389 ms authenticated run; the fresh 1,363 ms release-SHA Phase-1 receipt was added afterward as repository-only supporting evidence, so no submission-text rewrite is implied by these release notes.
