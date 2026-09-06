# Final release and submission checklist

## Repository gate

From a fresh clone of the exact candidate:

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
npm run replay:visual
node scripts/validate-evidence.mjs docs/evidence/*.{json,md}
git diff --exit-code
git status --short
```

Record the candidate SHA and actual test summary. Required final values:

- 37 focused tests pass;
- 10,000 stress cases / 40,000 independent attempts;
- unauthorized rollback crossings = 0;
- stale non-safe crossings = 0;
- action-policy, attempt-isolation, and snapshot-mutation violations = 0;
- semantic stability = 100 arm executions / zero fixed-boundary and stale-plan mismatches;
- historical authenticated receipt remains Google `gemini-3.5-flash-lite`, 1,389 ms common overlap, captured at its own recorded commit.

## Claim gate

Run [`final-copy-preflight.md`](final-copy-preflight.md) and search the repository for the stale claim fragments listed in the release task. Manually classify historical evidence; never mass-edit it.

Confirm all action language says proposal-only and no text claims production mutation, production readiness, MTTR, dynamic in-flight prompt updates, or serialized destructive rollback.

## Video and images

- Final video: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.
- Verify the YouTube page is public or unlisted, embeddable, and offers the processed 1080p stream.
- Upload screenshots `01 -> 02 -> 03 -> 04` from `docs/gallery/`.
- Verify the first image is the intended cover and every image opens logged out.
- Use [`../demo.md`](../demo.md) as the final watch/run/verify guide; it is no longer a recording script.

## JigJoy resubmission

Paste the Project name, Repository URL, Description, Concurrency explanation, and Demo/video URL from [`submission.md`](submission.md). Upload the four screenshots listed there in the documented order.

The rules allow resubmission until the deadline and state that the latest entry is the one judged. Treat the resubmission itself as a release gate: the existing public entry is not final until its demo URL and final simplified copy are visible on the logged-out detail page.

Logged out, verify:

1. gallery card appears with the correct cover and summary;
2. detail API returns HTTP 200 for the currently listed IncidentMesh slug;
3. detail page renders rather than only returning the web shell;
4. repository, video, and all four screenshots open;
5. description and concurrency explanation match the final copy;
6. the demo field contains `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.

If the gallery index and detail page disagree after resubmission, preserve both responses and use [`submission-surface-audit.md`](submission-surface-audit.md) to record the discrepancy before contacting organizers. Freeze the repository after the public checks pass.
