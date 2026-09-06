# Degradation safety receipt

A required Dependency responder is closed after its evidence deadline. Missing evidence is not approval.

- Degraded required role: `dependency`
- Available hypotheses: trace, impact
- Immutable boundary decision: **blocked — incomplete-required-evidence**
- Missing role: `dependency`
- Mozaik boundary result: `rollback_production` → `request_corroboration`
- Final gate: **blocked — incomplete-required-evidence**

Dependency is explicitly degraded after missing required evidence. The same fail-closed action policy intercepts rollback through Mozaik and requests surviving-signal corroboration instead of treating missing evidence as approval.
