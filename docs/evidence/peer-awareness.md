# IncidentMesh provider peer-awareness receipt

This is a derived, sanitized receipt from the committed [Gemini Phase-1 run](real-provider-run.md). It makes one runtime fact explicit: participant handlers observed peer hypotheses while some observers' own provider inference spans were still active.

This does **not** claim that an in-flight provider request received another responder's hypothesis in its prompt. The observation is a runtime event handled by the participant after shared state accepted a peer hypothesis.

Source receipt commit: `d2f50acb08c476e56f8975ebda11219b8fe3ce47`  
Provider: Google Gemini (`gemini-3.5-flash`)  
Source run: `2026-09-06T05:22:18.110Z` → `2026-09-06T05:22:48.358Z`

## Observations

The active-span check is `startedAtMs ≤ observationAtMs < completedAtMs` for the observing participant.

| Time | Observer | Peer hypothesis | Own inference active? |
| ---: | --- | --- | :---: |
| 2419 ms | Dependency | Trace | **YES** |
| 2419 ms | Impact | Trace | **YES** |
| 2602 ms | Trace | Impact | no |
| 2602 ms | Dependency | Impact | **YES** |
| 2881 ms | Trace | Dependency | no |
| 2881 ms | Impact | Dependency | no |

Result: **3 of 6 peer-awareness events occurred during the observer's own active provider inference span.** The first two observations are especially direct: Trace published at 2419 ms while Dependency and Impact continued inferring until 2881 ms and 2602 ms respectively.

The separate provider receipt proves all three inference windows overlap. This receipt adds the runtime-awareness detail without implying prompt mutation or a synchronization barrier.
