# IncidentMesh judge package

Start with **[IncidentMesh in 5 minutes](../judge-guide.md)**. It gives the shortest runnable path through the project and links each claim to its evidence.

## Core material

1. [`../judge-guide.md`](../judge-guide.md) — five-minute walkthrough: demo → stale-plan proof → fresh release-SHA Gemini evidence → historical full provider path → stress result.
2. [`submission.md`](submission.md) — exact published JigJoy field copy plus the repository-only evidence addendum that landed afterward.
3. [`judge-proof-map.md`](judge-proof-map.md) — exact claim → artifact → limitation map.
4. [`../implementation.md`](../implementation.md) — full architecture and Mozaik primitive map.

## The proof chain

| Question | Answer | Evidence |
| --- | --- | --- |
| Did real model requests overlap on the frozen release runtime? | Yes: a fresh authenticated Gemini run against `e98376445c42ea532cbe4993095911d932a3a57a` records **1,363 ms** of common three-way responder provider-call overlap and 3/3 accepted hypotheses. | [`../evidence/release-phase1-provider-run.md`](../evidence/release-phase1-provider-run.md) + [verbatim raw JSON](../evidence/release-phase1-provider-run.json) |
| Did an authenticated provider run traverse the Phase-2 rollback interception path? | Yes, in the separate historical full receipt: **1,389 ms** common three-way overlap, provider `rollback_production` proposal, real Mozaik rewrite to `request_corroboration`, safe-tool execution, and provider follow-up. | [`../evidence/real-provider-run.md`](../evidence/real-provider-run.md) + JSON |
| Does concurrency change behavior? | Yes: the same revision-1 plan is stale under concurrent peer progress and still fresh at the serialized boundary. | [`../evidence/stale-plan-ablation.md`](../evidence/stale-plan-ablation.md) |
| Does the action boundary really enforce the decision? | Yes: `rollback_production` is intercepted and rewritten to `request_corroboration` in the canonical replay and historical authenticated provider run. | historical provider receipt + canonical replay |
| Is safety only demonstrated once? | No: the seeded stress receipt covers 10,000 cases / 40,000 immutable attempts with zero recorded unauthorized rollback or stale non-safe crossings. | [`../evidence/safety-stress.md`](../evidence/safety-stress.md) |

**Core idea:** concurrency changes which decisions are still valid.

## Submission operations and archive

These files preserve the release/submission process and are kept current where they describe present state:

- [`final-judge-qa.md`](final-judge-qa.md) — short spoken answers using the current two-receipt evidence model.
- [`final-copy-preflight.md`](final-copy-preflight.md) — verifies the frozen public submission copy and the current repository evidence package.
- [`final-submission-checklist.md`](final-submission-checklist.md) — final repository/public-surface verification checklist.
- [`submission-surface-audit.md`](submission-surface-audit.md) — public JigJoy page verification history and latest confirmed state.
- [`release-notes.md`](release-notes.md) — final runtime plus post-freeze evidence additions.
- [`status.md`](status.md) — current release/evidence/submission status.
- [`rules.md`](rules.md) — captured hackathon requirements.

## Claim boundary

- The fresh release-SHA receipt proves authenticated **Phase-1 provider-call overlap** against frozen runtime `e983764...`; that stochastic run did not propose `rollback_production`, so it does not certify fresh authenticated Phase 2.
- The historical full receipt remains the authenticated evidence for `rollback_production → SafetyGateInterception → request_corroboration → provider follow-up` on its own recorded commit.
- The final-runtime stale-plan counterfactual replays frozen provider hypotheses under deterministic schedules; it is not a live provider scheduling experiment.
- Phase-1 prompts are independent and are not edited while in flight.
- `targeted_canary_probe` and `rollback_production` are proposal-only fixtures.
- No production mutation, production-readiness, MTTR, generic speedup, or simultaneous-token-generation claim is made.
