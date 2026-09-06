import assert from "node:assert/strict"
import test from "node:test"
import {
  IncidentState,
  PLAN_STALE,
  ROLES,
  SafetyGateInterception,
  evaluateSafetyGate,
  overlapCount,
  parseModelHypothesis,
  requestCorroborationTool,
  runIncidentScenario,
  type Hypothesis,
  type Role,
} from "./app.js"
import { FunctionCallItem, FunctionCallOutputItem, GeminiGenerateContent, ModelContext, ModelMessageItem, SemanticEvent, UserMessageItem } from "@mozaik-ai/core"
import type { ExecutableTransition, InferenceInput, InferenceOutput, InferenceRunner } from "@mozaik-ai/core"
import { runSafetyStress } from "./safety-stress.js"
import { GeminiSignaturePreservingRunner } from "./gemini-compat.js"
import { runStalePlanAblation } from "./stale-plan.js"

function hypothesis(role: Role, confidence = 0.9, rootCause = "same-cause"): Hypothesis {
  return { role, claim: `${role} claim`, confidence, rootCause, atMs: 0 }
}

function rollbackTransition(callId: string): Extract<ExecutableTransition, { nextStateId: "function_call" }> {
  const call = FunctionCallItem.rehydrate({ callId, name: "rollback_production", args: "{}" })
  return { nextStateId: "function_call", input: { call, inferenceInput: {} as never } }
}

function canaryTransition(callId: string, targetCause = "same-cause"): Extract<ExecutableTransition, { nextStateId: "function_call" }> {
  const call = FunctionCallItem.rehydrate({
    callId,
    name: "targeted_canary_probe",
    args: JSON.stringify({ service: "checkout-api", targetCause, scope: "five-percent-diagnostic-canary" }),
  })
  return { nextStateId: "function_call", input: { call, inferenceInput: {} as never } }
}

function registerControllerAndStartPlan(state: IncidentState, id = "action-controller-id") {
  state.registerActionController(id)
  const plan = state.startPlan(id)
  assert.ok(plan)
  return { id, plan }
}

function normalizeHypotheses(report: Awaited<ReturnType<typeof runIncidentScenario>>) {
  return report.hypotheses
    .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
    .sort((a, b) => a.role.localeCompare(b.role))
}

test("canonical concurrent path reaches real Mozaik interception with complete conflicting evidence", async () => {
  const report = await runIncidentScenario({ dryRun: true })
  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.spans.length, 3)
  assert.equal(overlapCount(report), 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.contradictions, 2)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(report.action.hypothesesAtBoundary, 3)
  assert.equal(report.action.contradictionsAtBoundary, 2)
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, [])
  assert.equal(report.action.boundarySafeAction, "canary-with-targeted-corroboration")
  assert.equal(report.action.actionableSafePlan, "canary-with-targeted-corroboration")
  assert.ok(report.action.actionableSafePlanAtMs !== null)
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.adaptations.some((item) => item.includes("canary")), true)
  assert.equal(report.evidence.length, 2)
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.finished"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.function-call.started" && item.detail.includes("request_corroboration")))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)
})

test("pending investigation fails closed on the real sequential action path", async () => {
  const report = await runIncidentScenario({ dryRun: true, scheduleMode: "sequential", actionBoundaryMs: 205 })
  const snapshot = report.action.boundarySnapshot
  assert.ok(snapshot)
  assert.equal(snapshot.investigationDecision, "pending")
  assert.equal(snapshot.investigationReason, "pending-required-evidence")
  assert.equal(snapshot.decision, "blocked")
  assert.equal(snapshot.reason, "incomplete-required-evidence")
  assert.deepEqual(snapshot.availableRoles, ["trace"])
  assert.deepEqual(snapshot.missingRequiredRoles, ["dependency", "impact"])
  assert.equal(report.action.boundarySafeAction, "hold-for-missing-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.contradictions, 2)
  assert.equal(report.action.boundarySnapshot?.reason, "incomplete-required-evidence")
})

test("fixed-boundary ablation changes only scheduling while both arms fail closed", async () => {
  const shared = { dryRun: true, actionProposalMs: 45, actionBoundaryMs: 205 } as const
  const concurrent = await runIncidentScenario({ ...shared, scheduleMode: "concurrent" })
  const sequential = await runIncidentScenario({ ...shared, scheduleMode: "sequential" })

  assert.deepEqual(normalizeHypotheses(concurrent), normalizeHypotheses(sequential))
  assert.equal(concurrent.action.boundaryMs, sequential.action.boundaryMs)
  assert.equal(concurrent.action.requestedTool, sequential.action.requestedTool)
  assert.equal(concurrent.action.gateAtBoundary, "blocked")
  assert.equal(sequential.action.gateAtBoundary, "blocked")
  assert.equal(concurrent.action.executedTool, "request_corroboration")
  assert.equal(sequential.action.executedTool, "request_corroboration")

  assert.equal(concurrent.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(concurrent.action.boundarySafeAction, "canary-with-targeted-corroboration")
  assert.equal(sequential.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.equal(sequential.action.boundarySafeAction, "hold-for-missing-evidence")

  assert.equal(concurrent.action.hypothesesAtBoundary, 3)
  assert.equal(concurrent.action.contradictionsAtBoundary, 2)
  assert.equal(sequential.action.hypothesesAtBoundary, 1)
  assert.equal(sequential.action.contradictionsAtBoundary, 0)

  assert.ok(concurrent.action.actionableSafePlanAtMs !== null)
  assert.ok(sequential.action.actionableSafePlanAtMs !== null)
  assert.ok(
    concurrent.action.actionableSafePlanAtMs < sequential.action.actionableSafePlanAtMs,
    `expected concurrency to expose the actionable canary earlier: concurrent=${concurrent.action.actionableSafePlanAtMs}, sequential=${sequential.action.actionableSafePlanAtMs}`,
  )
})

test("gate policy distinguishes investigation waiting from fail-closed action decisions", () => {
  const unanimous = ROLES.map((role) => hypothesis(role, 0.9, "same-cause"))
  assert.deepEqual(evaluateSafetyGate(unanimous), {
    decision: "approved",
    reason: "sufficient-consistent-evidence",
    confidence: 0.9,
    contradictions: 0,
    availableRoles: ["trace", "dependency", "impact"],
    missingRequiredRoles: [],
  })

  const conflicting = [
    hypothesis("trace", 0.9, "cause-a"),
    hypothesis("dependency", 0.9, "cause-b"),
    hypothesis("impact", 0.9, "cause-a"),
  ]
  assert.equal(evaluateSafetyGate(conflicting).decision, "blocked")
  assert.equal(evaluateSafetyGate(conflicting).reason, "conflicting-evidence")

  const partial = [hypothesis("trace", 0.9, "cause-a")]
  assert.equal(evaluateSafetyGate(partial, [], "investigation").decision, "pending")
  assert.equal(evaluateSafetyGate(partial, [], "investigation").reason, "pending-required-evidence")
  assert.equal(evaluateSafetyGate(partial, [], "action-boundary").decision, "blocked")
  assert.equal(evaluateSafetyGate(partial, [], "action-boundary").reason, "incomplete-required-evidence")

  const weak = ROLES.map((role) => hypothesis(role, 0.7, "same-cause"))
  assert.equal(evaluateSafetyGate(weak).decision, "blocked")
  assert.equal(evaluateSafetyGate(weak).reason, "low-confidence-evidence")

  const weakOutlier = [
    hypothesis("trace", 1, "same-cause"),
    hypothesis("dependency", 1, "same-cause"),
    hypothesis("impact", 0.4, "same-cause"),
  ]
  assert.ok(Math.abs(evaluateSafetyGate(weakOutlier).confidence - 0.8) < 1e-12)
  assert.equal(evaluateSafetyGate(weakOutlier).decision, "blocked")
  assert.equal(evaluateSafetyGate(weakOutlier).reason, "low-confidence-evidence")
})

test("every non-empty missing-role combination fails closed with an explicit hold", () => {
  for (let mask = 1; mask < (1 << ROLES.length); mask += 1) {
    const missing = ROLES.filter((_, index) => (mask & (1 << index)) !== 0)
    const state = new IncidentState()
    for (const role of ROLES) state.registerResponder(role, `${role}-id`)
    for (const role of ROLES) {
      if (missing.includes(role)) continue
      assert.equal(state.acceptHypothesis(`${role}-id`, {
        role, claim: `${role} claim`, confidence: 0.9, rootCause: "same-cause",
      }).status, "accepted")
    }

    registerControllerAndStartPlan(state)
    const snapshot = state.captureActionBoundarySnapshot("rollback_production")
    assert.equal(snapshot.decision, "blocked")
    assert.equal(snapshot.reason, "incomplete-required-evidence")
    assert.deepEqual(snapshot.missingRequiredRoles, missing)
    assert.equal(snapshot.availableRoles.length + snapshot.missingRequiredRoles.length, ROLES.length)
    assert.equal(state.boundarySafeAction, "hold-for-missing-evidence")
  }
})

test("rollback interception requires affirmative approval, not mere absence of a block", async () => {
  const pendingState = new IncidentState()
  const pendingContext = registerControllerAndStartPlan(pendingState)
  const pendingGate = new SafetyGateInterception(pendingState, { producerId: pendingContext.id, planId: pendingContext.plan.planId })
  const pending = rollbackTransition("pending-rollback")
  assert.equal(pendingGate.isSatisfiedBy(pending), true)
  const rewrittenPending = await pendingGate.handle(pending)
  assert.equal((rewrittenPending as typeof pending).input.call.name, "request_corroboration")

  const blockedState = new IncidentState()
  blockedState.gateDecision = "blocked"
  blockedState.gateReason = "conflicting-evidence"
  assert.equal(new SafetyGateInterception(blockedState).isSatisfiedBy(rollbackTransition("blocked-rollback")), true)

  const approvedState = new IncidentState()
  approvedState.gateDecision = "approved"
  approvedState.gateReason = "sufficient-consistent-evidence"
  const approvedContext = registerControllerAndStartPlan(approvedState)
  const approvedGate = new SafetyGateInterception(approvedState, { producerId: approvedContext.id, planId: approvedContext.plan.planId })
  const approvedWithoutEvidence = rollbackTransition("approved-live-gate-only")
  assert.equal(approvedGate.isSatisfiedBy(approvedWithoutEvidence), true)
  const rewrittenApprovedWithoutSnapshot = await approvedGate.handle(approvedWithoutEvidence)
  assert.equal((rewrittenApprovedWithoutSnapshot as typeof approvedWithoutEvidence).input.call.name, "request_corroboration")
  assert.equal(approvedState.actionBoundarySnapshot?.decision, "blocked")

  const snapshotApprovedState = new IncidentState()
  for (const role of ROLES) {
    snapshotApprovedState.registerResponder(role, `${role}-id`)
    assert.equal(snapshotApprovedState.acceptHypothesis(`${role}-id`, {
      role, claim: `${role} claim`, confidence: 0.9, rootCause: "same-cause",
    }).status, "accepted")
  }
  const snapshotApprovedContext = registerControllerAndStartPlan(snapshotApprovedState)
  const approvedTransition = rollbackTransition("approved-snapshot")
  const snapshotApprovedGate = new SafetyGateInterception(snapshotApprovedState, {
    producerId: snapshotApprovedContext.id,
    planId: snapshotApprovedContext.plan.planId,
  })
  assert.equal(snapshotApprovedGate.isSatisfiedBy(approvedTransition), true)
  const passedApproved = await snapshotApprovedGate.handle(approvedTransition)
  assert.equal((passedApproved as typeof approvedTransition).input.call.name, "rollback_production")
  assert.equal(snapshotApprovedState.actionBoundarySnapshot?.decision, "approved")

  const safeCall = FunctionCallItem.rehydrate({ callId: "safe", name: "request_corroboration", args: "{}" })
  const safeTransition = { nextStateId: "function_call" as const, input: { call: safeCall, inferenceInput: {} as never } }
  assert.equal(pendingGate.isSatisfiedBy(safeTransition as Extract<ExecutableTransition, { nextStateId: "function_call" }>), false)

  const result = await requestCorroborationTool.invoke({ originalAction: "rollback_production", reason: "incomplete-required-evidence" }) as { status: string }
  assert.equal(result.status, "blocked-pending-corroboration")
})

test("action-boundary snapshot is immutable while late evidence updates investigation state", () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerResponder("impact", "impact-id")
  assert.equal(state.acceptHypothesis("trace-id", {
    role: "trace", claim: "trace claim", confidence: 0.9, rootCause: "cause-a",
  }).status, "accepted")

  registerControllerAndStartPlan(state)
  const snapshot = state.captureActionBoundarySnapshot("rollback_production")
  const serialized = JSON.stringify(snapshot)
  assert.equal(Object.isFrozen(snapshot), true)
  assert.equal(Object.isFrozen(snapshot.availableRoles), true)
  assert.equal(Object.isFrozen(snapshot.missingRequiredRoles), true)
  assert.equal(snapshot.decision, "blocked")
  assert.equal(snapshot.reason, "incomplete-required-evidence")

  assert.equal(state.acceptHypothesis("dependency-id", {
    role: "dependency", claim: "dependency claim", confidence: 0.9, rootCause: "cause-b",
  }).status, "late-accepted")
  assert.equal(state.acceptHypothesis("impact-id", {
    role: "impact", claim: "impact claim", confidence: 0.9, rootCause: "cause-c",
  }).status, "late-accepted")

  assert.equal(state.hypotheses.length, 3)
  assert.equal(state.contradictions, 2)
  assert.equal(JSON.stringify(snapshot), serialized)
  assert.deepEqual(snapshot.availableRoles, ["trace"])
  assert.deepEqual(snapshot.missingRequiredRoles, ["dependency", "impact"])
  assert.equal(evaluateSafetyGate(state.hypotheses).reason, "conflicting-evidence")
})

test("decision revision advances only for authoritative action-relevant mutations", () => {
  const state = new IncidentState()
  for (const role of ROLES) state.registerResponder(role, `${role}-id`)
  assert.equal(state.decisionRevision, 0)

  assert.equal(state.acceptHypothesis("trace-id", {
    role: "trace", claim: "authoritative", confidence: 0.9, rootCause: "cause-a",
  }).status, "accepted")
  assert.equal(state.decisionRevision, 1)

  assert.equal(state.acceptHypothesis("trace-id", {
    role: "trace", claim: "duplicate", confidence: 1, rootCause: "cause-b",
  }).status, "duplicate")
  assert.equal(state.acceptHypothesis("attacker", {
    role: "impact", claim: "spoof", confidence: 1, rootCause: "cause-z",
  }).status, "spoofed-role")
  assert.equal(state.decisionRevision, 1)
  assert.equal(state.markDegraded("impact", "attacker"), false)
  assert.equal(state.decisionRevision, 1)

  assert.equal(state.markDegraded("dependency"), true)
  assert.equal(state.decisionRevision, 2)
  assert.equal(state.markDegraded("dependency"), false)
  assert.equal(state.decisionRevision, 2)
  assert.equal(state.timeline.filter((item) => item.type === "incident.decision.revision-advanced").length, 2)
})

test("a plan freezes the revision and evidence it actually reasoned over", () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerActionController("controller-id")
  state.acceptHypothesis("trace-id", { role: "trace", claim: "trace", confidence: 0.9, rootCause: "cause-a" })
  const plan = state.startPlan("controller-id", "revision-one-plan")
  assert.ok(plan)
  assert.equal(plan.basedOnRevision, 1)
  assert.deepEqual(plan.availableRoles, ["trace"])
  assert.equal(Object.isFrozen(plan), true)
  assert.equal(Object.isFrozen(plan.hypotheses), true)

  state.acceptHypothesis("dependency-id", { role: "dependency", claim: "dependency", confidence: 0.9, rootCause: "cause-b" })
  assert.equal(state.decisionRevision, 2)
  assert.equal(plan.basedOnRevision, 1)
  assert.deepEqual(plan.availableRoles, ["trace"])
})

test("stale bounded and destructive proposals are both rewritten before execution", async () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerActionController("controller-id")
  state.acceptHypothesis("trace-id", { role: "trace", claim: "trace", confidence: 0.9, rootCause: "cause-a" })
  const plan = state.startPlan("controller-id", "stale-plan")
  assert.ok(plan)
  state.acceptHypothesis("dependency-id", { role: "dependency", claim: "dependency", confidence: 0.9, rootCause: "cause-b" })

  const interceptor = new SafetyGateInterception(state, { producerId: "controller-id", planId: plan.planId })
  const canary = await interceptor.handle(canaryTransition("stale-canary", "cause-a"))
  const rollback = await interceptor.handle(rollbackTransition("stale-rollback"))
  assert.equal((canary as ReturnType<typeof canaryTransition>).input.call.name, "request_corroboration")
  assert.equal((rollback as ReturnType<typeof rollbackTransition>).input.call.name, "request_corroboration")
  assert.equal(state.actionAttempts.length, 2)
  assert.ok(state.actionAttempts.every((attempt) => !attempt.fresh && attempt.policyReason === "stale-plan"))
  assert.equal(state.timeline.filter((item) => item.type === PLAN_STALE).length, 2)
})

test("a proposal cannot override the revision frozen into its registered plan", async () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerActionController("controller-id")
  state.acceptHypothesis("trace-id", { role: "trace", claim: "trace", confidence: 0.9, rootCause: "cause-a" })
  const plan = state.startPlan("controller-id", "truthful-plan")
  assert.ok(plan)
  state.acceptHypothesis("dependency-id", { role: "dependency", claim: "dependency", confidence: 0.9, rootCause: "cause-a" })

  const forgedCall = FunctionCallItem.rehydrate({
    callId: "lying-revision",
    name: "targeted_canary_probe",
    args: JSON.stringify({
      service: "checkout-api",
      targetCause: "cause-a",
      scope: "five-percent-diagnostic-canary",
      basedOnRevision: state.decisionRevision,
      planId: "forged-current-plan",
    }),
  })
  const forgedTransition = { nextStateId: "function_call" as const, input: { call: forgedCall, inferenceInput: {} as never } }
  const result = await new SafetyGateInterception(state, { producerId: "controller-id", planId: plan.planId })
    .handle(forgedTransition)
  assert.equal((result as typeof forgedTransition).input.call.name, "request_corroboration")
  assert.equal(state.actionBoundarySnapshot?.basedOnRevision, 1)
  assert.equal(state.actionBoundarySnapshot?.boundaryRevision, 2)
  assert.equal(state.actionBoundarySnapshot?.policyReason, "stale-plan")
})

test("fresh bounded policy allows a matching strong probe but rejects weak, conflicting, degraded, or mismatched evidence", async () => {
  const run = async (input: { confidence?: number; secondCause?: string; degraded?: boolean; target?: string }) => {
    const state = new IncidentState()
    state.registerResponder("trace", "trace-id")
    state.registerResponder("dependency", "dependency-id")
    state.registerActionController("controller-id")
    state.acceptHypothesis("trace-id", {
      role: "trace", claim: "trace", confidence: input.confidence ?? 0.9, rootCause: "cause-a",
    })
    if (input.secondCause !== undefined) {
      state.acceptHypothesis("dependency-id", {
        role: "dependency", claim: "dependency", confidence: 0.9, rootCause: input.secondCause,
      })
    }
    if (input.degraded) state.markDegraded("impact")
    const plan = state.startPlan("controller-id")
    assert.ok(plan)
    const transition = canaryTransition("bounded-policy", input.target ?? "cause-a")
    const result = await new SafetyGateInterception(state, { producerId: "controller-id", planId: plan.planId }).handle(transition)
    return { state, call: (result as typeof transition).input.call.name }
  }

  assert.equal((await run({})).call, "targeted_canary_probe")
  assert.equal((await run({ confidence: 0.79 })).call, "request_corroboration")
  assert.equal((await run({ secondCause: "cause-b" })).call, "request_corroboration")
  assert.equal((await run({ degraded: true })).call, "request_corroboration")
  assert.equal((await run({ target: "cause-z" })).call, "request_corroboration")
})

test("each action attempt receives a distinct frozen authorization record", async () => {
  const state = new IncidentState()
  for (const role of ROLES) {
    state.registerResponder(role, `${role}-id`)
    state.acceptHypothesis(`${role}-id`, { role, claim: role, confidence: 0.9, rootCause: "same-cause" })
  }
  const { id, plan } = registerControllerAndStartPlan(state)
  const interceptor = new SafetyGateInterception(state, { producerId: id, planId: plan.planId })
  await interceptor.handle(rollbackTransition("attempt-one"))
  const first = state.actionAttempts[0]
  const fingerprint = JSON.stringify(first)
  state.markDegraded("impact")
  await interceptor.handle(rollbackTransition("attempt-two"))
  const second = state.actionAttempts[1]

  assert.notEqual(first.attemptId, second.attemptId)
  assert.equal(first.policyDecision, "approved")
  assert.equal(second.policyDecision, "blocked")
  assert.equal(second.policyReason, "stale-plan")
  assert.equal(Object.isFrozen(first), true)
  assert.equal(JSON.stringify(first), fingerprint)
})

test("invalid Action Controller or plan provenance cannot authorize an action", async () => {
  const state = new IncidentState()
  for (const role of ROLES) {
    state.registerResponder(role, `${role}-id`)
    state.acceptHypothesis(`${role}-id`, { role, claim: role, confidence: 0.95, rootCause: "same-cause" })
  }
  state.registerActionController("real-controller")
  assert.equal(state.startPlan("attacker", "forged-plan"), null)
  const result = await new SafetyGateInterception(state, { producerId: "attacker", planId: "forged-plan" })
    .handle(rollbackTransition("forged-rollback"))
  assert.equal((result as ReturnType<typeof rollbackTransition>).input.call.name, "request_corroboration")
  assert.equal(state.actionBoundarySnapshot?.policyReason, "invalid-plan-provenance")
})

test("provider-derived stale-plan ablation changes only peer scheduling and proves the revision race", async () => {
  const evidence = [
    { role: "trace" as const, claim: "trace", confidence: 0.85, rootCause: "cause-a" },
    { role: "dependency" as const, claim: "dependency", confidence: 0.85, rootCause: "cause-b" },
    { role: "impact" as const, claim: "impact", confidence: 0.85, rootCause: "cause-c" },
  ]
  const report = await runStalePlanAblation({
    source: { receipt: "fixture", commit: "fixture", provider: "fixture", model: "fixture" },
    evidence,
  })
  assert.deepEqual(report.invariants, {
    sameEventualEvidence: true,
    sameFirstPlanningRevision: true,
    sameCandidateAction: true,
    concurrentProposalInvalidatedAsStale: true,
    concurrentFreshReplanSeesConflict: true,
    sequentialProposalCrossedWhileFresh: true,
    unauthorizedRollbackCrossings: 0,
    staleNonSafeCrossings: 0,
  })
  assert.equal(report.concurrent.boundaryRevision, 3)
  assert.equal(report.sequential.boundaryRevision, 1)
  assert.equal(report.concurrent.freshReplan?.policyReason, "conflicting-evidence")
})

test("degraded responders are closed for the current action phase", () => {
  const state = new IncidentState()
  state.registerResponder("dependency", "dependency-id")
  state.markDegraded("dependency")
  assert.equal(state.acceptHypothesis("dependency-id", {
    role: "dependency", claim: "late dependency claim", confidence: 1, rootCause: "same-cause",
  }).status, "closed-role")
  assert.equal(state.hypotheses.length, 0)
  assert.equal(evaluateSafetyGate(state.hypotheses, state.degradedRoles).decision, "blocked")
})

test("a required responder closing after evidence cannot leave rollback authorized", async () => {
  const state = new IncidentState()
  for (const role of ROLES) {
    state.registerResponder(role, `${role}-id`)
    state.acceptHypothesis(`${role}-id`, { role, claim: role, confidence: 0.95, rootCause: "same-cause" })
  }
  state.registerActionController("controller-id")
  assert.equal(evaluateSafetyGate(state.hypotheses, state.degradedRoles, "action-boundary").decision, "approved")
  assert.equal(state.markDegraded("impact"), true)
  assert.equal(evaluateSafetyGate(state.hypotheses, state.degradedRoles, "action-boundary").reason, "degraded-required-responder")
  const plan = state.startPlan("controller-id")
  assert.ok(plan)
  const result = await new SafetyGateInterception(state, { producerId: "controller-id", planId: plan.planId })
    .handle(rollbackTransition("closed-after-evidence"))
  assert.equal((result as ReturnType<typeof rollbackTransition>).input.call.name, "request_corroboration")
  assert.equal(state.actionBoundarySnapshot?.policyReason, "degraded-required-responder")
})

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

test("seeded adversarial ordering preserves snapshot authorization and closed-role invariants", async () => {
  for (let seed = 1; seed <= 500; seed += 1) {
    const random = seededRandom(seed)
    const state = new IncidentState()
    for (const role of ROLES) state.registerResponder(role, `${role}-id`)
    state.registerActionController("action-controller-id")

    const closedRole = random() < 0.45 ? ROLES[Math.floor(random() * ROLES.length)] : null
    if (closedRole !== null) state.markDegraded(closedRole)

    const roles = [...ROLES]
    for (let i = roles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1))
      ;[roles[i], roles[j]] = [roles[j], roles[i]]
    }

    const sameCause = random() < 0.5
    const confidences = new Map<Role, number>(ROLES.map((role) => [role, random() < 0.75 ? 0.8 + random() * 0.2 : random() * 0.79]))
    const captureAfter = Math.floor(random() * (ROLES.length + 1))
    let attemptedClosedRole = false

    for (let index = 0; index < roles.length; index += 1) {
      if (index === captureAfter) {
        state.startPlan("action-controller-id")
        state.captureActionBoundarySnapshot("rollback_production")
      }
      const role = roles[index]
      const result = state.acceptHypothesis(`${role}-id`, {
        role,
        claim: `${role} seed ${seed}`,
        confidence: confidences.get(role),
        rootCause: sameCause ? "same-cause" : `cause-${role}`,
      })
      if (role === closedRole) {
        attemptedClosedRole = true
        assert.equal(result.status, "closed-role", `seed=${seed}`)
      }
    }
    if (captureAfter === ROLES.length) {
      state.startPlan("action-controller-id")
      state.captureActionBoundarySnapshot("rollback_production")
    }

    // Deliberately corrupt the mutable investigation gate; authorization must still
    // be determined exclusively by the frozen action-boundary snapshot.
    state.gateDecision = "approved"
    state.gateReason = "sufficient-consistent-evidence"
    const transition = rollbackTransition(`seed-${seed}`)
    const activePlan = state.getActivePlan()
    assert.ok(activePlan, `seed=${seed}`)
    const result = await new SafetyGateInterception(state, {
      producerId: "action-controller-id",
      planId: activePlan.planId,
    }).handle(transition)
    const executed = (result as typeof transition).input.call.name
    const snapshot = state.actionBoundarySnapshot
    assert.ok(snapshot, `seed=${seed}`)
    assert.equal(executed === "rollback_production", snapshot.decision === "approved", `seed=${seed}`)
    if (closedRole !== null) {
      assert.equal(attemptedClosedRole, true, `seed=${seed}`)
      assert.equal(snapshot.availableRoles.includes(closedRole), false, `seed=${seed}`)
    }
  }
})

test("producer identity, unknown roles, and duplicate policy cannot alter safety aggregates", () => {
  const state = new IncidentState()
  state.registerResponder("trace", "trace-id")
  state.registerResponder("dependency", "dependency-id")
  state.registerResponder("impact", "impact-id")

  const trace = { role: "trace", claim: "trace claim", confidence: 0.9, rootCause: "cause-a" }
  assert.equal(state.acceptHypothesis("trace-id", trace).status, "accepted")
  assert.equal(state.acceptHypothesis("trace-id", { ...trace, confidence: 1, rootCause: "cause-b" }).status, "duplicate")
  assert.equal(state.acceptHypothesis("impact-id", { ...trace, confidence: 0.99 }).status, "spoofed-role")
  assert.equal(state.acceptHypothesis("attacker-id", {
    role: "unknown", claim: "spoof", confidence: 0.99, rootCause: "cause-z",
  }).status, "unknown-role")

  assert.equal(state.hypotheses.length, 1)
  assert.equal(state.confidence, 0.9)
  assert.equal(state.contradictions, 0)
  assert.equal(state.hypotheses[0].rootCause, "cause-a")
})

test("invalid confidence is rejected and can never improve the gate posture", () => {
  const badValues: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.2, 1.4, "0.9", undefined]
  for (const confidence of badValues) {
    const state = new IncidentState()
    state.registerResponder("dependency", "dependency-id")
    const result = state.acceptHypothesis("dependency-id", {
      role: "dependency", claim: "dependency claim", confidence, rootCause: "same-cause",
    })
    assert.equal(result.status, "malformed", `confidence=${String(confidence)}`)
    assert.equal(state.hypotheses.length, 0)
    assert.deepEqual(state.degradedRoles, ["dependency"])
    const boundary = evaluateSafetyGate(state.hypotheses, state.degradedRoles, "action-boundary")
    assert.equal(boundary.decision, "blocked")
    assert.equal(boundary.reason, "incomplete-required-evidence")
  }

  assert.equal(parseModelHypothesis({ answer: { content: { text: "not-json" } } }, "dependency"), null)
  assert.equal(parseModelHypothesis({
    answer: { content: { text: JSON.stringify({ claim: "bad", confidence: 2, rootCause: "cause" }) } },
  }, "dependency"), null)
})

test("valid structured model evidence preserves provider confidence and root cause", () => {
  const parsed = parseModelHypothesis({
    answer: { content: { text: JSON.stringify({ claim: "pool wait follows deploy", confidence: 0.83, rootCause: "deploy-pool-regression" }) } },
  }, "dependency")
  assert.deepEqual(parsed, {
    claim: "pool wait follows deploy",
    confidence: 0.83,
    rootCause: "deploy-pool-regression",
  })
})

test("Mozaik 4.0.5 Gemini mapper does not preserve thought signatures across tool calls", () => {
  const endpoint = new GeminiGenerateContent()
  const context = new ModelContext("thought-signature-regression", [
    UserMessageItem.rehydrate({ text: "choose a mitigation" }),
    FunctionCallItem.rehydrate({
      callId: "rollback-call",
      name: "rollback_production",
      args: JSON.stringify({ service: "checkout-api", reason: "test" }),
    }),
  ])
  const request = endpoint.endpointMapper.toRequest({
    model: "gemini-3.5-flash",
    context,
    tools: [],
  }) as { contents: Array<{ parts: Array<{ functionCall?: Record<string, unknown> }> }> }
  const functionCall = request.contents.at(-1)?.parts.at(-1)?.functionCall
  assert.deepEqual(functionCall, {
    id: "rollback-call",
    name: "rollback_production",
    args: { service: "checkout-api", reason: "test" },
  })
  assert.equal(functionCall && "thought_signature" in functionCall, false)
})

test("signature-preserving Gemini runner round-trips thought signatures locally", async () => {
  const requests: Array<{ contents: Array<{ parts: Array<{ functionCall?: Record<string, unknown>; thoughtSignature?: string }> }> }> = []
  const client = {
    models: {
      async generateContent(request: { contents: unknown[]; model: string; config: Record<string, unknown> }) {
        requests.push(request as typeof requests[number])
        return requests.length === 1
          ? { candidates: [{ content: { parts: [{ functionCall: { id: "call-1", name: "rollback_production", args: {} }, thoughtSignature: "signature-1" }] } }] }
          : { candidates: [{ content: { parts: [{ text: "safe recommendation" }] } }] }
      },
    },
  }
  const runner = new GeminiSignaturePreservingRunner(client)
  const firstContext = new ModelContext("compat-test", [UserMessageItem.create("choose a mitigation")])
  const first = await runner.run({ model: "gemini-3.5-flash", context: firstContext, tools: [] })
  assert.equal(first.items[0]?.type, "function_call")
  const secondContext = new ModelContext("compat-test", [
    UserMessageItem.create("choose a mitigation"),
    FunctionCallItem.rehydrate({ callId: "call-1", name: "rollback_production", args: "{}" }),
    FunctionCallOutputItem.create("call-1", JSON.stringify({ status: "blocked" })),
  ])
  const second = await runner.run({ model: "gemini-3.5-flash", context: secondContext, tools: [] })
  assert.equal(second.items[0]?.type, "message")
  const functionPart = requests[1]?.contents.flatMap((item) => item.parts).find((part) => part.functionCall)
  assert.equal(functionPart?.functionCall?.name, "rollback_production")
  assert.equal(functionPart?.thoughtSignature, "signature-1")
})

test("Gemini runner omits unsupported none thinking level", async () => {
  let config: Record<string, unknown> | undefined
  const client = {
    models: {
      async generateContent(request: { contents: unknown[]; model: string; config: Record<string, unknown> }) {
        config = request.config
        return { candidates: [{ content: { parts: [{ text: "ok" }] } }] }
      },
    },
  }
  const runner = new GeminiSignaturePreservingRunner(client)
  await runner.run({
    model: "gemini-3.5-flash",
    context: new ModelContext("thinking-level-test", [UserMessageItem.create("respond")]),
    tools: [],
    reasoningEffort: "none",
  })
  assert.equal("thinkingConfig" in (config ?? {}), false)
})

test("signature-preserving runner traverses the complete mocked provider Phase-2 loop", async () => {
  const client = {
    models: {
      async generateContent(request: { contents: unknown[] }) {
        const text = JSON.stringify(request.contents)
        if (text.includes("mitigation owner in IncidentMesh")) {
          const hasToolResult = text.includes("functionResponse")
          return hasToolResult
            ? { candidates: [{ content: { parts: [{ text: "keep rollback blocked; proceed with targeted corroboration" }] } }] }
            : { candidates: [{ content: { parts: [{ functionCall: { id: "phase2-call", name: "rollback_production", args: { service: "checkout-api", reason: "restore service" } }, thoughtSignature: "phase2-signature" }] } }] }
        }
        const role = text.includes("trace responder") ? "trace"
          : text.includes("dependency responder") ? "dependency"
            : "impact"
        const fixture = role === "trace"
          ? { claim: "trace sees cache churn", confidence: 0.85, rootCause: "cache-stampede" }
          : role === "dependency"
            ? { claim: "dependency sees deploy-linked pool wait", confidence: 0.82, rootCause: "deploy-8f3" }
            : { claim: "impact sees regional checkout failures", confidence: 0.88, rootCause: "regional-impact" }
        return { candidates: [{ content: { parts: [{ text: JSON.stringify(fixture) }] } }] }
      },
    },
  }
  const report = await runIncidentScenario({
    dryRun: false,
    model: "gemini-3.5-flash",
    inferenceRunner: new GeminiSignaturePreservingRunner(client),
    timeoutMs: 2_000,
  })
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.requestedTool, "rollback_production")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.match(report.action.modelRecommendation ?? "", /targeted corroboration/)
})

test("explicit Dependency timeout degrades the role and terminates through the safe tool", async () => {
  const report = await runIncidentScenario({ dryRun: true, simulateDependencyTimeout: true })
  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "incomplete-required-evidence")
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, ["dependency"])
  assert.equal(report.action.boundarySafeAction, "hold-for-missing-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.evidence.length, 1)
  assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.producer === "Dependency"))
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
})

class ScriptedTwoPhaseInferenceRunner implements InferenceRunner {
  readonly mitigationPrompts: string[] = []
  readonly phase1ToolNames: string[][] = []
  readonly reasoningEfforts: Array<string | undefined> = []

  constructor(
    private readonly hangDependency = false,
    private readonly consistentEvidence = false,
  ) {}

  async run(request: InferenceInput): Promise<InferenceOutput> {
    this.reasoningEfforts.push(request.reasoningEffort)
    const items = request.context.getItems()
    const userMessages = items.flatMap((item) => {
      const candidate = item as unknown as { role?: string; content?: { text?: unknown } }
      return candidate.role === "user" && typeof candidate.content?.text === "string" ? [candidate.content.text] : []
    })
    const prompt = userMessages.at(-1) ?? ""
    const hasToolOutput = items.some((item) => item.type === "function_call_output")

    if (prompt.includes("mitigation owner in IncidentMesh")) {
      if (!this.mitigationPrompts.includes(prompt)) this.mitigationPrompts.push(prompt)
      if (!hasToolOutput) {
        return {
          items: [FunctionCallItem.rehydrate({
            callId: "scripted-provider-rollback",
            name: "rollback_production",
            args: JSON.stringify({ service: "checkout-api", reason: "restore checkout quickly" }),
          })],
          tokenUsage: undefined,
          rowResponse: { fixture: "provider-phase-2-rollback" },
        }
      }
      return {
        items: [ModelMessageItem.rehydrate({ text: "Use a 5% canary only after the required corroboration is available." })],
        tokenUsage: undefined,
        rowResponse: { fixture: "provider-phase-2-recommendation" },
      }
    }

    const role = prompt.includes("trace responder") ? "trace"
      : prompt.includes("dependency responder") ? "dependency"
        : prompt.includes("impact responder") ? "impact"
          : null
    assert.ok(role, `unexpected scripted inference prompt: ${prompt}`)
    this.phase1ToolNames.push((request.tools ?? []).map((tool) => tool.name))

    if (role === "dependency" && this.hangDependency) {
      return await new Promise<InferenceOutput>(() => {})
    }

    const fixture = role === "trace"
      ? { claim: "trace sees cache churn", confidence: 0.85, rootCause: this.consistentEvidence ? "shared-cause" : "cache-stampede" }
      : role === "dependency"
        ? { claim: "dependency sees deploy-linked pool wait", confidence: 0.82, rootCause: this.consistentEvidence ? "shared-cause" : "deploy-8f3" }
        : { claim: "impact sees regional checkout failures", confidence: 0.88, rootCause: this.consistentEvidence ? "shared-cause" : "regional-impact" }
    return {
      items: [ModelMessageItem.rehydrate({ text: JSON.stringify(fixture) })],
      tokenUsage: undefined,
      rowResponse: { fixture: `provider-phase-1-${role}` },
    }
  }

  async *stream(request: InferenceInput): AsyncGenerator<SemanticEvent> {
    yield SemanticEvent.create("inference.output", "scripted-two-phase-runner", await this.run(request))
  }
}

test("phase-1-only model runs settle as soon as all provider hypotheses complete", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner()
  const report = await runIncidentScenario({
    dryRun: false,
    phase1Only: true,
    inferenceRunner: runner,
    timeoutMs: 2_000,
  })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
  assert.ok(report.elapsedMs < 2_000)
  assert.equal(runner.phase1ToolNames.length, 3)
  assert.deepEqual(runner.phase1ToolNames, [[], [], []])
})

test("opt-in reasoning effort is forwarded to every provider loop", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner()
  await runIncidentScenario({
    dryRun: false,
    phase1Only: true,
    reasoningEffort: "none",
    inferenceRunner: runner,
    timeoutMs: 2_000,
  })
  assert.deepEqual(runner.reasoningEfforts, ["none", "none", "none"])
})

test("two-phase scripted model integration traverses the real post-aggregation interceptor", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner()
  const report = await runIncidentScenario({ dryRun: false, inferenceRunner: runner, timeoutMs: 2_000 })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "conflicting-evidence")
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.requestedTool, "rollback_production")
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "conflicting-evidence")
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.equal(report.action.boundaryMs, null)
  assert.match(report.action.modelRecommendation ?? "", /5% canary/)
  assert.ok(report.timeline.some((item) => item.type === "incident.mitigation.phase-started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
  assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
  assert.ok(report.timeline.some((item) => item.type === "incident.action.safe-executed"))
  assert.equal(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"), false)

  assert.equal(runner.mitigationPrompts.length, 1)
  const mitigationPrompt = runner.mitigationPrompts[0]
  assert.match(mitigationPrompt, /cache-stampede/)
  assert.match(mitigationPrompt, /deploy-8f3/)
  assert.match(mitigationPrompt, /regional-impact/)
  assert.match(mitigationPrompt, /Safety Gate: blocked \(conflicting-evidence\)/)
})

test("approved evidence allows the proposal-only rollback path without rewrite", async () => {
  const report = await runIncidentScenario({
    dryRun: false,
    inferenceRunner: new ScriptedTwoPhaseInferenceRunner(false, true),
    timeoutMs: 2_000,
  })

  assert.equal(report.hypotheses.length, 3)
  assert.equal(report.gateDecision, "approved")
  assert.equal(report.gateReason, "sufficient-consistent-evidence")
  assert.equal(report.action.gateAtBoundary, "approved")
  assert.equal(report.action.intercepted, false)
  assert.equal(report.action.executedTool, "rollback_production")
  assert.equal(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"), false)
  assert.ok(report.timeline.some((item) => item.type === "incident.action.rollback-tool-executed"))
  assert.match(report.action.modelRecommendation ?? "", /5% canary/)
})

test("seeded safety stress preserves the affirmative-approval crossing invariant", async () => {
  const result = await runSafetyStress({ cases: 2_000, seed: 0x1cedb00c })
  assert.equal(result.cases, 2_000)
  assert.ok(result.approvedCrossings > 0)
  assert.ok(result.blockedRewrites > 0)
  assert.equal(result.unauthorizedRollbackCrossings, 0)
  assert.equal(result.staleNonSafeCrossings, 0)
  assert.equal(result.unauthorizedBoundedCrossings, 0)
  assert.equal(result.actionPolicyInvariantViolations, 0)
  assert.equal(result.attemptIsolationViolations, 0)
  assert.ok(result.stalePlanAttempts > 0)
  assert.equal(result.totalActionAttempts, 8_000)
  assert.equal(result.snapshotMutationViolations, 0)
  assert.deepEqual(result.invariantViolations, [])
})

test("phase-1-only degraded runs settle when the action-phase evidence window closes", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner(true)
  const report = await runIncidentScenario({
    dryRun: false,
    phase1Only: true,
    inferenceRunner: runner,
    timeoutMs: 1_000,
    evidenceDeadlineMs: 100,
  })

  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.deepEqual(report.hypotheses.map((item) => item.role).sort(), ["impact", "trace"])
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "incomplete-required-evidence")
  assert.equal(report.action.mitigationPhaseStarted, false)
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
  assert.ok(report.elapsedMs < 1_000)
})

test("a generally hanging required model responder degrades at the evidence deadline", async () => {
  const runner = new ScriptedTwoPhaseInferenceRunner(true)
  const report = await runIncidentScenario({
    dryRun: false,
    inferenceRunner: runner,
    timeoutMs: 1_500,
    evidenceDeadlineMs: 150,
  })

  assert.deepEqual(report.degradedRoles, ["dependency"])
  assert.deepEqual(report.hypotheses.map((item) => item.role).sort(), ["impact", "trace"])
  assert.equal(report.gateDecision, "blocked")
  assert.equal(report.gateReason, "incomplete-required-evidence")
  assert.equal(report.action.mitigationPhaseStarted, true)
  assert.equal(report.action.gateAtBoundary, "blocked")
  assert.equal(report.action.gateReasonAtBoundary, "incomplete-required-evidence")
  assert.deepEqual(report.action.boundarySnapshot?.missingRequiredRoles, ["dependency"])
  assert.equal(report.action.intercepted, true)
  assert.equal(report.action.executedTool, "request_corroboration")
  assert.ok(report.action.modelRecommendation)
  assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.detail.includes("evidence deadline")))
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), false)
})

test("an early scenario timeout returns a stable pending investigation snapshot", async () => {
  const report = await runIncidentScenario({ dryRun: true, timeoutMs: 150 })
  assert.equal(report.timeline.some((item) => item.type === "incident.scenario.timeout"), true)
  assert.equal(report.gateDecision, "pending")
  assert.equal(report.gateReason, "pending-required-evidence")
  assert.equal(report.hypotheses.length, 2)
  assert.equal(report.action.proposed, true)
  assert.equal(report.action.attemptedAtMs, null)
  assert.equal(report.action.boundarySnapshot, null)
  assert.equal(report.action.intercepted, false)
  assert.equal(report.action.executedTool, null)
  const snapshot = JSON.stringify(report)
  await new Promise((resolve) => setTimeout(resolve, 160))
  assert.equal(JSON.stringify(report), snapshot)
})
