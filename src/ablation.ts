import assert from "node:assert/strict"
import { runIncidentScenario } from "./app.js"

const boundaryMs = 205
const shared = { dryRun: true, actionProposalMs: 45, actionBoundaryMs: boundaryMs } as const

const concurrent = await runIncidentScenario({ ...shared, scheduleMode: "concurrent" })
const sequential = await runIncidentScenario({ ...shared, scheduleMode: "sequential" })

const normalizeEvidence = (report: typeof concurrent) => report.hypotheses
  .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
  .sort((a, b) => a.role.localeCompare(b.role))

assert.deepEqual(normalizeEvidence(concurrent), normalizeEvidence(sequential))
assert.equal(concurrent.action.boundaryMs, sequential.action.boundaryMs)
assert.equal(concurrent.action.requestedTool, sequential.action.requestedTool)
assert.equal(concurrent.confidence, sequential.confidence)
assert.equal(concurrent.contradictions, sequential.contradictions)
assert.equal(concurrent.gateDecision, "blocked")
assert.equal(sequential.gateDecision, "blocked")

assert.equal(concurrent.action.gateAtBoundary, "blocked")
assert.equal(concurrent.action.gateReasonAtBoundary, "conflicting-evidence")
assert.equal(concurrent.action.hypothesesAtBoundary, 3)
assert.equal(concurrent.action.contradictionsAtBoundary, 2)
assert.equal(concurrent.action.boundarySafeAction, "canary-with-targeted-corroboration")
assert.equal(concurrent.action.intercepted, true)
assert.equal(concurrent.action.executedTool, "request_corroboration")

assert.equal(sequential.action.gateAtBoundary, "blocked")
assert.equal(sequential.action.gateReasonAtBoundary, "incomplete-required-evidence")
assert.equal(sequential.action.hypothesesAtBoundary, 1)
assert.equal(sequential.action.contradictionsAtBoundary, 0)
assert.equal(sequential.action.boundarySafeAction, "hold-for-missing-evidence")
assert.equal(sequential.action.intercepted, true)
assert.equal(sequential.action.executedTool, "request_corroboration")

assert.ok(concurrent.action.actionableSafePlanAtMs !== null)
assert.ok(sequential.action.actionableSafePlanAtMs !== null)
assert.ok(concurrent.action.actionableSafePlanAtMs < sequential.action.actionableSafePlanAtMs)

const result = {
  experiment: "fail-closed action-boundary evidence scheduling ablation",
  constants: {
    incident: concurrent.incident,
    evidence: normalizeEvidence(concurrent),
    gatePolicy: "rollback may cross only on affirmative approval; incomplete required evidence blocks at the action boundary; complete contradictory evidence blocks for conflict",
    proposedAction: concurrent.action.requestedTool,
    actionBoundaryMs: boundaryMs,
  },
  changedVariable: "evidence scheduling only",
  concurrent: {
    hypothesesAtBoundary: concurrent.action.hypothesesAtBoundary,
    contradictionsAtBoundary: concurrent.action.contradictionsAtBoundary,
    gateAtBoundary: concurrent.action.gateAtBoundary,
    gateReasonAtBoundary: concurrent.action.gateReasonAtBoundary,
    safeActionAtBoundary: concurrent.action.boundarySafeAction,
    intercepted: concurrent.action.intercepted,
    executedTool: concurrent.action.executedTool,
    timeToActionableSafeMitigationMs: concurrent.action.actionableSafePlanAtMs,
    finalGate: concurrent.gateDecision,
    finalGateReason: concurrent.gateReason,
  },
  sequential: {
    hypothesesAtBoundary: sequential.action.hypothesesAtBoundary,
    contradictionsAtBoundary: sequential.action.contradictionsAtBoundary,
    gateAtBoundary: sequential.action.gateAtBoundary,
    gateReasonAtBoundary: sequential.action.gateReasonAtBoundary,
    safeActionAtBoundary: sequential.action.boundarySafeAction,
    intercepted: sequential.action.intercepted,
    executedTool: sequential.action.executedTool,
    timeToActionableSafeMitigationMs: sequential.action.actionableSafePlanAtMs,
    finalGate: sequential.gateDecision,
    finalGateReason: sequential.gateReason,
  },
  causalFinding: "Same evidence, gate, rollback proposal, and deadline. Parallel scheduling exposes the conflict before the boundary and makes the targeted canary plan actionable immediately; serialized scheduling leaves required evidence missing, so the same fail-closed gate holds the action until the conflict becomes visible later.",
  limitation: "The rollback tool is proposal-only. Time-to-actionable-safe-mitigation is a deterministic fixture latency, not MTTR or a production speedup claim.",
}

console.log(JSON.stringify(result, null, 2))
