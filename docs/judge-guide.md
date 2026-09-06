# IncidentMesh in 5 minutes

If you are judging from the repository, this is the shortest path to the core claim.

> **Concurrency changes which decisions are still valid.**

IncidentMesh has three concurrent responders — Trace, Dependency, and Impact — plus a separate Action Controller. The interesting part is not that three model calls can run at once. It is that peer evidence can change while the Action Controller is still planning, making an older plan stale before it reaches the action boundary.

## 1. Run the default demo

```bash
npm ci
npm run demo
```

The default demo uses deterministic evidence, so it does not need a provider key.

Look for the action-boundary sequence:

```text
rollback_production
        ↓
SafetyGateInterception
        ↓
request_corroboration
```

The tool names are proposal-only fixtures; no production system is modified.

## 2. Prove that scheduling changes validity

```bash
npm run ablation:stale-plan
```

The experiment holds the incident, eventual evidence, planner, policy, target, candidate action, and planning duration constant.

Only scheduling changes.

```text
CONCURRENT                         SERIALIZED

plan starts @ rev 1               plan starts @ rev 1
peers update state                 peers wait
rev 1 → 2 → 3                     rev 1 → 1

plan returns @ rev 1              plan returns @ rev 1
STALE                              FRESH

request_corroboration              targeted_canary_probe
+ fresh replan                     proposal-only diagnostic
```

Destructive rollback remains unauthorized in both arms.

Readable result: [`evidence/stale-plan-ablation.md`](evidence/stale-plan-ablation.md)

## 3. Inspect the real Gemini evidence

### Fresh release-runtime Phase 1

A fresh authenticated Google `gemini-3.5-flash-lite` capture against frozen release runtime `e98376445c42ea532cbe4993095911d932a3a57a` records:

- Trace: 4 → 1,458 ms
- Dependency: 4 → 1,495 ms
- Impact: 4 → 1,367 ms
- **1,363 ms common three-way provider-call overlap**
- 3 / 3 responder hypotheses accepted
- shared gate reaches `blocked`
- no production mutation observed

Readable scoped receipt: [`evidence/release-phase1-provider-run.md`](evidence/release-phase1-provider-run.md)

Scoped manifest: [`evidence/release-phase1-provider-manifest.json`](evidence/release-phase1-provider-manifest.json)

This stochastic release-SHA run did **not** produce a `rollback_production` proposal, so it does not claim a fresh authenticated Phase-2 interception. The full-evidence validator correctly rejected it for that broader claim while the observed Phase-1 provider intervals remain the fresh release-runtime concurrency evidence.

### Historical full provider path

![Authenticated Gemini provider run](assets/gemini-proof.svg)

The preserved historical authenticated Google `gemini-3.5-flash-lite` receipt records:

- Trace: 2 → 1,392 ms
- Dependency: 3 → 1,584 ms
- Impact: 3 → 1,468 ms
- **1,389 ms common three-way provider-call overlap**
- 3 / 3 structured hypotheses
- `BLOCKED — conflicting-evidence`
- Action Controller proposes `rollback_production`
- Mozaik rewrites it to `request_corroboration`
- the safe tool executes
- the provider returns a follow-up recommendation

Readable historical receipt: [`evidence/real-provider-run.md`](evidence/real-provider-run.md)

Historical raw evidence: [`evidence/real-provider-run.json`](evidence/real-provider-run.json)

The historical full receipt remains tied to its recorded source commit; it is not relabeled as release-SHA Phase-2 evidence. Neither receipt presents overlapping provider calls as proof of simultaneous token generation inside the model server.

## 4. Check the stress result

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

## 5. Run the full verification suite

```bash
npm run verify
```

The current suite has 37 focused tests covering concurrent responder behavior, revision advancement, immutable planning/attempt snapshots, stale-action rejection, action policy, degradation, provenance, interception, and provider-lifecycle regression paths.

## The whole project in one sentence

**Fresh release-runtime provider calls overlap; concurrent peer progress can invalidate in-flight planning; immutable Mozaik action boundaries prevent stale or unsafe tools from crossing.**

## Deeper evidence

- [`hackathon/judge-proof-map.md`](hackathon/judge-proof-map.md) — claim → artifact → limitation
- [`implementation.md`](implementation.md) — architecture and Mozaik primitive map
- [`evidence/safe-action-ablation.md`](evidence/safe-action-ablation.md) — supporting fixed-boundary comparison
- [`evidence/degradation.md`](evidence/degradation.md) — missing/hanging responder behavior
- [`evidence/semantic-stability.md`](evidence/semantic-stability.md) — repeated causal-arm stability

## Scope

IncidentMesh is a hackathon prototype.

The fresh release-SHA Gemini capture proves authenticated Phase-1 provider overlap only. The historical authenticated receipt remains the complete provider-backed Phase-2 interception/follow-up artifact from its recorded commit. `targeted_canary_probe` and `rollback_production` are proposal-only fixtures. No tool mutates production. The project does not claim production readiness, MTTR improvement, generic speedup, or dynamic modification of prompts already in flight.
