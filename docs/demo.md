# IncidentMesh demo and verification

The final demo is the fastest way to understand the project:

**[Watch the 83-second IncidentMesh demo on YouTube](https://www.youtube.com/watch?v=ohw8Ybt_dIM)**

The video shows one central idea: peer evidence can change while the Action Controller is still planning, making an older plan stale before it reaches the action boundary.

## What the video shows

1. **Revision-stamped planning.** Trace, Dependency, and Impact investigate concurrently while the Action Controller may already be planning against the current evidence revision.
2. **A controlled stale-plan race.** The same revision-1 bounded plan is replayed under concurrent and serialized scheduling. Concurrent peer progress advances state to revision 3 before the proposal returns, so the proposal is stale. Serialized peers leave the same proposal fresh at that boundary. Destructive rollback remains unauthorized in both arms.
3. **Historical authenticated provider evidence.** A Google `gemini-3.5-flash-lite` receipt records all three responder provider calls simultaneously in flight for **1,389 ms**, followed by an Action Controller `rollback_production` proposal, real Mozaik `SafetyGateInterception`, `request_corroboration` execution, and a provider follow-up.
4. **Seeded safety stress.** 10,000 generated cases / 40,000 immutable action attempts record zero unauthorized rollback crossings and zero stale non-safe crossings.

After the video was finalized, a separate fresh authenticated Gemini capture against frozen release runtime `e98376445c42ea532cbe4993095911d932a3a57a` recorded **1,363 ms** of common three-way Phase-1 provider-call overlap. That newer run is intentionally documented separately because its stochastic Phase 2 did not propose `rollback_production` and therefore did not traverse the interception path.

The video uses proposal-only actions and does not modify a production system.

## Run the default demo

Node.js 20+ is required. The default demo is deterministic and does not need a provider key.

```bash
npm ci
npm run demo
```

Look for the action-boundary path:

```text
rollback_production
        |
        v
SafetyGateInterception
        |
        v
request_corroboration
```

Canonical deterministic evidence: [`evidence/replay.json`](evidence/replay.json) and [`evidence/replay.svg`](evidence/replay.svg).

## Reproduce the causal scheduling comparison

```bash
npm run ablation:stale-plan
```

The experiment holds the incident, eventual evidence, planner, policy, target, candidate action, and configured planner-fixture duration constant. Only peer-evidence scheduling changes.

```text
CONCURRENT                         SERIALIZED

plan starts @ rev 1               plan starts @ rev 1
peers advance state               peers wait
boundary @ rev 3                  boundary @ rev 1

same rev-1 proposal returns       same rev-1 proposal returns
STALE                              FRESH

request_corroboration             targeted_canary_probe
+ fresh replan                    proposal-only diagnostic
```

Destructive rollback remains blocked in both arms.

Readable result: [`evidence/stale-plan-ablation.md`](evidence/stale-plan-ablation.md)

Raw result: [`evidence/stale-plan-ablation.json`](evidence/stale-plan-ablation.json)

## Inspect the authenticated Gemini evidence

### Fresh release-runtime Phase 1

The fresh authenticated Google `gemini-3.5-flash-lite` capture against release runtime `e98376445c42ea532cbe4993095911d932a3a57a` records:

- Trace: 4 -> 1,458 ms
- Dependency: 4 -> 1,495 ms
- Impact: 4 -> 1,367 ms
- **1,363 ms common three-way provider-call overlap**
- 3 / 3 responder hypotheses accepted
- shared gate reaches `blocked`
- no production mutation observed

Readable scoped receipt: [`evidence/release-phase1-provider-run.md`](evidence/release-phase1-provider-run.md)

Scoped manifest: [`evidence/release-phase1-provider-manifest.json`](evidence/release-phase1-provider-manifest.json)

The full authenticated evidence validator rejected this stochastic run because Phase 2 was incomplete: there was no `rollback_production` proposal and no interception rewrite. The committed scoped receipt therefore makes only the narrower fresh Phase-1 claim.

### Historical full provider path

The preserved historical provider execution remains separate from the release-SHA Phase-1 capture and the deterministic counterfactual.

- Trace: 2 -> 1,392 ms
- Dependency: 3 -> 1,584 ms
- Impact: 3 -> 1,468 ms
- **1,389 ms common three-way provider-call overlap**
- 3 / 3 structured hypotheses
- `BLOCKED -- conflicting-evidence`
- Action Controller proposes `rollback_production`
- Mozaik rewrites it to `request_corroboration`
- the safe tool executes
- the provider records a follow-up recommendation

Readable historical receipt: [`evidence/real-provider-run.md`](evidence/real-provider-run.md)

Historical raw receipt: [`evidence/real-provider-run.json`](evidence/real-provider-run.json)

This historical run remains tied to its recorded source commit. It is not presented as release-SHA Phase-2 provider evidence, and neither receipt is presented as proof of simultaneous token generation inside the model server.

## Run the safety stress

```bash
npm run stress:safety
```

The committed seeded receipt contains:

```text
10,000 generated cases
40,000 immutable action attempts

0 unauthorized rollback crossings
0 stale non-safe crossings
0 unauthorized bounded crossings
0 policy violations
0 attempt-isolation violations
0 snapshot-mutation violations
```

Readable receipt: [`evidence/safety-stress.md`](evidence/safety-stress.md)

## Run the full verification suite

```bash
npm run verify
```

For the shortest judge-oriented walkthrough, see [`judge-guide.md`](judge-guide.md).

## Scope

IncidentMesh is a hackathon prototype. The fresh release-SHA Gemini capture proves authenticated Phase-1 provider overlap only; the historical receipt remains the complete provider-backed Phase-2 interception/follow-up artifact from its recorded commit. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No demonstrated tool mutates production. The project does not claim production readiness, MTTR improvement, generic speedup, dynamic modification of prompts already in flight, or serialized destructive rollback crossing.
