# Final submission copy

The first five sections are paste-ready JigJoy fields. They intentionally use plain text because the gallery renders these fields as plain text.

## Project name

IncidentMesh

## Repository URL

https://github.com/1337isnot1337/incidentmesh

## Description

IncidentMesh is a concurrent incident-response prototype built on Mozaik. Trace, Dependency, and Impact investigate the same incident while an Action Controller may already be planning a response.

The key idea is simple: a plan can become wrong while it is still being generated. Every plan remembers the evidence revision it used. If another responder changes the evidence before the plan reaches the action boundary, the old plan is rejected as stale.

The repo includes an authenticated Gemini run with 1,389 ms of three-way provider-call overlap, a controlled concurrent-vs-serialized experiment, real Mozaik interception of rollback_production into request_corroboration, and a 10,000-case safety stress test.

The demo uses proposal-only tools and never modifies production.

## How do the agents run concurrently?

One incident.opened event wakes Trace, Dependency, and Impact together. They run independently and publish evidence into shared IncidentState. In one historical authenticated Gemini Flash-Lite run, all three provider calls were simultaneously in flight for 1,389 ms.

Meanwhile, the Action Controller can already be planning. If it starts at revision 1 and other responders advance the evidence to revision 3 before it finishes, its revision-1 plan is stale and cannot cross the action boundary.

The controlled ablation keeps the incident, eventual evidence, planner, policy, target, and candidate action the same. Only scheduling changes. With concurrent peers, the plan becomes stale before the boundary. With serialized peers, the same bounded proposal is still fresh at that point and can cross as a proposal-only diagnostic. Destructive rollback remains blocked in both cases.

That is why concurrency matters here: it changes which decisions are still valid.

## Demo/video URL

https://www.youtube.com/watch?v=ohw8Ybt_dIM

## Screenshots

Use the four current gallery images, in this order:

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

They cover the action boundary, stale-plan causal ablation, canonical interception receipt, and degradation/fail-closed behavior without relying on screenshots of prose or terminal output.

## Final tagline

Concurrency changes which decisions are still valid.

## Judge verification

Shortest path:

```bash
npm ci
npm run demo
npm run ablation:stale-plan
npm run stress:safety
```

Then see [`../judge-guide.md`](../judge-guide.md) for the five-minute walkthrough or [`../demo.md`](../demo.md) for the video-first verification path.

Core evidence:

1. [`../evidence/real-provider-run.md`](../evidence/real-provider-run.md) — historical authenticated Gemini Flash-Lite run: 1,389 ms common three-way provider-call overlap, Phase-2 rollback proposal, real Mozaik interception, safe tool, provider follow-up.
2. [`../evidence/stale-plan-ablation.md`](../evidence/stale-plan-ablation.md) — same revision-1 plan; concurrent peer progress advances the boundary to revision 3 and invalidates it; serialization leaves it fresh.
3. [`../evidence/safety-stress.md`](../evidence/safety-stress.md) — 10,000 seeded cases / 40,000 attempts / zero unauthorized rollback, bounded, or stale non-safe crossings.
4. [`judge-proof-map.md`](judge-proof-map.md) — claim-by-claim artifact and limitation map.

## Scope

The authenticated receipt is one historical bounded execution captured on its recorded commit; it is not rewritten as final-SHA evidence. The stale-plan counterfactual is a deterministic final-runtime replay of frozen provider hypotheses, not a live provider scheduling experiment. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No production mutation, production-readiness, MTTR, generic speedup, simultaneous-token-generation, or dynamic in-flight prompt-editing claim is made.

## Final resubmission checklist

Before submitting the final revision, verify all of the following in the JigJoy form:

- Project name is `IncidentMesh`.
- Repository URL is `https://github.com/1337isnot1337/incidentmesh`.
- Description is the paste-ready description above, not the older dense gallery copy.
- Concurrency explanation is the paste-ready explanation above.
- Demo/video URL is `https://www.youtube.com/watch?v=ohw8Ybt_dIM`.
- All four current gallery screenshots are attached in the order above.
- No field claims a production integration, MTTR improvement, generic speedup, live final-SHA provider run, or serialized destructive rollback crossing.
- After submitting, open the public entry logged out and verify the repository link, video link, four screenshots, description, and concurrency explanation.
