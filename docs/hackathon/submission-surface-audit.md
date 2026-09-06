# JigJoy submission-surface audit

Repository correctness and public submission health are separate release gates.

## Previously observed blocker

On 2026-09-06, the gallery index listed `incidentmesh-40ad9c`, while `GET https://hackathon-api.jigjoy.ai/gallery/incidentmesh-40ad9c` returned HTTP 404. Comparison entries returned healthy detail records. Do not assume that stale slug is still authoritative.

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
