# IncidentMesh handoff — 2026-09-05

JIGJOY_STATUS=SUBMITTED

- Core narrative: three independent investigators disagree, and that disagreement changes what the system is allowed to do.
- Product: concurrent incident-response agents on `@mozaik-ai/core@4.0.5`.
- Concurrent responders: Trace, Dependency, Impact.
- Shared participants: Safety Gate, Action Controller, Incident Console, Incident Commander.
- Concurrency evidence: one `incident.opened` event starts all three responder lifecycles; 3 / 3 pairwise overlaps are measured and tested.
- Peer awareness: runtime handlers observe peer hypothesis events while measured responder spans are active. Phase-1 model contexts do not receive peer hypotheses.
- Shared-state disagreement: the deterministic fixture produces three distinct root-cause hypotheses, yielding two contradictions.
- Canonical adaptivity: those contradictions drive `SAFETY GATE: BLOCKED`; deterministic application logic replans Impact to a canary; Trace and Dependency then emit two corroboration events.
- Canonical interception: the zero-key deterministic demo produces a real `rollback_production` function call through a deterministic `InferenceRunner`; Mozaik's `AgentLoop` invokes `SafetyGateInterception`, rewrites it to `request_corroboration`, and executes the registered safe tool.
- Model-mode architecture: three investigation-only Phase-1 structured-output loops feed shared state without mitigation tools; aggregate gate state then opens a separate Phase-2 Action Controller loop whose prompt includes the accepted authoritative hypotheses and whose rollback transition carries the real interceptor. A scripted runner test proves this path structurally; authenticated provider evidence remains Phase-1-only.
- Provider evidence tooling: safe-by-default check plus explicit bounded capture; staged evidence is secret/path-scanned before repository copy. A Gemini Phase-1 authenticated receipt is committed; full provider-backed Phase-2 tool-call evidence remains open.
- Provider failure behavior: model-mode CLI preflight rejects missing credentials before loops start; later inference rejection terminates the CLI nonzero because Mozaik 4.0.5 `runLoop` does not expose its Promise.
- Completion: the scenario waits for observable incident state instead of a fixed sleep, records a timeout if the run does not settle, and returns stable snapshots that do not mutate after return.
- Causal ablation: same incident/evidence/confidence values/gate rule/rollback proposal/configured 205 ms boundary; both arms fail closed and execute `request_corroboration`, while concurrent scheduling has complete conflicting evidence and can select the canary path at the boundary and sequential scheduling must hold for missing evidence until the same conflict arrives later.
- Degradation: explicit or generally hanging required responders become degraded at the evidence deadline; incomplete required evidence fails closed at the action boundary, rollback remains intercepted, and surviving responders continue.
- Tests: nineteen focused invariant tests plus strict typecheck, production build, and built smoke verification, including snapshot-authoritative rollback, per-responder confidence, closed degraded responders, investigation-only Phase 1, hanging-responder degradation, causal scheduling, the scripted two-phase model lifecycle, approved-path execution, and phase-1 settling.
- Overlap metric: representative deterministic runs measure ~220 ms concurrent wall time and ~505–508 ms summed responder durations, producing an approximately 2.3× latency/overlap proxy. It does not measure reasoning quality, throughput, MTTR, or production performance.
- Replay surface: `npm run replay:visual` generates SVG + JSON from the canonical report for a submission-video timeline.
- Presentation: product-first README, causal hero, repository-owned social-preview asset, explicit limitations, concise architecture, and CI workflow.
- License: still `UNLICENSED`; no license was selected implicitly.
- Submission status: submitted and publicly visible at https://build.jigjoy.ai/gallery/incidentmesh-40ad9c. The form permits later resubmission and judges the latest entry.

Remaining competitive gap: authenticated provider evidence currently proves Phase-1 concurrency only; a clean current-commit full Phase-2 provider receipt remains unverified.

Remaining optional presentation item: upload the repository-ready `docs/assets/social-preview.png` through GitHub repository settings.
