<img align="right" src="docs/assets/astra-credit.svg" width="148" height="44" alt="developed with gpt-6-astra" />

<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/wordmark-dark.svg" />
    <img src="docs/assets/wordmark.svg" width="520" alt="IncidentMesh" />
  </picture>
</h1>

### Concurrent response that knows when a plan is stale.

Independent responders keep investigating while an Action Controller plans. Every mitigation proposal carries the evidence revision it reasoned over; the action boundary rejects stale plans before any tool can cross.

<picture>
  <source media="(max-width: 600px)" srcset="docs/assets/hero-narrow.svg" />
  <img src="docs/assets/hero.svg" alt="Canonical demo: conflicting shared evidence blocks rollback_production; Mozaik rewrites the call to request_corroboration." width="960" />
</picture>

[Quick start](#quick-start) · [Proof stack](#proof-stack) · [Stale-plan proof](#causal-concurrency-stale-plan-ablation) · [Replay](#demo)

## Why IncidentMesh?

Trace, Dependency, and Impact investigate concurrently and publish authoritative evidence while the separate Action Controller may already be planning. Each accepted action-relevant mutation advances a monotonic `decisionRevision`. A plan started at revision N cannot silently act after peer evidence advances the state to N+1.

This is optimistic concurrency control for agent plans. At the boundary, IncidentMesh freezes a per-attempt snapshot, validates plan and producer provenance, checks revision freshness, and applies an action-specific policy. Safe corroboration remains available; a bounded diagnostic probe needs fresh strong non-conflicting evidence; destructive rollback still requires complete consistent high-confidence evidence from every required responder.

## Quick start

Node.js 20+ · No provider key required for the default demo.

```bash
git clone https://github.com/1337isnot1337/incidentmesh.git
cd incidentmesh
npm ci
npm run demo
```

[![CI](https://github.com/1337isnot1337/incidentmesh/actions/workflows/ci.yml/badge.svg)](https://github.com/1337isnot1337/incidentmesh/actions/workflows/ci.yml) ![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-435461) ![Mozaik 4.0.5](https://img.shields.io/badge/Mozaik-4.0.5-435461)

## Proof stack

IncidentMesh does not ask one run to prove every layer.

| Claim | Evidence | Result |
| --- | --- | --- |
| **Real AI concurrency** | Authenticated Google Gemini Flash-Lite receipt | Trace, Dependency, and Impact have **1,389 ms of three-way provider-inference overlap** |
| **Concurrency changes validity** | Revision-stamped stale-plan ablation | Concurrent peer evidence advances revision 1 → 3 while planning; the stale bounded proposal is rewritten, while serialization permits the same fresh-at-the-time bounded proposal |
| **The safety boundary executes** | Authenticated Gemini + deterministic Mozaik receipts | `rollback_production` is intercepted and rewritten to `request_corroboration`; the authenticated provider follow-up is recorded |
| **Hard safety survives adversarial orderings** | 10,000-case seeded stress | **0** unauthorized rollback crossings, **0** stale non-safe crossings across 40,000 immutable action-attempt snapshots |

### Authenticated Gemini Phase-2 receipt

One bounded authenticated capture on Google `gemini-3.5-flash-lite` records three separate Mozaik responder inferences and the complete Action Controller continuation:

| Responder | Inference started | Inference completed |
| --- | ---: | ---: |
| Trace | 2 ms | 1,392 ms |
| Dependency | 3 ms | 1,584 ms |
| Impact | 3 ms | 1,468 ms |

`max(start) = 3 ms < min(completion) = 1,392 ms`, so all three provider calls were simultaneously in flight for **1,389 ms**. All three returned structured hypotheses into shared `IncidentState`; after the third arrived, the aggregate gate reached `BLOCKED — conflicting-evidence`.

The same authenticated run then started the Phase-2 Action Controller. Gemini proposed `rollback_production`; Mozaik's live `SafetyGateInterception` rewrote it to `request_corroboration`, the safe tool executed, and the provider returned a final corroboration recommendation.

[Authenticated Gemini receipt](docs/evidence/real-provider-run.md) · [Raw evidence JSON](docs/evidence/real-provider-run.json)

This receipt proves one authenticated end-to-end provider execution. It does not claim production mutation, production readiness, or MTTR improvement. The controlled ablation below remains deterministic and separately proves what scheduling changes.

## Causal concurrency: stale-plan ablation

**Other agents changed the evidence while this agent was thinking. IncidentMesh knew its plan was no longer valid.**

`npm run ablation:stale-plan` freezes the exact three structured hypotheses from the authenticated Gemini receipt. Both arms use the same incident, eventual evidence, confidence values, planner, action policy, bounded candidate action, target cause, and configured planner-fixture duration. Only peer-evidence scheduling relative to the in-flight plan changes.

| Same revision-1 plan | Concurrent | Sequential |
| --- | --- | --- |
| Peer evidence advances during planning | yes | no |
| Revision at proposal boundary | 3 | 1 |
| Proposal fresh | **no** | **yes** |
| Attempt policy | `BLOCKED — stale-plan` | `APPROVED — fresh-bounded-evidence` |
| Bounded `targeted_canary_probe` crosses | **no** | **yes** |
| Mozaik result | `request_corroboration` + fresh replan | proposal-only bounded probe executes |
| Later eventual evidence | same three conflicting hypotheses | same three conflicting hypotheses |
| Destructive rollback authorized | no | no |

The fresh concurrent replan is stamped at revision 3, sees the now-complete conflict, and remains blocked. The serialized arm permits only a small proposal-only diagnostic canary while it is fresh; later identical evidence reveals that its target was based on an incomplete causal picture. **Concurrency changes which decisions remain valid, not merely how fast work finishes.**

[Readable receipt](docs/evidence/stale-plan-ablation.md) · [Machine-validated JSON](docs/evidence/stale-plan-ablation.json)

## Supporting causal proof: safe-action availability

**Same evidence. Same policy. Different safe plan at the boundary.**

`npm run ablation` changes only evidence scheduling. The incident, three evidence items, confidence values, gate rule, proposed action, and configured 205 ms action-boundary timer stay constant.

| At the action boundary | Concurrent | Sequential |
| --- | --- | --- |
| Required hypotheses available | 3 | 1 |
| Missing required roles | none | Dependency, Impact |
| Contradictions visible | 2 | 0 |
| Boundary decision | **BLOCKED** | **BLOCKED** |
| Boundary reason | `conflicting-evidence` | `incomplete-required-evidence` |
| Mozaik intercepts rollback | Yes | Yes |
| Tool executed | `request_corroboration` | `request_corroboration` |
| Safe control path | canary + targeted corroboration | hold for missing evidence |
| Conflict-informed canary | available at the boundary | available only after remaining evidence arrives |

Both schedules eventually reach the **same three hypotheses, two contradictions, and `BLOCKED — conflicting-evidence` investigation state**. No arm authorizes production from incomplete evidence. Parallel scheduling makes the conflict visible early enough to select the targeted canary path immediately; serialized scheduling leaves required evidence missing, so the same fail-closed policy holds the rollback until the conflict becomes visible later.

[Readable receipt](docs/evidence/safe-action-ablation.md) · [Machine-validated JSON](docs/evidence/safe-action-ablation.json)

The 205 ms boundary is configured fixture timing, not MTTR or a production latency claim. Host scheduling may delay observed callbacks without changing the asserted semantics.

## Demo

The replay below is generated from a canonical run. Responder bars show the canonical fixture overlap; the event ledger shows what followed the boundary decision. Live timings remain visible in `npm run demo`.

[![Canonical replay: concurrent responder spans, blocked gate, interception, safe tool execution, canary replan, and corroboration](docs/evidence/replay.svg)](docs/evidence/replay.svg)

[Open full-size replay](docs/evidence/replay.svg) · [Inspect source report](docs/evidence/replay.json) · [Judge demo guide](docs/demo.md)

```bash
npm run replay:visual  # generate an SVG and its source JSON from one run
```

Timing varies by machine and scheduler load. The canonical fixture produces three overlapping responder pairs, three hypotheses, two contradictions, a blocked gate, a canary replan, and two follow-up evidence responses.

## How it works

1. **Investigate together.** One `incident.opened` event wakes Trace, Dependency, and Impact. Each has independent handlers and a lifecycle.
2. **Version authoritative evidence.** Accepted hypotheses and required-responder closure advance `decisionRevision`; spoofed, duplicate, or rejected non-authoritative events do not.
3. **Stamp the plan.** The Action Controller freezes its `planId`, `basedOnRevision`, roles, hypotheses, and start time. Running prompts are not dynamically edited.
4. **Freeze each attempt.** Every proposed action gets its own immutable snapshot containing plan revision, boundary revision, freshness, evidence, risk tier, strict gate, and action-specific policy result.
5. **Intercept and adapt.** Stale bounded or destructive proposals are rewritten to `request_corroboration`. Fresh bounded probes require strong consistent visible evidence; rollback remains strict and fail-closed.

Built directly on **Mozaik 4.0.5**: typed runtime state, independent participants, semantic events, situation handlers, and function-call interception.

[Architecture and Mozaik primitive map](docs/implementation.md#how-it-works) · [Claim-by-claim verification](docs/implementation.md#judge-verification)

## Safety and degradation

Rollback is fail-closed at the action boundary: **it passes unchanged iff its own immutable attempt snapshot is fresh and affirmatively `APPROVED`**. Approval requires authoritative evidence from all required roles, no degraded required responder, every role above threshold, consistent root cause, no unresolved contradiction, valid producer/plan provenance, and a current revision. Mutable live gate state is never an authorization fallback.

Action risk is explicit: `request_corroboration` is safe; `targeted_canary_probe` is a bounded, reversible, proposal-only diagnostic fixture; `rollback_production` is destructive and retains the strict policy. Stale bounded and destructive actions never execute.

`npm run degradation` makes Dependency miss its evidence deadline. Trace and Impact continue, Dependency becomes explicitly degraded, the boundary remains blocked for incomplete evidence, and the same interceptor executes the safe corroboration path. A separate scripted model test covers a genuinely hanging required responder and marks it degraded when the evidence deadline expires.

Accepted model evidence is also constrained: producer identity is bound to the registered role, confidence must be finite and within `[0,1]`, malformed or spoofed evidence is excluded from safety calculations, and duplicate role hypotheses cannot double-count. This is bounded incident-phase safety logic, not a claim of arbitrary process recovery or distributed fault tolerance.

## Model and provider mode

The default path uses scripted evidence and controlled delays. Optional model mode collects structured Phase-1 hypotheses, then starts a separate Phase-2 Action Controller with all shared hypotheses and the gate decision in its prompt.

To repeat the bounded authenticated Phase-2 evidence capture with your own Gemini credential:

```bash
GEMINI_API_KEY=... npm run provider:evidence:capture -- --model gemini-3.5-flash-lite --gemini-signature-compat
```

The full model-mode entry point remains:

```bash
OPENAI_API_KEY=... RUN_MODEL=1 MODEL=gpt-5.5 npm run dev
```

Phase-1 peer observations happen in runtime handlers; peer hypotheses are not injected into those models. The Phase-2 controller receives the aggregate evidence. Its rollback calls pass through the same interception handler, and a rewritten tool result returns to the model loop.

A scripted `InferenceRunner` integration test exercises this lifecycle through Mozaik's real loop. The authenticated [Gemini Phase-2 receipt](docs/evidence/real-provider-run.md) records one bounded run through overlapping responder calls, rollback interception, safe-tool execution, and provider follow-up; a derived [peer-awareness receipt](docs/evidence/peer-awareness.md) shows runtime observers receiving peer events while inference was still active.

[Provider setup, failure behavior, and evidence capture](docs/implementation.md#deterministic-and-provider-backed-modes)

## Verification

```bash
npm run verify       # typecheck, 37 focused tests, production build, built smoke check
npm run ablation     # causal action-boundary comparison
npm run ablation:stale-plan # revision-stamped causal comparison
npm run stress:safety       # 10,000 seeded schedules / 40,000 attempts
npm run degradation  # explicit responder timeout
```

The current suite contains **37 focused tests** covering overlap, real Mozaik interception, revision advancement, frozen planning contexts, per-attempt authorization, stale bounded/destructive rejection, bounded-policy negatives, explicit and unbound plan/proposal provenance, complete rollback approval, fail-closed pending/conflicting/degraded states, late evidence, provider compatibility, causal scheduling, and the authenticated lifecycle's local regression path.

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

IncidentMesh is an incident-response prototype with deterministic fixtures, not a production integration. Live telemetry adapters, paging integrations, and automatic production actions are outside its scope. The stale-plan counterfactual uses frozen hypotheses from one historical authenticated provider receipt under deterministic schedules. No fixture tool changes real production.

The software remains **UNLICENSED**; no open-source license has been selected.

## Hackathon

Built for the JigJoy × daily.dev × Hyperskill concurrent-agents hackathon. [Rules, submission copy, and audit history](docs/hackathon/) are preserved separately. The project is submitted and publicly visible in the [JigJoy gallery](https://build.jigjoy.ai/gallery/incidentmesh-40ad9c); later resubmissions may update the judged entry before the deadline.
