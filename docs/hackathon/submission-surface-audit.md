# JigJoy submission-surface audit

Repository correctness and public submission health are separate release gates.

## Historical blocker

On 2026-09-06, the gallery index briefly listed `incidentmesh-40ad9c` while the detail API returned HTTP 404. A later logged-out check recovered to HTTP 200. Keep the index/detail consistency check in the release process, but do not assume the old failure still applies.

## Current logged-out public state

Live audit on 2026-09-06:

- Public slug: `incidentmesh-40ad9c`.
- `https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c` returns HTTP 200.
- `https://build.jigjoy.ai/gallery/incidentmesh-40ad9c` renders logged out.
- Repository field is `https://github.com/1337isnot1337/incidentmesh` and opens successfully.
- Four screenshots are present in the intended `01 -> 04` order.
- The four public screenshot bytes exactly match the four current repository PNG files by SHA-256/byte comparison; all are 1600x900.
- The current public description and concurrency explanation are the older dense versions from the prior resubmission.
- The current public `demo` field is empty.
- The current public `deploy` field is empty.

Therefore the existing gallery record is healthy but **not the final submission state**. It still needs one final resubmission with the approved video URL and simplified copy.

## Ready-to-submit target

Use [`submission.md`](submission.md) as the source of truth for the final form values:

- Project: `IncidentMesh`
- Repository: `https://github.com/1337isnot1337/incidentmesh`
- Description: 781 characters
- Concurrency explanation: 965 characters
- Demo/video URL: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`
- Screenshots: `jigjoy-01-cover.png` through `jigjoy-04-safety-proof.png`, in order

The final video is live and embeddable on YouTube and has a processed 1080p stream. The repository and YouTube URL both return HTTP 200 logged out.

## Final recovery check after resubmission

After submitting the final revision:

1. fetch `https://hackathon-api.jigjoy.ai/gallery`;
2. discover the currently listed IncidentMesh slug rather than assuming it is unchanged;
3. request `https://hackathon-api.jigjoy.ai/gallery/<slug>` and require HTTP 200 with an IncidentMesh entry;
4. open `https://build.jigjoy.ai/gallery/<slug>` logged out;
5. verify repository, video, all four screenshots, and first-image cover;
6. compare the public description and concurrency strings against [`submission.md`](submission.md);
7. require the public demo field to equal `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.

Diagnostics:

```bash
curl -fsS https://hackathon-api.jigjoy.ai/gallery
curl -i https://hackathon-api.jigjoy.ai/gallery/<current-slug>
```

If the index is healthy but the detail endpoint is broken after the final resubmission, preserve the exact responses and contact organizers without speculating about the backend cause:

- Discord: https://discord.gg/dvxY9J2kWX
- Email: miodrag.vilotijevic@jigjoy.ai

Include project name, discovered slug, final repository SHA, submission time, index response, and detail response.
