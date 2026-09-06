# Published video shot map

Published demo: `https://www.youtube.com/watch?v=ohw8Ybt_dIM` — 83 seconds.

This file records the final cut. The video was completed before the later fresh release-SHA Phase-1 Gemini capture, so its authenticated-provider shot intentionally uses the historical full-path receipt. The repository now supplements the video with a separate fresh 1,363 ms release-runtime Phase-1 receipt; no video reshoot is required.

| Shot | Visual | Point | Approx. max |
| --- | --- | --- | ---: |
| Problem | `docs/gallery/jigjoy-01-cover.png` | Independent evidence is allowed to change action validity | 9 s |
| Stale-plan race | `docs/evidence/stale-plan-ablation.md` comparison table | plan rev 1; concurrent boundary rev 3 → stale/rewrite/replan; sequential boundary rev 1 → bounded proposal-only probe | 22 s |
| Historical authenticated full execution | `docs/evidence/real-provider-run.md` | Gemini Flash-Lite, **1,389 ms** common three-way provider-call overlap, authenticated rollback/interception/safe-tool/follow-up | 16 s |
| Boundary enforcement | filtered `npm run demo` output | per-attempt snapshot; blocked rollback → `request_corroboration` | 15 s |
| Stress and symmetry | `docs/evidence/safety-stress.md` | 10,000 cases / 40,000 attempts / all critical violation counts zero; approved path still passes | 12 s |
| Close | cover or stale table | “Concurrency … changes which decisions are still valid.” | 8 s |

## Repository evidence added after the video

A later authenticated Google `gemini-3.5-flash-lite` execution against frozen release runtime `e98376445c42ea532cbe4993095911d932a3a57a` records **1,363 ms** of common three-way responder provider-call overlap and 3/3 accepted hypotheses. See [`../evidence/release-phase1-provider-run.md`](../evidence/release-phase1-provider-run.md) and the [verbatim raw JSON](../evidence/release-phase1-provider-run.json).

That newer stochastic run did not propose `rollback_production`, so it is scoped to fresh Phase-1 concurrency rather than the authenticated Phase-2 path shown in the video's historical receipt.

The published video remains accurate: it labels the 1,389 ms artifact as the authenticated execution used for the full rollback/interception/follow-up sequence and does not present it as a fresh release-SHA Phase-2 run.
