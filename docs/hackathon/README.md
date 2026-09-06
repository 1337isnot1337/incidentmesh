# IncidentMesh judge package

Start with **[IncidentMesh in 5 minutes](../judge-guide.md)**. It gives the shortest runnable path through the project and links each claim to its evidence.

## Core material

1. [`../judge-guide.md`](../judge-guide.md) — five-minute walkthrough: demo → stale-plan proof → real Gemini receipt → stress result.
2. [`submission.md`](submission.md) — paste-ready JigJoy description and concurrency explanation.
3. [`judge-proof-map.md`](judge-proof-map.md) — exact claim → artifact → limitation map.
4. [`../implementation.md`](../implementation.md) — full architecture and Mozaik primitive map.

## The proof chain

| Question | Answer | Evidence |
| --- | --- | --- |
| Did real model requests overlap? | Yes: three authenticated Gemini responder calls have **1,389 ms** of common provider-call overlap. | [`../evidence/real-provider-run.md`](../evidence/real-provider-run.md) |
| Does concurrency change behavior? | Yes: the same revision-1 plan is stale under concurrent peer progress and still fresh at the serialized boundary. | [`../evidence/stale-plan-ablation.md`](../evidence/stale-plan-ablation.md) |
| Does the action boundary really enforce the decision? | Yes: `rollback_production` is intercepted and rewritten to `request_corroboration`. | real-provider receipt + canonical replay |
| Is safety only demonstrated once? | No: the seeded stress receipt covers 10,000 cases / 40,000 immutable attempts with zero recorded unauthorized rollback or stale non-safe crossings. | [`../evidence/safety-stress.md`](../evidence/safety-stress.md) |

**Core idea:** concurrency changes which decisions are still valid.

## Submission operations and archive

These files preserve the release/submission process. They are not required to understand the project:

- [`final-judge-qa.md`](final-judge-qa.md) — short spoken answers.
- [`final-copy-preflight.md`](final-copy-preflight.md) — field-length and claim checks.
- [`final-submission-checklist.md`](final-submission-checklist.md) — release/resubmission checklist.
- [`submission-surface-audit.md`](submission-surface-audit.md) — public JigJoy page verification history.
- [`release-notes.md`](release-notes.md) — release summary.
- [`status.md`](status.md) — frozen release status.
- [`rules.md`](rules.md) — captured hackathon requirements.

## Claim boundary

- The authenticated provider receipt is historical evidence from its recorded source commit; it is not relabeled as final-SHA provider output.
- The final-runtime stale-plan counterfactual replays that receipt's frozen hypotheses under deterministic schedules.
- Phase-1 prompts are independent and are not edited while in flight.
- `targeted_canary_probe` and `rollback_production` are proposal-only fixtures.
- No production mutation, production-readiness, MTTR, generic speedup, or simultaneous-token-generation claim is made.
