<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/wordmark-dark.svg" />
    <img src="docs/assets/wordmark.svg" width="520" alt="IncidentMesh" />
  </picture>
</h1>

### Concurrent incident response. Evidence before action.

Independent responders share evidence that can change a production-action proposal before it executes.

<picture>
  <source media="(max-width: 600px)" srcset="docs/assets/hero-narrow.svg" />
  <img src="docs/assets/hero.svg" alt="Canonical demo: conflicting shared evidence blocks rollback_production; Mozaik rewrites the call to request_corroboration." width="960" />
</picture>

[Quick start](#quick-start) · [Causal proof](#causal-concurrency-ablation) · [Replay](#demo)

## Why IncidentMesh?

Trace, Dependency, and Impact investigate concurrently and share their findings while peers are still working. The Safety Gate uses that evidence to decide whether a pending rollback may proceed. **Parallel work changes the action, not just the time it takes.**

The default demo uses deterministic evidence and Mozaik's real function-call loop. Action tools are proposal-only; no production infrastructure is changed.

## Quick start

Node.js 20+ · No provider key required for the default demo.

```bash
git clone https://github.com/1337isnot1337/incidentmesh.git
cd incidentmesh
npm ci
npm run demo
```

[![CI](https://github.com/1337isnot1337/incidentmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/1337isnot1337/incidentmesh/actions/workflows/ci.yml) ![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-435461) ![Mozaik 4.0.5](https://img.shields.io/badge/Mozaik-4.0.5-435461)

## Causal concurrency ablation

**Same evidence. Same policy. Different action at the boundary.**

`npm run ablation` changes only evidence scheduling. The incident, three evidence items, confidence values, gate rule, proposed action, and configured 205 ms action-boundary timer stay constant.

| At the action boundary | Concurrent | Sequential |
| --- | --- | --- |
| Available hypotheses / contradictions | 3 / 2 | 1 / 0 |
| Gate decision | **BLOCKED** | **APPROVED** |
| Mozaik intercepts rollback | Yes | No |
| Tool executed | `request_corroboration` | `rollback_production` |

Both schedules eventually reach the **same three hypotheses, two contradictions, and blocked gate**. In the sequential case, the contradictory evidence arrives after the action has crossed the boundary. The rollback tool is proposal-only; this is a demonstrated control-flow escape, not a real production rollback.

The 205 ms value is a configured JavaScript timer, not a hard real-time guarantee. Host scheduling may delay the callback; `action.attemptedAtMs` records its observed time. The causal separation comes from the interval between evidence arrivals in the two schedules, not one exact timer tick.

## Demo

The replay below is generated from a canonical run. Responder bars show measured overlap; the event ledger shows what followed the boundary decision.

[![Canonical replay: concurrent responder spans, blocked gate, interception, safe tool execution, canary replan, and corroboration](docs/evidence/replay.svg)](docs/evidence/replay.svg)

[Open full-size replay](docs/evidence/replay.svg) · [Inspect source report](docs/evidence/replay.json) · [90-second demo guide](docs/demo.md)

```bash
npm run replay:visual  # generate an SVG and its source JSON from one run
```

Timing varies by machine and scheduler load. The canonical fixture produces three overlapping responder pairs, three hypotheses, two contradictions, a blocked gate, a canary replan, and two follow-up evidence responses.

## How it works

1. **Investigate together.** One `incident.opened` event wakes Trace, Dependency, and Impact. Each has independent handlers and a lifecycle.
2. **Share evidence as it arrives.** Typed hypotheses enter `IncidentState`; runtime handlers observe peer findings while investigations remain active.
3. **Evaluate at the boundary.** The Safety Gate aggregates confidence and root-cause disagreement from the evidence available when the callback runs.
4. **Intercept and adapt.** When blocked, `SafetyGateInterception` rewrites `rollback_production` to `request_corroboration`. Mozaik executes that tool; deterministic application logic then replans to a canary and requests follow-up evidence.

Built directly on **Mozaik 4.0.5**: typed runtime state, independent participants, semantic events, situation handlers, and function-call interception.

[Architecture and Mozaik primitive map](docs/implementation.md#how-it-works) · [Claim-by-claim verification](docs/implementation.md#judge-verification)

## Safety and degradation

`npm run degradation` makes Dependency time out before publishing a hypothesis. That failure becomes explicit shared state before the action boundary. The gate fails closed, rollback is intercepted, and the surviving responders continue with a canary plan and Trace corroboration.

This guarantee applies to **known degradation recorded before evaluation**. Evidence that has merely not arrived is evaluated under the normal available-evidence policy—as the sequential ablation shows. There is no claim of generic missing-evidence safety or dynamic-agent recovery.

## Model and provider mode

The default path uses scripted evidence and controlled delays. Optional model mode collects structured Phase-1 hypotheses, then starts a separate Phase-2 Action Controller with all shared hypotheses and the gate decision in its prompt.

```bash
OPENAI_API_KEY=... RUN_MODEL=1 npm run dev
```

Phase-1 peer observations happen in runtime handlers; peer hypotheses are not injected into those models. The Phase-2 controller receives the aggregate evidence. Its rollback calls pass through the same interception handler, and a rewritten tool result returns to the model loop.

A scripted `InferenceRunner` integration test exercises this lifecycle through Mozaik's real loop. **No authenticated provider execution is claimed or committed.**

[Provider setup, failure behavior, and evidence capture](docs/implementation.md#deterministic-and-provider-backed-modes)

## Verification

```bash
npm run verify       # typecheck, 12 tests, production build, built smoke check
npm run ablation     # causal action-boundary comparison
npm run degradation  # explicit responder timeout
```

The tests cover overlap, active peer observations, shared-state gating, adaptive follow-up, interception and executable rewriting, event-driven completion, structured model hypotheses, timeout snapshots, and the causal ablation.

<details>
<summary>Additional commands and supporting measurements</summary>

```bash
npm run benchmark                # measured overlap / latency proxy
npm run replay                   # JSON event / report replay
npm run demo:built               # run the committed production build
npm run provider:evidence:check  # inspect credential availability; no inference
```

The deterministic fixture's approximately 2.3× overlap/latency proxy divides summed responder durations by concurrent wall time. It does not establish better reasoning, throughput, MTTR, or production performance. [Measurement details](docs/implementation.md#measured-overlap).

`dist/` is intentionally committed so the built JavaScript can be inspected and run; `src/` remains the source of truth.

</details>

## Scope and limitations

IncidentMesh is an incident-response prototype with deterministic fixtures, not a production integration. Live telemetry adapters, paging integrations, and automatic production actions are outside its scope. Canary replanning in the default demo is deterministic application logic, not model reconsideration.

The software remains **UNLICENSED**; no open-source license has been selected.

## Hackathon

Built for the JigJoy × daily.dev × Hyperskill concurrent-agents hackathon. [Rules, submission copy, and audit history](docs/hackathon/) are preserved separately. Official competition submission remains an operator action.
