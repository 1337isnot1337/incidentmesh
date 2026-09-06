import assert from "node:assert/strict"
import { runIncidentScenario } from "./app.js"

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
assert.equal(report.adaptations.length, 1)
assert.equal(report.evidence.length, 1)
assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.producer === "Dependency"))
assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.started"))
assert.ok(report.timeline.some((item) => item.type === "mozaik.interception.rewritten"))
assert.ok(report.evidence[0]?.startsWith("Trace "))

console.log(JSON.stringify({
  scenario: "dependency responder timeout",
  degradedRoles: report.degradedRoles,
  hypothesesAvailable: report.hypotheses.map((item) => item.role),
  gateAtBoundary: report.action.gateAtBoundary,
  gateReasonAtBoundary: report.action.gateReasonAtBoundary,
  missingRequiredRoles: report.action.boundarySnapshot?.missingRequiredRoles,
  safeActionAtBoundary: report.action.boundarySafeAction,
  intercepted: report.action.intercepted,
  executedTool: report.action.executedTool,
  finalGate: report.gateDecision,
  finalGateReason: report.gateReason,
  followupEvidence: report.evidence,
  finding: "Dependency is explicitly degraded after missing required evidence. The same fail-closed action policy intercepts rollback through Mozaik and requests surviving-signal corroboration instead of treating missing evidence as approval.",
}, null, 2))
