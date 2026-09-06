# IncidentMesh real-provider run evidence

This file records one provider-backed execution. It is execution evidence, not a production-readiness claim.

- Started: 2026-09-06T05:22:18.110Z
- Completed: 2026-09-06T05:22:48.358Z
- Commit: d2f50acb08c476e56f8975ebda11219b8fe3ce47
- Node: v24.19.0
- Mozaik: 4.0.5
- Provider: google
- Model: gemini-3.5-flash
- Command: `RUN_MODEL=1 DRY_RUN=0 PHASE1_ONLY=1 MODEL=gemini-3.5-flash node dist/index.js`
- Provider credential required: yes
- Run completed: yes
- Gate decision: blocked
- Interception observed: no
- Requested action: none
- Executed tool: none
- Model recommendation recorded: no

## Participants

- trace: 2ms -> 2419ms
- dependency: 3ms -> 2881ms
- impact: 3ms -> 2602ms

## Concurrency

Overlapping participant pairs: 3.

## Runtime facts

- Hypotheses received by shared state: 3
- Adaptations recorded: 0
- Evidence notes recorded: 0

## Limitations

- The report exposes IncidentMesh incident events, not raw provider request/response bodies or authorization metadata.
- Raw provider request/response bodies are not preserved; IncidentMesh records normalized hypotheses, Mozaik interception/function-call events, and the Phase-2 model recommendation.
- A single successful execution does not establish production reliability or MTTR improvement.
