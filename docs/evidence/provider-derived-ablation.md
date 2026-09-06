# Provider-derived causal ablation

This replay freezes the exact structured hypotheses from the authenticated Google Gemini receipt and changes only responder scheduling. It does not rerun or reschedule the live provider calls.

- Source receipt: [real-provider-run.json](real-provider-run.json)
- Source commit: `65d98f8feda666932fcbace88037c7009b487a35`
- Provider/model: google / `gemini-3.5-flash-lite`
- Changed variable: evidence scheduling only
- Hypotheses stable across arms: **yes**
- Unauthorized rollback crossing: **no**

## Results

| | Concurrent | Sequential |
| --- | --- | --- |
| Hypotheses at boundary | 3 | 1 |
| Contradictions at boundary | 2 | 0 |
| Boundary decision | **blocked** | **blocked** |
| Boundary reason | `conflicting-evidence` | `incomplete-required-evidence` |
| Safe action | canary-with-targeted-corroboration | hold-for-missing-evidence |
| Rollback interception | yes | yes |

Both arms remain fail-closed. The concurrent arm has complete contradictory evidence at the fixed boundary and can select targeted corroboration; the sequential arm has incomplete required evidence at that same boundary and must hold for the missing signal.
