# Final submission copy

The first four sections are paste-ready JigJoy fields. They intentionally use plain text because the gallery renders these fields as plain text.

## Project name

IncidentMesh

## Repository URL

https://github.com/1337isnot1337/incidentmesh

## Description

IncidentMesh proves concurrent incident response three ways: authenticated Gemini calls overlap for 1,389 ms; a controlled stale-plan ablation shows concurrency can invalidate in-flight planning; Mozaik intercepts blocked rollback proposals.

Trace, Dependency, and Impact investigate independently while an Action Controller may already be planning. Every accepted action-relevant mutation advances a decision revision. Each mitigation proposal carries the revision and evidence it reasoned over. At the boundary, IncidentMesh freezes a per-action attempt, rejects stale work, and applies a risk-specific policy before any tool can cross.

In the controlled race, both planners start at revision 1 with the same authenticated-provider-derived evidence, policy, bounded candidate action, and configured planning boundary. Concurrent peers advance state to revision 3 while the planner runs, so Mozaik rewrites the stale proposal to request_corroboration and starts a fresh replan. With serialized peers, the same bounded proposal is still fresh and executes as a proposal-only diagnostic before the same later conflict appears. Destructive rollback remains fail-closed in both arms; no tool mutates production.

## How do the agents run concurrently?

One incident.opened event wakes three independent Mozaik participants: Trace, Dependency, and Impact. None waits for another responder. Each runs its own lifecycle and publishes one structured hypothesis through semantic events into shared typed IncidentState. The historical authenticated Google gemini-3.5-flash-lite receipt records all three real inference windows simultaneously in flight for 1,389 ms, then records a real Phase-2 rollback proposal, SafetyGateInterception, request_corroboration tool execution, and provider follow-up.

The Action Controller is separate and can plan from a frozen revision while responders continue. npm run ablation:stale-plan holds incident, eventual evidence, confidence, planner, policy, target, candidate action, and planner-fixture duration constant. Only peer-evidence scheduling changes. Concurrent evidence moves revision 1 to 3 before proposal return, invalidating the bounded action; serialized evidence leaves it fresh until after it crosses. Running prompts are not edited in flight. Correctness comes from the immutable revision check at each action boundary.

The supporting fixed-boundary ablation keeps both rollback arms fail-closed: concurrent scheduling sees complete conflict and can choose targeted corroboration, while sequential scheduling sees missing required evidence and must hold. The 10,000-case seeded stress records zero unauthorized rollback crossings and zero stale non-safe crossings across 40,000 immutable attempts.

## Demo/video URL

Preserve the currently submitted demo/video URL when resubmitting. If none exists, add the final public recording after it is uploaded.

## Final tagline

Concurrency does not just make IncidentMesh faster. It changes which decisions are still valid.

## Judge verification

```bash
npm ci
npm run verify
npm run ablation:stale-plan
npm run ablation
npm run ablation:provider-derived
npm run stress:safety
npm run stability:semantic
npm run degradation
npm run replay:visual
```

The shortest proof path is:

1. [`../evidence/real-provider-run.md`](../evidence/real-provider-run.md) — authenticated Gemini Flash-Lite: 1,389 ms three-way overlap, real Phase-2 rollback proposal, real Mozaik interception, safe tool, provider follow-up.
2. [`../evidence/stale-plan-ablation.md`](../evidence/stale-plan-ablation.md) — same revision-1 plan; concurrency advances the boundary to revision 3 and invalidates the bounded proposal; serialization leaves it fresh.
3. [`../evidence/safety-stress.md`](../evidence/safety-stress.md) — 10,000 seeded cases / 40,000 attempts / zero unauthorized rollback, bounded, or stale non-safe crossings.
4. [`../evidence/safe-action-ablation.md`](../evidence/safe-action-ablation.md) — both rollback arms fail closed; concurrency changes the justified safe plan available at the configured boundary.

## Scope

The authenticated receipt is one historical bounded execution captured on its recorded commit; it is not rewritten as final-SHA evidence. The stale-plan and other counterfactuals are deterministic final-runtime replays, not live provider scheduling experiments. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No production mutation, production-readiness, MTTR, or generic speedup claim is made.
