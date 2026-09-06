# Stale-plan causal ablation

The exact hypotheses from the authenticated Google Gemini receipt are frozen. Both arms use the same incident, eventual evidence, confidence, planner, policy, action, target, and proposal boundary. **Only peer-evidence scheduling relative to the in-flight plan changes.**

- Source receipt: [real-provider-run.json](real-provider-run.json)
- Source commit: `65d98f8feda666932fcbace88037c7009b487a35`
- Provider/model: google / `gemini-3.5-flash-lite`
- Candidate: proposal-only bounded `targeted_canary_probe` targeting `payment-validation-deadlock`

| | Concurrent | Sequential |
| --- | --- | --- |
| First planning revision | 1 | 1 |
| Same candidate action | yes | yes |
| Peer evidence advances during planning | yes | no |
| Boundary revision | 3 | 1 |
| Proposal fresh | **no** | **yes** |
| Attempt policy | `blocked — stale-plan` | `approved — fresh-bounded-evidence` |
| Bounded action crosses | **no** | **yes** |
| Mozaik boundary result | rewrite to `request_corroboration` | execute `targeted_canary_probe` |
| Later eventual evidence | same | same |
| Rollback authorized | no | no |

## Result

Concurrent responder progress advanced authoritative evidence while the planner was in flight, so the revision-1 bounded proposal was stale and could not execute. Serialization left that same proposal fresh at its boundary, so the bounded proposal crossed before the same later evidence exposed the wrong causal picture.

The concurrent stale proposal is rewritten to `request_corroboration`; a fresh replan at the current revision sees conflict and is also blocked. The serialized bounded proposal is fresh at its action boundary and crosses before the remaining responders publish the same eventual conflicting evidence.

## Scope

The provider-generated hypotheses are frozen from one authenticated historical receipt. This deterministic Mozaik replay changes scheduling, not live provider timing. The canary is a bounded proposal-only fixture and performs no production mutation; configured fixture timing is not a production-latency claim.
