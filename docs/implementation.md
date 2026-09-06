# Implementation and verification reference

Return to the [IncidentMesh README](../README.md).

## Judge verification

The important claims are directly inspectable:

| Claim | Where the repository proves it |
| --- | --- |
| Three separate responders actually overlap | `runIncidentScenario()` emits independent responder spans; the demo prints all three; tests require `overlapCount(report) === 3` |
| Peer observations happen while work is active | `awareness.peer-observed` events are emitted on peer hypotheses while responder spans are active |
| Hypotheses enter shared typed state | `IncidentState.hypotheses: Hypothesis[]`; gate handlers accept one authoritative hypothesis per registered role |
| Role claims are bound to producer identity | `registerResponder()` binds each role to its Mozaik participant ID; spoofed or unknown-role evidence is rejected |
| Invalid confidence cannot improve safety posture | evidence requires a finite numeric confidence in `[0,1]`; malformed evidence is rejected and the required role remains unavailable/degraded |
| Duplicate role evidence cannot double-count | first authoritative hypothesis for each role wins for the phase |
| Waiting and action safety are distinct | incomplete investigation evidence remains `PENDING`; the same state becomes `BLOCKED — incomplete-required-evidence` when rollback reaches the action boundary |
| Action-relevant state is revisioned | accepted authoritative hypotheses and required-responder closure advance `decisionRevision`; rejected/spoofed/duplicate events do not |
| Plans are revision-stamped | `PlanContext` freezes `planId`, producer, `basedOnRevision`, roles, hypotheses, and start time before inference |
| Every attempt is immutable and independent | `ActionAttemptSnapshot` freezes plan/boundary revisions, freshness, risk, evidence, strict gate, and action policy for one attempt |
| Late evidence remains visible without rewriting history | later hypotheses update the investigation state but do not mutate the frozen boundary snapshot |
| Rollback is intercepted end to end | both conflict and incomplete-evidence paths traverse Mozaik interception and execute `request_corroboration`; tests assert rollback itself does not execute |
| Model-mode interception is structurally reachable | a separate post-aggregation Action Controller `runLoop` receives shared evidence and traverses the same interceptor in scripted integration tests |
| Provider-backed Phase 2 is authenticated | the historical Gemini Flash-Lite receipt records three overlapping provider calls, a real controller rollback proposal, interception, safe-tool execution, and provider follow-up |
| Concurrency can invalidate in-flight work | `npm run ablation:stale-plan` holds evidence/planner/policy/action constant and changes only whether peer evidence advances the revision while the planner runs |


## Why concurrency is the point

Telemetry, dependency health, and customer impact are independent evidence streams. Serializing them delays when shared state becomes complete enough to distinguish a concrete conflict from simple missing evidence. It can also let a bounded action remain fresh long enough to cross before later evidence invalidates its causal target.

IncidentMesh is not one agent executing three prompts in sequence:

- Trace, Dependency, and Impact are separate Mozaik participants with independent handlers and lifecycles.
- One `incident.opened` semantic event wakes all three in the concurrent fixture.
- Peer hypothesis events fan out through runtime handlers while responder work is still in flight; this is runtime awareness, not a claim that Phase-1 LLMs receive peer hypotheses.
- The Safety Gate computes an evolving investigation state from shared evidence.
- Every action-relevant authoritative mutation advances a monotonic revision. A planner freezes the revision and exact evidence it reasoned over.
- Every action attempt freezes a distinct authorization snapshot. A stale bounded or destructive proposal is rewritten before execution; later evidence cannot rewrite any historical record.
- In the canonical zero-key demo, complete conflicting evidence selects the deterministic canary-and-targeted-corroboration path.
- In model mode, aggregate evidence opens a separate Phase-2 Action Controller loop whose prompt contains accepted shared hypotheses and gate state.


## How it works

```mermaid
flowchart LR
  C[Incident Commander] -->|incident.opened| R[(Shared IncidentState)]
  R --> T[Trace]
  R --> D[Dependency]
  R --> I[Impact]
  T -->|validated hypothesis| R
  D -->|validated hypothesis| R
  I -->|validated hypothesis| R
  R -->|revision N| A[Action Controller plan @ N]
  R -->|peer evidence advances N+1| B{Per-attempt boundary}
  A -->|revision-stamped proposal| B
  B -->|stale or policy-blocked| X{Mozaik InterceptionHandler}
  X -->|rewrite| Q[request_corroboration]
  Q -->|tool result| A
  B -->|fresh + action policy| P[proposal-only action]
  R --> G{Investigation Gate}
  G -->|conflicting evidence| K[Canary + targeted corroboration]
  K --> R
```

The implementation uses Mozaik 4.0.5 directly:

| Mozaik primitive | IncidentMesh use |
| --- | --- |
| `defineRuntime<IncidentState>()` | one shared runtime with typed incident state |
| `createAgent` / `createHuman` | three responders, Action Controller, gate, observer, commander |
| `SemanticEvent.create` / `sendEvent` | incident, hypothesis, gate, degradation, adaptation, and evidence fan-out |
| `SituationSpecification` | event-driven participant reactions |
| `runLoop` | provider-backed Phase-1 responder turns plus post-aggregation Phase-2 mitigation |
| `InterceptionHandler` | inspect bounded and destructive function-call transitions at the action boundary |
| structured output | request provider-reported claim, confidence, and root-cause fields before validation |

### Revision-stamped planning and action phase

The gate counts disagreement as the number of distinct authoritative root-cause hypotheses minus one. Before an action is attempted, missing required evidence is an evolving investigation state: `PENDING — pending-required-evidence`. At a production action boundary, absence of required evidence is not treated as safety. The action evaluation becomes `BLOCKED — incomplete-required-evidence`. Complete evidence with disagreement becomes `BLOCKED — conflicting-evidence`; complete evidence with one shared root-cause slug may become `APPROVED — sufficient-consistent-evidence` only when every required responder reports confidence of at least `0.8`. Root-cause agreement is a structured-field equality check, not a semantic entailment claim over free-form prose.

Each accepted authoritative hypothesis and each required-responder closure advances `decisionRevision`. `PlanContext` freezes the planner's `basedOnRevision`, authoritative roles, hypothesis content, producer, and start time. The prompt receives that frozen evidence; already-running prompts are never described as dynamically receiving peer updates.

Each independent proposal receives its own frozen `ActionAttemptSnapshot`: attempt/plan identifiers, action producer, action/risk, plan and boundary revisions, freshness, evidence roles, per-role confidence, degradation, contradictions, strict gate result, and action-specific policy result. The old `actionBoundarySnapshot` report field remains only as a latest-attempt compatibility view. Authorization always uses the specific newly captured attempt.

The policy has three explicit tiers. `request_corroboration` is safe. `targeted_canary_probe` is a bounded, reversible, proposal-only diagnostic that requires a fresh registered plan, at least one strong authoritative signal, no degraded responder, no visible contradiction, and a target matching every authoritative root cause currently visible. `rollback_production` is destructive: it additionally requires every required role, no degraded role, every role at or above `0.8`, one consistent root cause, no contradiction, valid provenance, and a fresh plan.

`SafetyGateInterception` targets every bounded or destructive transition and fails closed: the handler atomically captures a new attempt snapshot, rejects invalid provenance or revision mismatch, then applies the risk-specific policy. Mutable investigation gate state is not an authorization fallback. In the canonical zero-key demo, the pending rollback reaches Mozaik's function-call transition after complete conflicting evidence is known, is rewritten to the registered `request_corroboration` tool, and that safe tool executes through the normal function-call state. IncidentMesh never performs a real production rollback.

The stale-plan experiment runs the actual Mozaik action loop with the exact frozen hypotheses from the authenticated Gemini receipt. Trace starts the same revision-1 bounded plan in both arms. Concurrent Dependency/Impact progress moves the boundary to revision 3, so the proposal is stale, rewritten, and freshly replanned against conflict. Serialized peers have not advanced state when the same proposal returns; it is fresh under bounded policy and the proposal-only diagnostic probe crosses. The same eventual conflict later appears. Destructive rollback is authorized in neither arm.

Model mode uses a genuine second phase instead of expecting a terminal investigation turn to act later. Phase-1 model hypotheses are validated before entering shared state. After aggregate evidence produces a gate result, a dedicated Action Controller `runLoop` receives the accepted shared hypotheses and current gate state. If that model emits `rollback_production`, the same `SafetyGateInterception` is on the live transition. If rewritten to `request_corroboration`, the tool result returns to the Action Controller and its later `model.answer` is recorded as the model recommendation. Scripted tests cover this lifecycle locally; the preserved historical authenticated Gemini Flash-Lite receipt independently records the Phase-2 proposal, interception, safe tool, and provider follow-up.


## Measured overlap

`npm run benchmark` reports one supporting concurrency metric:

```text
latency/overlap proxy
= sum of measured responder durations / concurrent wall time
≈ 2.3× in the deterministic fixture
```

A representative run measures about 219–220 ms of concurrent wall time and about 505–508 ms when the three measured responder durations are summed. All three responder pairs overlap.

This ratio is only an overlap/latency proxy. It does **not** establish 2.3× better reasoning, throughput, MTTR, or production performance. It is deliberately secondary to the causal demonstration that disagreement changes the allowed action.


## Deterministic and provider-backed modes

The provider-free path is the canonical judging demo because it is fast and reproducible. Its evidence values and controlled delays are scripted; it does **not** connect to live observability systems.

The optional model path replaces scripted Phase-1 hypotheses with structured model output and then uses a separate Phase-2 Action Controller:

```bash
OPENAI_API_KEY=... RUN_MODEL=1 npm run dev
```

Phase-1 peer events are observed by runtime handlers, but peer hypotheses are not injected into the other Phase-1 responder models and do not trigger extra inference. Phase-1 responder agents and their inference requests receive no mitigation tools; production-action tools exist only on the Phase-2 Action Controller. Accepted model evidence must have a known role bound to the registered producer identity, a finite confidence in `[0,1]`, and non-empty claim/root-cause fields. Unknown roles, spoofed role claims, duplicates, and malformed evidence are excluded from safety calculations.

A required model responder that does not produce valid evidence before the scenario evidence deadline is explicitly degraded and closed for that action phase. Missing-at-boundary evidence may still arrive later, but once a responder is degraded at the phase deadline its delayed output is observational only and cannot re-enter authoritative gate state for that phase. In either case a rollback boundary without complete required evidence fails closed.

The repository has scripted model-mode integration tests for the two-phase lifecycle and for a generally hanging required responder. Those tests use Mozaik's agent loop, interception manager, rewritten function transition, tool execution, and follow-up `model.answer`. One sanitized authenticated Gemini Flash-Lite receipt proves the same end-to-end lifecycle with a real provider.

Provider evidence capture is safe-by-default: `npm run provider:evidence:check` only inspects model/provider selection and credential-variable availability. `npm run provider:evidence:capture` explicitly opts into one bounded provider execution and refuses to write evidence if the child process fails, the outer capture deadline fires, or the IncidentMesh report contains `incident.scenario.timeout`. Before repository copy, staged JSON/Markdown are scanned for common credential/private-path patterns; JSON receipts also must contain accepted hypotheses plus one completed inference lifecycle for each required responder with positive three-way overlap. The committed [Gemini Phase-2 receipt](evidence/real-provider-run.md) additionally proves live rollback interception, safe-tool execution, and a follow-up provider recommendation; the derived [peer-awareness receipt](evidence/peer-awareness.md) makes the runtime event overlap explicit.

The CLI checks the selected model's provider credential before starting model loops. With the default `gpt-5.5`, a missing `OPENAI_API_KEY` exits with an explicit error and emits no IncidentReport. For inference failures after startup, Mozaik 4.0.5 exposes `runLoop(): void`, so the CLI uses a process-level `unhandledRejection` boundary to terminate nonzero rather than misreport success; library-level Promise recovery is not available through the current API.

External telemetry adapters, paging integrations, and automatic production actions are outside this prototype. The concurrency and safety-control architecture is the part under test.

## Fail-closed degradation

`npm run degradation` simulates an explicit Dependency timeout before it publishes valid evidence. Trace and Impact continue. Dependency becomes explicitly degraded, the action-boundary snapshot records `BLOCKED — incomplete-required-evidence`, and Mozaik rewrites `rollback_production` to `request_corroboration`. The deterministic degraded path holds the broad rollback and records surviving Trace corroboration rather than pretending the missing Dependency signal is safe.

The model-integration tests add a more general case: a required Dependency inference runner never returns. When the evidence deadline passes, Dependency is marked degraded for the phase, its responder span is closed as unavailable, and the Action Controller still reaches the same fail-closed interception path. This is bounded phase-deadline handling; IncidentMesh does not claim arbitrary process recovery or distributed fault tolerance.

## Development

```bash
npm run typecheck
npm test
npm run build
npm run verify:built
```

Thirty-seven focused invariant tests cover concurrent overlap, revision advancement, frozen planning evidence, explicit and unbound proposal provenance, stale bounded and destructive rejection, bounded-policy negative cases, distinct immutable attempts, snapshot-authoritative rollback, a 500-seed adversarial ordering sweep, complete approval, conflict/incomplete/degraded blocking, per-responder confidence, both causal scheduling experiments, closed degraded responders, hanging/explicit timeout degradation, producer-role binding, duplicate policy, investigation-only Phase 1, canonical Mozaik interception, Gemini compatibility, provider preflight, phase-1 settling, approved symmetry, and two-phase scripted model interception.

`npm run stress:safety` adds 10,000 seeded property cases and 40,000 independent action attempts. The checked-in receipt records zero unauthorized destructive crossings, zero stale non-safe crossings, zero unauthorized bounded crossings, zero action-policy mismatches, zero attempt-isolation failures, and zero snapshot mutations.

`dist/` is intentionally committed. Judges can inspect or run the built JavaScript without trusting an unpublished package, while `src/` remains the source of truth.
