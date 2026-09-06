# 1.0.0 — IncidentMesh hackathon release

IncidentMesh is a concurrent incident-response prototype built on `@mozaik-ai/core` 4.0.5.

Current release highlights:

- Three independent responder lifecycles with measured pairwise overlap.
- Typed shared `IncidentState`, semantic-event fan-out, peer awareness, and state-driven adaptation.
- Deterministic provider-free incident fixture and reproducible latency proxy.
- Safety Gate that targets blocked rollback calls only and rewrites them to a registered proposal-only corroboration tool.
- Structured provider hypotheses that preserve claim, confidence, and root-cause data instead of collapsing model output to one synthetic cause.
- Event-driven scenario completion with a bounded timeout instead of fixed post-run sleeps.
- Product-first README, repository-owned SVG assets, cleaned documentation layout, and GitHub Actions verification.

The deterministic path is the canonical reproducible demo. It does not ingest live telemetry or execute production actions.
