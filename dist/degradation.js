import assert from "node:assert/strict";
import { runIncidentScenario } from "./app.js";
const report = await runIncidentScenario({ dryRun: true, simulateDependencyTimeout: true });
assert.deepEqual(report.degradedRoles, ["dependency"]);
assert.equal(report.hypotheses.length, 2);
assert.equal(report.action.gateAtBoundary, "blocked");
assert.equal(report.action.intercepted, true);
assert.equal(report.action.executedTool, "request_corroboration");
assert.equal(report.gateDecision, "blocked");
assert.equal(report.adaptations.length, 1);
assert.equal(report.evidence.length, 1);
assert.ok(report.timeline.some((item) => item.type === "incident.responder.degraded" && item.producer === "Dependency"));
assert.ok(report.evidence[0]?.startsWith("Trace "));
console.log(JSON.stringify({
    scenario: "dependency responder timeout",
    degradedRoles: report.degradedRoles,
    hypothesesAvailable: report.hypotheses.map((item) => item.role),
    gateAtBoundary: report.action.gateAtBoundary,
    intercepted: report.action.intercepted,
    executedTool: report.action.executedTool,
    finalGate: report.gateDecision,
    followupEvidence: report.evidence,
    finding: "Known missing Dependency evidence is explicit shared state, so the Safety Gate fails closed and rollback remains intercepted while surviving responders continue.",
}, null, 2));
