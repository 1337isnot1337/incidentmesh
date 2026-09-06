# IncidentMesh — 90-second judge demo

Run from this directory:

```bash
npm install
npm run demo
```

Narration:

1. “This is IncidentMesh, a live incident-response room. The problem is not writing three prompts; it is getting three independent signals at once while the incident changes.”
2. “One `incident.opened` event wakes Trace, Dependency, and Impact. Watch their spans: all start at roughly the same time, but each has a different capability and completion time.”
3. “Their hypotheses fan out through the Mozaik runtime. The Safety Gate sees three conflicting causes and 0.74 aggregate confidence, so it blocks an unsafe production rollback.”
4. “That shared state changes behavior: Impact reacts to the gate and replans a canary. Trace and Dependency react to the new plan and provide corroboration.”
5. “The last section is the proof: three of three responder pairs overlap, and the same measured work completes in roughly 2.3 times less wall time than a sequential baseline.”

Useful commands after the main demo:

```bash
npm run benchmark
npm test
```

If a judge wants to inspect the framework path, point to `src/app.ts`: the runtime is defined with Mozaik 4’s `defineRuntime`, the shared state extends `RuntimeState`, reactions are `SituationHandler`s, and optional model turns use `runLoop`.
