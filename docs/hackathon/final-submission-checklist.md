# Final release and submission verification checklist

The JigJoy entry is already published and verified. Use this file to re-verify repository/public state, or as the release gate only if an intentional resubmission is later authorized.

## Repository gate

From a fresh clone of the current candidate:

```bash
npm ci
npm run verify
npm run demo
npm run ablation
npm run ablation:stale-plan
npm run ablation:provider-derived
npm run stress:safety
npm run stability:semantic
npm run degradation
npm run replay
npm run replay:visual
node scripts/validate-evidence.mjs docs/evidence/real-provider-run.json docs/evidence/real-provider-run.md
git diff --exit-code
git status --short
```

Do **not** run the full Phase-2 validator blindly over every JSON file with `docs/evidence/*.{json,md}`. The fresh release-SHA raw receipt is deliberately a **Phase-1-scoped** artifact and the full authenticated validator correctly rejects it for incomplete Phase 2; the release manifest has its own schema. [`final-copy-preflight.md`](final-copy-preflight.md) verifies the scoped receipt's hash, source SHA, provider/model, accepted hypotheses, gate, and 1,363 ms inference-event overlap without weakening the full Phase-2 validator.

Required values:

- 37 focused tests pass;
- 10,000 stress cases / 40,000 independent attempts;
- unauthorized rollback crossings = 0;
- stale non-safe crossings = 0;
- action-policy, attempt-isolation, and snapshot-mutation violations = 0;
- semantic stability = 100 arm executions / zero fixed-boundary and stale-plan mismatches;
- fresh authenticated release-SHA Phase 1: Google `gemini-3.5-flash-lite`, source `e98376445c42ea532cbe4993095911d932a3a57a`, **1,363 ms** common provider-call overlap, 3/3 accepted hypotheses, blocked gate, no authenticated interception claim;
- fresh raw JSON SHA-256 = `6a53fd13cac4eae9e02ba2e1361881432a98e9cc23e58808ace6b006c1ebf313`;
- historical full authenticated receipt remains Google `gemini-3.5-flash-lite`, **1,389 ms** common provider-call overlap, captured at its own recorded commit, with rollback proposal/interception/safe-tool/follow-up;
- post-freeze diff from `e983764...` contains documentation/evidence only.

## Claim gate

Run [`final-copy-preflight.md`](final-copy-preflight.md). Confirm the repository keeps the two authenticated provider artifacts separate:

- release-SHA fresh Phase 1 → 1,363 ms overlap, no `rollback_production` proposal/interception;
- historical full path → 1,389 ms overlap plus authenticated Phase-2 interception/follow-up.

Confirm all action language says proposal-only and no text claims production mutation, production readiness, MTTR, simultaneous token generation, dynamic in-flight prompt updates, fresh release-SHA Phase-2 interception, or serialized destructive rollback crossing.

## Video and images

- Published video: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.
- Four screenshots are `01 -> 02 -> 03 -> 04` from `docs/gallery/`.
- The first image is the intended cover.
- Latest logged-out audit confirms the public screenshot bytes are byte-identical to the repository PNGs.
- Use [`../demo.md`](../demo.md) as the final watch/run/verify guide; [`final-video-shot-list.md`](final-video-shot-list.md) is the archived shot map for the already-published 83-second cut.

## Current JigJoy public state

Verified logged out on 2026-09-06:

- slug: `incidentmesh-40ad9c`;
- published record timestamp: `2026-09-06T21:52:39.718Z`;
- detail API: HTTP 200;
- gallery detail page: HTTP 200;
- repository field: `https://github.com/1337isnot1337/incidentmesh`;
- demo field: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`;
- deployment field: empty;
- four screenshots present in the intended order;
- description and concurrency explanation exactly match the frozen field copy in [`submission.md`](submission.md).

No resubmission is required to expose the newer release-SHA Phase-1 receipt: it is repository evidence added after the public submission and does not invalidate the still-true historical provider claim in the published fields.

## If an intentional resubmission is later authorized

Re-run the repository gate and [`final-copy-preflight.md`](final-copy-preflight.md), then verify the public detail record rather than relying on the success toast. Preserve the exact published field copy in `submission.md` until the public entry is actually changed. After any real resubmission, refresh [`submission-surface-audit.md`](submission-surface-audit.md) from the logged-out API/page before freezing again.
