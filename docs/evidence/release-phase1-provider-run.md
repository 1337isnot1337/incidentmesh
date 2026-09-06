# Fresh release-runtime Phase-1 Gemini evidence

This artifact records the narrow claim supported by authenticated provider attempt #3 against the frozen IncidentMesh release runtime.

## Claim scope

A fresh Google `gemini-3.5-flash-lite` execution against source commit

`e98376445c42ea532cbe4993095911d932a3a57a`

recorded Trace, Dependency, and Impact provider-call windows with **1,363 ms of common three-way overlap**.

This run proves fresh authenticated **Phase-1 provider concurrency against the frozen release SHA**. It does **not** prove the authenticated Phase-2 interception path, because this stochastic run did not produce a `rollback_production` proposal and therefore did not traverse `SafetyGateInterception`.

## Capture provenance

- UTC: `2026-09-06T22:51:49Z` → `2026-09-06T22:51:54Z`
- Source SHA: `e98376445c42ea532cbe4993095911d932a3a57a`
- Provider: Google
- Model: `gemini-3.5-flash-lite`
- Node: `v24.19.0`
- npm: `11.17.0`
- Mozaik: `4.0.5`
- Baseline verification before capture: `37/37` tests passed
- Runtime changes for capture: none

## Phase-1 provider timing

| Responder | Start | End | Duration |
| --- | ---: | ---: | ---: |
| Trace | 4 ms | 1,458 ms | 1,454 ms |
| Dependency | 4 ms | 1,495 ms | 1,491 ms |
| Impact | 4 ms | 1,367 ms | 1,363 ms |

Pairwise provider-call overlap:

- Trace × Dependency: **1,454 ms**
- Trace × Impact: **1,363 ms**
- Dependency × Impact: **1,363 ms**

Common three-way provider-call intersection:

`4 ms → 1,367 ms = 1,363 ms`

These are provider-call windows. They are not presented as proof of simultaneous token generation inside Google's model servers.

## Runtime result

- 3 / 3 responder hypotheses accepted
- Shared gate: `blocked`
- Action Controller provider inference occurred twice
- `rollback_production` proposal: **not observed**
- `mozaik.interception.started`: **not observed**
- `mozaik.interception.rewritten`: **not observed**
- Executed safe tool: `request_corroboration`
- Provider recommendation: recorded
- Production mutation: **none observed**

The safe tool in this run was not the result of a rollback interception rewrite. The full authenticated Phase-2 validator therefore correctly rejected the run as incomplete for the broader Phase-2 claim.

## Validator boundary

The capture exited nonzero because the repository's full authenticated evidence validator expects the Phase-2 chain as well as Phase 1. The first missing Phase-2 invariants were:

- no `mozaik.interception.started`;
- no `mozaik.interception.rewritten`;
- no `rollback_production` proposal;
- `interceptionObserved=false`.

That rejection does not turn the observed Phase-1 provider intervals into synthetic or replay evidence; it means only that this particular stochastic execution does not certify the broader Phase-2 path.

## Preserved capture hashes

The raw attempt-3 artifacts were preserved outside the repository before any cleanup:

- raw JSON receipt SHA-256: `6a53fd13cac4eae9e02ba2e1361881432a98e9cc23e58808ace6b006c1ebf313`
- raw Markdown receipt SHA-256: `48270f6e5d6f58223942a9d5493d376415557457207be302844ba6096d0fde7f`

This committed file is a scoped, human-readable release-evidence summary of that preserved capture; it is not a replacement for the raw attempt artifact.

## Relationship to the historical full receipt

The existing [`real-provider-run.md`](real-provider-run.md) remains immutable historical evidence for the complete authenticated provider path:

`rollback_production → SafetyGateInterception → request_corroboration → provider follow-up`

That historical receipt records **1,389 ms** of common three-way provider-call overlap on its own recorded source commit.

The two artifacts support different claims:

- **this release-SHA capture:** fresh authenticated Phase-1 provider concurrency on `e983764...`;
- **historical full receipt:** authenticated Phase-1 overlap plus the complete Phase-2 interception/follow-up path on its recorded commit.

No production system is modified by either run.