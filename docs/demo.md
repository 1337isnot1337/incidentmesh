# IncidentMesh — 90-second judge demo

From a fresh clone:

```bash
npm ci
npm run demo
```

Narration:

1. “IncidentMesh is a concurrent incident-response room. Trace, Dependency, and Impact investigate different signals at the same time instead of waiting in a pipeline.”
2. “One `incident.opened` event wakes all three. Their spans begin together and finish on different clocks; the proof section measures all three pairwise overlaps.”
3. “Each hypothesis enters shared `IncidentState` and is visible to peers. The Safety Gate sees three conflicting root-cause claims at 0.74 aggregate confidence and blocks rollback.”
4. “That decision changes the room. Impact emits a canary plan; Trace and Dependency react to the new event and add corroborating evidence.”
5. “The benchmark compares the concurrent responder window with the sum of those same measured intervals. It is a latency proxy, not a model-quality claim.”

Useful follow-ups:

```bash
npm run benchmark
npm run verify
npm run demo:built
```

For the framework path, start at `src/app.ts`: `defineRuntime`, typed `IncidentState`, Mozaik participants, semantic-event handlers, structured provider hypotheses, and `SafetyGateInterception` are all in one reviewable implementation.

The default demo is a deterministic scripted fixture, not live telemetry. Provider mode is optional and uses the same event topology.
