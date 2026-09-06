# IncidentMesh final hackathon release candidate

## New causal architecture

- Added monotonic `decisionRevision` for authoritative action-relevant evidence and responder closure.
- Added frozen revision-stamped `PlanContext` records.
- Replaced singleton authorization with a distinct immutable `ActionAttemptSnapshot` per action attempt while preserving the latest-snapshot report view.
- Added explicit safe / bounded / destructive action risk tiers.
- Extended `SafetyGateInterception` to reject stale bounded or destructive actions before execution and route them to `request_corroboration`.
- Added an actual Mozaik fresh replanning pass after stale invalidation.

## New proof

- Added provider-derived stale-plan causal ablation: same plan/action/evidence/policy; only peer scheduling changes; concurrent revision 1 → 3 invalidates the in-flight bounded proposal, while serialization leaves it fresh.
- Extended seeded stress to 10,000 cases and 40,000 per-attempt authorization records with zero critical violations.
- Extended semantic stability to both causal experiments: 100 arm executions, zero mismatches.
- Added byte-stable safe-action, stale-plan, degradation, and canonical replay evidence plus strict schema/invariant validation.

## Preserved provider proof

The historical authenticated Gemini Flash-Lite receipt remains unmodified. It proves 1,389 ms common three-way provider overlap, 3/3 hypotheses, blocked conflict, a real provider rollback proposal, real Mozaik interception, `request_corroboration` execution, and provider follow-up.

## Safety retained

Rollback remains proposal-only and requires a fresh immutable attempt with complete authoritative, non-degraded, individually high-confidence, consistent evidence. Missing, conflicting, malformed, spoofed, duplicate, stale, or closed-role evidence cannot authorize destructive action. Complete valid evidence still permits the approved proposal-only path, proving symmetry rather than an always-block design.
