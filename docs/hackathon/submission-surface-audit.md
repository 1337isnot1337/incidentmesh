# JigJoy submission-surface audit

Repository correctness and public submission health are separate release gates.

## Previously observed blocker

On 2026-09-06, the gallery index listed `incidentmesh-40ad9c`, while `GET https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c` returned HTTP 404. Comparison entries returned healthy detail records. Do not assume that stale slug is still authoritative.

## Current public health

A later logged-out check on 2026-09-06 returned HTTP 200 for the detail API and public page at `incidentmesh-40ad9c`. The record contained the repository URL and all four submitted screenshots. Its description and concurrency fields still predate the final integration, so this recovery does not replace the final post-merge resubmission check.

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
