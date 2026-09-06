# JigJoy submission-surface audit

Repository correctness and public submission health are separate release gates.

## Previously observed blocker

On 2026-09-06, the gallery index listed `incidentmesh-40ad9c`, while `GET https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c` returned HTTP 404. Comparison entries returned healthy detail records. Do not assume that stale slug is still authoritative.

## Current public health

A later logged-out check on 2026-09-06 returned HTTP 200 for the detail API and public page at `incidentmesh-40ad9c`. The record contained the repository URL and all four submitted screenshots.

## Final verified resubmission

The final entry was published at `2026-09-06T15:23:15.057Z` after `master` advanced to `ef0c78eb27e4ab0aa514300d1764c2344f2ebd83` and CI passed.

- Project and repository are unchanged: `IncidentMesh` and `https://github.com/1337isnot1337/incidentmesh`.
- Description is exactly 1,210 characters and concurrency explanation is exactly 1,490 characters; both byte-for-byte text comparisons against [`submission.md`](submission.md) passed.
- No demo or deployment URL existed before resubmission; both remain empty.
- Four 1600×900 screenshots are public in the intended `01 → 04` order. Cache-busted downloads exactly matched the local files by SHA-256 and byte comparison.
- Logged out, the gallery index card uses `jigjoy-01-cover.png`; the detail page renders the new stale-plan and 1,389 ms authenticated-overlap claims; all four images and the repository link are present.

## Final recovery check

After resubmission:

1. fetch `https://hackathon-api.jigjoy.ai/gallery`;
2. discover the currently listed IncidentMesh slug;
3. request `https://hackathon-api.jigjoy.ai/gallery/<slug>` and require HTTP 200 with an IncidentMesh entry;
4. open `https://build.jigjoy.ai/gallery/<slug>` logged out;
5. verify repository, video, all screenshots, first-image cover, description, and concurrency copy.

Diagnostics:

```bash
curl -fsS https://hackathon-api.jigjoy.ai/gallery
curl -i https://hackathon-api.jigjoy.ai/gallery/<current-slug>
```

If the index is healthy but the detail endpoint remains 404 after one final resubmission, preserve exact HTTP responses and contact organizers without speculating about the backend cause:

- Discord: https://discord.gg/dvxY9J2kWX
- Email: miodrag.vilotijevic@jigjoy.ai

Include project name, discovered slug, final repository SHA, submission time, index response, and detail response.
