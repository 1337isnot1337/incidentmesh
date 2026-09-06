# IncidentMesh judge package

Use the final material in this order:

1. [`submission.md`](submission.md) — paste-ready JigJoy fields and exact claim boundary.
2. [`../demo.md`](../demo.md) — concise 80-second narration.
3. [`final-video-shot-list.md`](final-video-shot-list.md) — exact recording sequence and crops.
4. [`judge-proof-map.md`](judge-proof-map.md) — question → artifact → supported claim → limitation.
5. [`final-judge-qa.md`](final-judge-qa.md) — short spoken answers.
6. [`final-copy-preflight.md`](final-copy-preflight.md) — field length and stale-claim checks.
7. [`final-submission-checklist.md`](final-submission-checklist.md) — release, resubmission, and logged-out checks.
8. [`submission-surface-audit.md`](submission-surface-audit.md) — public JigJoy detail-page health.

## Core proof chain

| Layer | Proof |
| --- | --- |
| Real concurrency and Phase 2 | Historical authenticated Gemini Flash-Lite receipt: 1,389 ms three-way overlap, rollback proposal, real interception, safe tool, provider follow-up |
| Causal concurrency | Final-runtime stale-plan ablation: same revision-1 plan; concurrent peers advance the boundary to revision 3 and invalidate it; serialization leaves it fresh |
| Hard safety | Per-action immutable attempts plus 10,000 seeded cases / 40,000 attempts / zero unauthorized rollback, bounded, or stale non-safe crossings |
| Supporting safe-action value | Fixed-boundary ablation: both rollback arms fail closed; complete concurrent conflict enables a targeted safe plan while incomplete sequential evidence requires a hold |

## Claim boundary

- The authenticated receipt is historical evidence from its recorded commit; it is not relabeled as final-SHA output.
- The final-runtime causal replay freezes that receipt's exact hypotheses and changes scheduling deterministically.
- Phase-1 prompts are independent and are not edited while in flight.
- `targeted_canary_probe` and `rollback_production` are proposal-only fixtures.
- No production mutation, production readiness, MTTR, or generic speedup claim is made.

Final line: **Concurrency does not just make IncidentMesh faster. It changes which decisions are still valid.**
