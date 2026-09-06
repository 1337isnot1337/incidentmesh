# IncidentMesh final-candidate status — 2026-09-06

Public release: `master` at `ef0c78eb27e4ab0aa514300d1764c2344f2ebd83` (CI success). Source integration branch: `sol-maxscore-final-integration` at `01dfbde9fb87ae135dda8851635cc3ff2f521805`.

## Proof status

- **Real provider concurrency:** preserved historical Google `gemini-3.5-flash-lite` receipt with 1,389 ms common three-way inference overlap and 3/3 structured hypotheses.
- **Authenticated Phase 2:** the same receipt records a real provider Action Controller proposing `rollback_production`, Mozaik `SafetyGateInterception`, actual `request_corroboration` execution, and provider follow-up.
- **Causal concurrency:** final-runtime stale-plan ablation freezes those provider hypotheses. Both planners start at revision 1. Concurrent peers advance the boundary to revision 3, invalidate the proposal, and trigger a fresh conflict-aware replan; serialized peers leave the bounded proposal fresh until it crosses. Eventual evidence is identical.
- **Safe-action availability:** fixed 205 ms fixture boundary; both rollback arms fail closed; concurrent complete conflict enables targeted safe planning, while sequential incomplete evidence requires a hold.
- **Hard safety:** rollback passes iff its own immutable attempt is fresh and strictly approved. Bounded probes require their own fresh bounded-policy approval. Mutable live state is not an authorization fallback.
- **Adversarial proof:** seed `0x1cedb00c`, 10,000 cases, 40,000 independent attempts, zero unauthorized rollback, bounded, or stale non-safe crossings; zero policy, isolation, or snapshot mutation violations.
- **Semantic stability:** 25 repetitions per arm across two experiments (100 arm executions), zero semantic mismatches.
- **Focused suite:** 37 tests plus typecheck, build, and built smoke verification.

## Architecture status

Trace, Dependency, and Impact remain independent investigation-only Phase-1 responders. Accepted hypotheses and responder closure advance `decisionRevision`; invalid/spoofed/duplicate events do not. The separate Action Controller freezes a `PlanContext`. Each bounded/destructive function call crosses Mozaik enforcement and receives a distinct immutable `ActionAttemptSnapshot`.

Risk tiers:

- `request_corroboration`: safe;
- `targeted_canary_probe`: bounded, reversible, proposal-only;
- `rollback_production`: destructive, proposal-only, strict complete-evidence policy.

## Claim limits

No live production mutation, production readiness, MTTR, generic speedup, or dynamic in-flight prompt update is claimed. The authenticated receipt is historical evidence from its recorded commit. Final-runtime deterministic tools consume its structured hypotheses without rewriting receipt provenance.

## Submission status

Final resubmission published at `2026-09-06T15:23:15.057Z` under `incidentmesh-40ad9c`. Logged-out checks returned HTTP 200 for the detail API, gallery page, repository, and all four screenshot URLs. The public description and concurrency explanation exactly match [`submission.md`](submission.md); the CDN image bytes exactly match the local `01 → 04` gallery assets. No demo or deployment URL existed, so both optional fields remain empty. See [`submission-surface-audit.md`](submission-surface-audit.md).
