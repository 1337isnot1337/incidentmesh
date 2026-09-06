# JigJoy submission-surface audit

Repository correctness and public submission health are separate release gates.

## Historical blocker

On 2026-09-06, the gallery index briefly listed `incidentmesh-40ad9c` while the detail API returned HTTP 404. A later logged-out check recovered to HTTP 200. This is retained only as historical release-process context; it is not the current state.

## Current logged-out public state

Latest audit on 2026-09-06 confirms:

- Public slug: `incidentmesh-40ad9c`.
- Published record timestamp: `2026-09-06T21:52:39.718Z`.
- `https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c`: HTTP 200.
- `https://build.jigjoy.ai/gallery/incidentmesh-40ad9c`: HTTP 200 logged out.
- Repository field: `https://github.com/1337isnot1337/incidentmesh`, HTTP 200.
- Demo/video field: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`, HTTP 200.
- Deployment field: empty.
- Four screenshots are present in the intended `01 -> 04` order.
- Public Description is exactly 781 characters and matches the `Description` section in [`submission.md`](submission.md) byte-for-byte as text.
- Public Concurrency explanation is exactly 965 characters and matches the `How do the agents run concurrently?` section in [`submission.md`](submission.md) byte-for-byte as text.
- Public Demo/video URL exactly matches the `Demo/video URL` section in [`submission.md`](submission.md).

The public entry is therefore the **final verified submission state**. No further resubmission is required for the repository-only evidence additions that landed afterward.

## Screenshot byte verification

The four current public CDN image bytes match the repository PNGs exactly:

| Order | Repository file | SHA-256 | Public bytes match |
| ---: | --- | --- | --- |
| 1 | `docs/gallery/jigjoy-01-cover.png` | `8b7f720b6a7534460709da1d5c2821f3d776e1c19f4531bfdec931fd88ec8701` | yes |
| 2 | `docs/gallery/jigjoy-02-ablation.png` | `b319dd886cdc104acb07f2ade79220ae4a6d8a847695140710dbea774f0ec1ee` | yes |
| 3 | `docs/gallery/jigjoy-03-interception.png` | `c18e1c0b42c5f4ab5373fccb2a67b525a653d236bf9adf28c31d8edc7c1a1faf` | yes |
| 4 | `docs/gallery/jigjoy-04-safety-proof.png` | `790cfca9811815e3ecab725478cc27c6662be73ff1f1de463464466e088b7858` | yes |

All four are 1600 × 900 in the submitted package.

## Relationship to newer repository evidence

The published Description and Concurrency fields intentionally refer to the historical authenticated Gemini run with **1,389 ms** common three-way provider-call overlap. That statement remains true and is the same full-path receipt that records the authenticated `rollback_production → SafetyGateInterception → request_corroboration → provider follow-up` sequence.

After the public submission was finalized, the repository added a separate authenticated Gemini attempt against frozen release runtime `e98376445c42ea532cbe4993095911d932a3a57a`. That newer artifact records **1,363 ms** common three-way Phase-1 provider-call overlap and 3/3 accepted hypotheses, but it did not propose `rollback_production`, so it is not presented as fresh authenticated Phase 2.

Those repository-only evidence additions do not require rewriting the already-published JigJoy text. The public copy remains a truthful frozen submission snapshot; the repository now provides stronger supplemental release-SHA evidence with explicit provenance boundaries.

## Current verification procedure

To recheck the public state:

1. fetch `https://hackathon-api.jigjoy.ai/gallery` and confirm `incidentmesh-40ad9c` is listed;
2. request `https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c` and require HTTP 200;
3. open `https://build.jigjoy.ai/gallery/incidentmesh-40ad9c` logged out;
4. verify repository, demo/video, all four screenshots, and first-image cover;
5. compare the public Description, Concurrency explanation, and Demo field against [`submission.md`](submission.md);
6. if screenshots are rechecked, compare their SHA-256 values against the table above.

Diagnostics:

```bash
curl -fsS https://hackathon-api.jigjoy.ai/gallery
curl -fsS https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c
```

If a future audit finds the index healthy but the detail endpoint broken, preserve the exact responses and contact organizers without speculating about the backend cause:

- Discord: https://discord.gg/dvxY9J2kWX
- Email: miodrag.vilotijevic@jigjoy.ai

Include project name, slug, repository state, audit time, index response, and detail response.
