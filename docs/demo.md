# IncidentMesh demo and verification

The final demo is the fastest way to understand the project:

**[Watch the 83-second IncidentMesh demo on YouTube](https://www.youtube.com/watch?v=ohw8Ybt_dIM)**

The video shows one central idea: peer evidence can change while the Action Controller is still planning, making an older plan stale before it reaches the action boundary.

## What the video shows

1. **Revision-stamped planning.** Trace, Dependency, and Impact investigate concurrently while the Action Controller may already be planning against the current evidence revision.
2. **A controlled stale-plan race.** The same revision-1 bounded plan is replayed under concurrent and serialized scheduling. Concurrent peer progress advances state to revision 3 before the proposal returns, so the proposal is stale. Serialized peers leave the same proposal fresh at that boundary. Destructive rollback remains unauthorized in both arms.
3. **Historical authenticated provider evidence.** A Google `gemini-3.5-flash-lite` receipt records all three responder provider calls simultaneously in flight for **1,389 ms**, followed by an Action Controller `rollback_production` proposal, real Mozaik `SafetyGateInterception`, `request_corroboration` execution, and a provider follow-up.
4. **Seeded safety stress.** 10,000 generated cases / 40,000 immutable action attempts record zero unauthorized rollback crossings and zero stale non-safe crossings.

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

Readable deterministic evidence: [`evidence/replay.md`](evidence/replay.md) and [`evidence/replay.svg`](evidence/replay.svg).

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

## Inspect the authenticated Gemini receipt

The historical provider execution is preserved separately from the deterministic counterfactual.

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

Readable receipt: [`evidence/real-provider-run.md`](evidence/real-provider-run.md)

Raw receipt: [`evidence/real-provider-run.json`](evidence/real-provider-run.json)

This is one authenticated historical run from its recorded source commit. It is not presented as final-SHA provider evidence or as proof of simultaneous token generation inside the model server.

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

IncidentMesh is a hackathon prototype. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No demonstrated tool mutates production. The project does not claim production readiness, MTTR improvement, generic speedup, dynamic modification of prompts already in flight, or serialized destructive rollback crossing.
