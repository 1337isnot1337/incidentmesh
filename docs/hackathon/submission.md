# Submission copy

## Project name

IncidentMesh

## Repository URL

https://github.com/1337isnot1337/incidentmesh

## What does it do?

IncidentMesh is a concurrent incident-response room for a checkout outage. Trace, Dependency, and Impact are independent Mozaik participants with different capabilities. They investigate at the same time, publish hypotheses into shared typed runtime state, and observe peer events. Safety Gate aggregates contradiction and confidence signals, blocks an unsafe rollback when evidence conflicts, and causes the room to replan to a canary with corroboration.

## How do the agents run concurrently?

All three responders join one `defineRuntime<IncidentState>()` runtime and register a handler for the same `incident.opened` event. Their work begins independently rather than waiting on a fixed sequence. In the provider-free fixture, all three responder pairs overlap. Hypotheses and mitigation changes are semantic events fanned out by the runtime, so a new shared-state decision can change later behavior while the incident is active.

## Demo

Run `npm ci && npm run demo`. The deterministic path needs no API key and prints the event trace, overlap proof, Safety Gate decision, adaptive plan, corroborating evidence, and latency proxy. [`../demo.md`](../demo.md) contains the 90-second narration.

## Repository checklist

- TypeScript, Node 20+, `@mozaik-ai/core` 4.0.5
- deterministic provider-free demo
- shared typed state and semantic event fan-out
- 3 / 3 pairwise responder overlap
- rollback-only safety interception with executable safe rewrite
- tests, production build, built smoke verification, and GitHub Actions CI
