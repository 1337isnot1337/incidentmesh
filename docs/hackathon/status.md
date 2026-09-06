# IncidentMesh handoff — 2026-09-05

JIGJOY_STATUS=SUBMISSION_READY

- Core narrative: three independent investigators disagree, and that disagreement changes what the system is allowed to do.
- Product: concurrent incident-response agents on `@mozaik-ai/core@4.0.5`.
- Concurrent responders: Trace, Dependency, Impact.
- Shared participants: Safety Gate, Action Controller, Incident Console, Incident Commander.
- Concurrency evidence: one `incident.opened` event starts all three responder lifecycles; 3 / 3 pairwise overlaps are measured and tested.
- Peer awareness: runtime handlers observe peer hypothesis events while measured responder spans are active. Phase-1 model contexts do not receive peer hypotheses.
- Shared-state disagreement: the deterministic fixture produces three distinct root-cause hypotheses, yielding two contradictions.
- Canonical adaptivity: those contradictions drive `SAFETY GATE: BLOCKED`; deterministic application logic replans Impact to a canary; Trace and Dependency then emit two corroboration events.
- Canonical interception: the zero-key deterministic demo produces a real `rollback_production` function call through a deterministic `InferenceRunner`; Mozaik's `AgentLoop` invokes `SafetyGateInterception`, rewrites it to `request_corroboration`, and executes the registered safe tool.
- Model-mode architecture: three Phase-1 structured-output loops feed shared state; aggregate gate state then opens a separate Phase-2 Action Controller loop whose prompt includes all three hypotheses and whose rollback transition carries the real interceptor. A scripted runner test proves this path structurally; no authenticated provider run is claimed.
- Provider evidence tooling: safe-by-default check plus explicit bounded capture; staged evidence is secret/path-scanned before repository copy. No real-provider evidence is currently committed.
- Provider failure behavior: model-mode CLI preflight rejects missing credentials before loops start; later inference rejection terminates the CLI nonzero because Mozaik 4.0.5 `runLoop` does not expose its Promise.
- Completion: the scenario waits for observable incident state instead of a fixed sleep, records a timeout if the run does not settle, and returns stable snapshots that do not mutate after return.
- Causal ablation: same incident/evidence/confidence values/gate rule/rollback proposal/205 ms boundary; concurrent scheduling blocks and rewrites to `request_corroboration`, sequential scheduling lets the proposal-only rollback call cross before identical late evidence tightens the final gate.
- Degradation: Dependency timeout is explicit shared state; the gate fails closed, rollback remains intercepted, and surviving responders continue.
- Tests: twelve focused tests plus strict typecheck, production build, and built smoke verification, including the scripted two-phase model lifecycle and provider credential preflight.
- Overlap metric: representative deterministic runs measure ~220 ms concurrent wall time and ~505–508 ms summed responder durations, producing an approximately 2.3× latency/overlap proxy. It does not measure reasoning quality, throughput, MTTR, or production performance.
- Replay surface: `npm run replay:visual` generates SVG + JSON from the canonical report for a submission-video timeline.
- Presentation: product-first README, causal hero, repository-owned social-preview asset, explicit limitations, concise architecture, and CI workflow.
- License: still `UNLICENSED`; no license was selected implicitly.
- Submission status: not submitted. Official submission remains an operator decision; the form permits later resubmission and judges the latest entry.

Remaining competitive gap: no sanitized authenticated provider evidence has been captured yet.

Remaining optional presentation item: export `docs/assets/social-preview.svg` to a GitHub-supported social-preview bitmap and upload it through repository settings if desired.
