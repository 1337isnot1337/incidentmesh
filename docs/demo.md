# IncidentMesh — 80-second judge recording plan

The video has one central idea: other agents changed the evidence while the Action Controller was thinking, so IncidentMesh knew its plan was no longer valid.

## 0–9 seconds — problem

**Visual:** `docs/gallery/jigjoy-01-cover.png`, full frame.

> Incident response gets dangerous when partial evidence can trigger action. IncidentMesh runs independent investigators concurrently and versions the evidence behind every mitigation plan.

## 9–31 seconds — stale-plan causal race

**Visual:** `docs/evidence/stale-plan-ablation.md`, tightly cropped to the comparison table, or settled output from `npm run ablation:stale-plan`.

> Both Action Controllers begin the same bounded plan at revision one. Concurrently, Dependency and Impact finish while that planner is running, advancing authoritative state to revision three. When the revision-one proposal returns, IncidentMesh marks it stale, Mozaik rewrites it to corroboration, and a fresh replan sees the conflict. Serialized peers have not advanced state, so that same bounded proposal is still fresh and crosses before the identical later evidence arrives.

Keep these rows readable:

```text
                         CONCURRENT     SEQUENTIAL
planning revision        1              1
boundary revision        3              1
proposal fresh           no             yes
bounded action crosses   no             yes
later evidence           same           same
```

The bounded canary is proposal-only. Never describe this as serialized rollback crossing.

## 31–47 seconds — authenticated provider execution

**Visual:** `docs/evidence/real-provider-run.md`, cropped to provider/model, overlap, and Phase-2 result.

> The inputs are not invented for the counterfactual. This historical authenticated Gemini Flash-Lite run records three real responder calls overlapping for 1,389 milliseconds. It then records Gemini proposing rollback, real SafetyGateInterception, request_corroboration executing, and a provider follow-up.

Do not imply that the historical provider run used the later revision architecture. Its structured hypotheses are frozen and replayed by the final runtime.

## 47–62 seconds — hard action boundary

**Visual:** stable lines from:

```bash
npm run demo | grep -E 'action boundary|interception|rollback_production|request_corroboration|safe-executed'
```

> Every bounded or destructive proposal gets its own immutable attempt snapshot. Rollback passes only when that specific snapshot is fresh and affirmatively approved. Here conflicting evidence blocks it, Mozaik rewrites it, and the safe tool executes. No fixture touches production.

## 62–74 seconds — adversarial proof and symmetry

**Visual:** `docs/evidence/safety-stress.md`, cropped to counts and zeros.

> This is not an always-block gate. Complete consistent evidence passes the proposal-only rollback path. Across 10,000 seeded schedules and 40,000 independent attempts, unauthorized rollback crossings, stale non-safe crossings, policy mismatches, and snapshot mutations are all zero.

## 74–82 seconds — close

**Visual:** return to the cover or the stale-plan table.

> Concurrency does not just make IncidentMesh faster. It changes which decisions are still valid.

## Recording discipline

Pre-run terminal commands. Narrate only after output is stable. Keep tool names and revision rows legible. If the cut is long, remove pauses before speaking faster. Do not add an architecture tour, install sequence, benchmark, or extra scenario.

Never claim real production mutation, production readiness, MTTR improvement, dynamic mutation of in-flight prompts, or that sequential scheduling permits destructive rollback.
