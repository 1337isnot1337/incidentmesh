# IncidentMesh real-provider run evidence

This file records one provider-backed execution. It is execution evidence, not a production-readiness claim.

- Started: 2026-09-06T14:04:38.014Z
- Completed: 2026-09-06T14:04:41.443Z
- Commit: 65d98f8feda666932fcbace88037c7009b487a35
- Node: v24.19.0
- Mozaik: 4.0.5
- Provider: google
- Model: gemini-3.5-flash-lite
- Command: `RUN_MODEL=1 DRY_RUN=0 PHASE1_ONLY=0 MODEL=gemini-3.5-flash-lite GEMINI_SIGNATURE_COMPAT=1 node dist/index.js`
- Provider credential required: yes
- Run completed: yes
- Gate decision: blocked
- Interception observed: yes
- Requested action: rollback_production
- Executed tool: request_corroboration
- Model recommendation recorded: yes

## Participants

- trace: 2ms -> 1392ms
- dependency: 3ms -> 1584ms
- impact: 3ms -> 1468ms

## Concurrency

Overlapping participant pairs: 3.

Peer-awareness observations recorded by runtime participants: 6; 3 occurred while the observer's own inference span was still active.

## Runtime facts

- Hypotheses received by shared state: 3
- Adaptations recorded: 1
- Evidence notes recorded: 0

## Limitations

- The report exposes IncidentMesh incident events, not raw provider request/response bodies or authorization metadata.
- Raw provider request/response bodies are not preserved; IncidentMesh records normalized hypotheses, Mozaik interception/function-call events, and the Phase-2 model recommendation.
- A single successful execution does not establish production reliability or MTTR improvement.
