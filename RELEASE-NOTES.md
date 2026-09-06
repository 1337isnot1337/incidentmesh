# 1.0.0 — IncidentMesh current-runtime release

IncidentMesh replaces the pre-kickoff research-swarm scaffold with a domain where concurrent participants are necessary: a live incident-response room.

- Migrated from the obsolete Mozaik 3.14.0 object API to `@mozaik-ai/core` 4.0.5.
- Added typed shared `IncidentState`, participant manifests, semantic events, and situation-driven reactions.
- Added deterministic provider-free overlap evidence and sequential-baseline benchmark.
- Added adaptive Safety Gate behavior: conflicting hypotheses block rollback; Impact replans; other responders add corroboration.
- Added current Mozaik `InterceptionHandler` implementation for risky function-call rewriting in real-model mode.
- Added judge-facing README, 90-second demo script, verified rules, and submission copy.
- Verified with clean `npm ci`, strict typecheck, three tests, production build, and built smoke verification.

The default demo makes no provider call and contains no credentials.
