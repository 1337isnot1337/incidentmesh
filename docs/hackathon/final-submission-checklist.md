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

- Record from [`../demo.md`](../demo.md), roughly 80 seconds.
- Upload screenshots `01 → 02 → 03 → 04`.
- Preserve any existing demo/deployment URL.
- Verify the first image is the intended cover and every link is public.

## JigJoy resubmission

Paste only the Project name, Repository URL, Description, and Concurrency sections from [`submission.md`](submission.md). Discover the resulting slug from the public gallery index rather than assuming the prior slug.

Logged out, verify:

1. gallery card appears with the correct cover and summary;
2. detail API returns HTTP 200 for the discovered slug;
3. detail page renders rather than only returning the web shell;
4. repository, video, and screenshots open;
5. description and concurrency explanation match the final copy.

If the index lists IncidentMesh but its detail API remains 404, preserve both responses and escalate using [`submission-surface-audit.md`](submission-surface-audit.md). Freeze after the public checks pass.
