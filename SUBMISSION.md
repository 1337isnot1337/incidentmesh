# Submission copy

## Project name

IncidentMesh

## What does it do?

IncidentMesh is a live incident-response room for a checkout outage. Trace, Dependency, and Impact are independent concurrent Mozaik participants with different capabilities. They investigate at the same time, publish hypotheses into shared typed runtime state, and observe one another. Safety Gate aggregates contradiction and confidence signals, blocks an unsafe rollback when the evidence is weak, and causes the room to replan to a canary with corroboration.

## How do the agents run concurrently?

All three responders join one `defineRuntime<IncidentState>()` runtime and register a situation handler for the same `incident.opened` event. Their handlers launch independent work without awaiting one another. In the provider-free replay, their spans begin within 1–2 ms and all three responder pairs overlap. Hypotheses and mitigation events are semantic events fanned out by the runtime, so agents react to changing shared state rather than traversing a fixed sequential pipeline.

## Demo

Run `npm install && npm run demo`. The deterministic path needs no API key and prints the event trace, overlap proof, adaptive gate decision, and recommendation. `DEMO.md` contains the 90-second narration.

## Repository checklist

- TypeScript, Node 20+, `@mozaik-ai/core` 4.0.5
- `npm run check` passes
- `npm run build` and built verification pass
- no credentials or provider calls in the default demo
