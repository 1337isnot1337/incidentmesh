# IncidentMesh provider peer-awareness receipt

This is a derived, sanitized receipt from the committed [Gemini Phase-2 run](real-provider-run.md). It makes one runtime fact explicit: participant handlers observed peer hypotheses while some observers' own provider inference spans were still active.

This does **not** claim that an in-flight provider request received another responder's hypothesis in its prompt. The observation is a runtime event handled by the participant after shared state accepted a peer hypothesis.

Source receipt commit: `65d98f8feda666932fcbace88037c7009b487a35`

Provider: Google Gemini (`gemini-3.5-flash-lite`)

Source run: `2026-09-06T14:04:38.014Z` → `2026-09-06T14:04:41.443Z`

## Observations

The active-span check is `startedAtMs ≤ observationAtMs < completedAtMs` for the observing participant.

| Time | Observer | Peer hypothesis | Own inference active? |
| ---: | --- | --- | :---: |
| 1392 ms | Dependency | Trace | **YES** |
| 1392 ms | Impact | Trace | **YES** |
| 1468 ms | Trace | Impact | no |
| 1468 ms | Dependency | Impact | **YES** |
| 1584 ms | Trace | Dependency | no |
| 1584 ms | Impact | Dependency | no |

Result: **3 of 6 peer-awareness events occurred during the observer's own active provider inference span.** The first two observations are especially direct: Trace published at 1392 ms while Dependency and Impact continued inferring until 1584 ms and 1468 ms respectively.

The separate provider receipt proves all three inference windows overlap. This receipt adds the runtime-awareness detail without implying prompt mutation or a synchronization barrier.
