# Safe-action availability ablation

Same incident, eventual evidence, policy, rollback proposal, and configured 205 ms action boundary. **Only responder scheduling changes. Both arms fail closed.**

| | Concurrent | Sequential |
| --- | --- | --- |
| Hypotheses at boundary | 3 / 3 | 1 / 3 |
| Contradictions visible | 2 | 0 |
| Rollback decision | **blocked** | **blocked** |
| Gate reason | `conflicting-evidence` | `incomplete-required-evidence` |
| Safe plan at boundary | canary-with-targeted-corroboration | hold-for-missing-evidence |
| Executed tool | `request_corroboration` | `request_corroboration` |

Same evidence, gate, rollback proposal, and deadline. Parallel scheduling exposes the conflict before the boundary and makes the targeted canary plan actionable immediately; serialized scheduling leaves required evidence missing, so the same fail-closed gate holds the action until the conflict becomes visible later.

The rollback tool is proposal-only. The configured boundary and observed ordering are deterministic fixture behavior, not MTTR or a production speedup claim.
