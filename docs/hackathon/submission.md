# Published JigJoy submission copy

The first five sections below are the exact field values currently published on JigJoy under `incidentmesh-40ad9c`. They intentionally remain frozen so repository documentation cannot silently diverge from the public entry. The gallery renders these fields as plain text.

The public text predates the later release-SHA Phase-1 Gemini capture. Its historical 1,389 ms provider claim remains true; the newer 1,363 ms release-runtime evidence is documented separately in the repository and is not retroactively inserted into these published fields.

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

The published entry uses these four repository images, in this order:

1. `docs/gallery/jigjoy-01-cover.png`
2. `docs/gallery/jigjoy-02-ablation.png`
3. `docs/gallery/jigjoy-03-interception.png`
4. `docs/gallery/jigjoy-04-safety-proof.png`

They cover the action boundary, stale-plan causal ablation, canonical interception receipt, and degradation/fail-closed behavior without relying on screenshots of prose or terminal output. The latest public-surface audit confirms the CDN bytes match these files exactly.

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

Current core evidence:

1. [`../evidence/release-phase1-provider-run.md`](../evidence/release-phase1-provider-run.md) + [raw JSON](../evidence/release-phase1-provider-run.json) — fresh authenticated Google Gemini Flash-Lite run against frozen runtime `e98376445c42ea532cbe4993095911d932a3a57a`: **1,363 ms** common three-way responder provider-call overlap, 3/3 accepted hypotheses, blocked gate. This run did not propose `rollback_production`, so it is scoped to Phase 1.
2. [`../evidence/real-provider-run.md`](../evidence/real-provider-run.md) — historical authenticated Gemini Flash-Lite full-path run: **1,389 ms** common three-way provider-call overlap, Phase-2 rollback proposal, real Mozaik interception, safe tool, provider follow-up.
3. [`../evidence/stale-plan-ablation.md`](../evidence/stale-plan-ablation.md) — same revision-1 plan; concurrent peer progress advances the boundary to revision 3 and invalidates it; serialization leaves it fresh.
4. [`../evidence/safety-stress.md`](../evidence/safety-stress.md) — 10,000 seeded cases / 40,000 attempts / zero unauthorized rollback, bounded, or stale non-safe crossings.
5. [`judge-proof-map.md`](judge-proof-map.md) — claim-by-claim artifact and limitation map.

## Scope

The repository has two distinct authenticated provider artifacts:

- the fresh release-SHA capture proves authenticated Phase-1 provider-call overlap on `e983764...` but does not prove fresh authenticated Phase-2 interception;
- the historical full receipt proves provider-backed rollback proposal/interception/safe-tool/follow-up on its own recorded commit.

The stale-plan counterfactual is a deterministic final-runtime replay of frozen provider hypotheses, not a live provider scheduling experiment. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No production mutation, production-readiness, MTTR, generic speedup, simultaneous-token-generation, or dynamic in-flight prompt-editing claim is made.

## Published submission state

Latest logged-out verification on 2026-09-06 confirms:

- slug: `incidentmesh-40ad9c`;
- published record timestamp: `2026-09-06T21:52:39.718Z`;
- repository field: `https://github.com/1337isnot1337/incidentmesh`;
- Description and Concurrency fields exactly match the frozen sections above;
- Demo/video URL: `https://www.youtube.com/watch?v=ohw8Ybt_dIM`;
- deployment field: empty;
- all four screenshots are present in the order above and match repository bytes.

No resubmission is required merely to expose newer repository evidence. If the public JigJoy fields are intentionally changed later, update this frozen copy only after verifying the new logged-out public record.
