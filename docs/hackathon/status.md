# IncidentMesh current release status — 2026-09-06

Frozen authenticated runtime/source commit: `e98376445c42ea532cbe4993095911d932a3a57a`.

Post-freeze repository changes are documentation/evidence only. Runtime implementation, prompts, policies, dependencies, tests, and action semantics remain unchanged from that frozen source. The current repository head is intentionally not hard-coded here so a later documentation-only provenance commit does not make this status file self-stale.

## Proof status

- **Fresh release-runtime provider concurrency:** authenticated Google `gemini-3.5-flash-lite` attempt #3 against `e983764...` records Trace, Dependency, and Impact provider-call windows with **1,363 ms common three-way overlap**, 3/3 accepted hypotheses, and a shared `blocked` gate. The verbatim raw JSON is committed at [`../evidence/release-phase1-provider-run.json`](../evidence/release-phase1-provider-run.json), SHA-256 `6a53fd13cac4eae9e02ba2e1361881432a98e9cc23e58808ace6b006c1ebf313`.
- **Fresh-run Phase-2 scope:** that stochastic release-SHA run did not propose `rollback_production`; no interception rewrite occurred. It therefore proves fresh authenticated Phase-1 concurrency only, not fresh authenticated Phase 2.
- **Historical authenticated Phase 2:** the preserved historical Google `gemini-3.5-flash-lite` receipt records **1,389 ms** common three-way provider-call overlap, a provider Action Controller `rollback_production` proposal, Mozaik `SafetyGateInterception`, actual `request_corroboration` execution, and provider follow-up.
- **Causal concurrency:** final-runtime stale-plan ablation freezes provider hypotheses. Both planners start at revision 1. Concurrent peers advance the boundary to revision 3, invalidate the proposal, and trigger a fresh conflict-aware replan; serialized peers leave the bounded proposal fresh until it crosses. Eventual evidence is identical.
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

No live production mutation, production readiness, MTTR, generic speedup, simultaneous token generation, or dynamic in-flight prompt update is claimed. Fresh release-SHA Phase-1 evidence and the historical full Phase-2 receipt are kept separate. Deterministic final-runtime tools consume frozen hypotheses without rewriting provider provenance.

## Submission status

The public JigJoy entry is final and healthy under slug `incidentmesh-40ad9c`.

Latest logged-out verification on 2026-09-06 confirms:

- published record timestamp: `2026-09-06T21:52:39.718Z`;
- detail API: HTTP 200;
- gallery detail page: HTTP 200;
- repository: `https://github.com/1337isnot1337/incidentmesh`;
- demo/video: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`;
- deployment field: empty;
- four screenshots present in intended `01 → 04` order and byte-identical to the current repository PNGs;
- public description, concurrency explanation, and demo URL exactly match the frozen field copy in [`submission.md`](submission.md).

The public submission text intentionally predates the fresh release-SHA Phase-1 receipt and still truthfully describes the historical 1,389 ms full-path provider execution. The repository now supplies the newer 1,363 ms release-SHA Phase-1 artifact as additional evidence without rewriting the already-published submission.

See [`submission-surface-audit.md`](submission-surface-audit.md) for the public-surface evidence and screenshot hashes.
