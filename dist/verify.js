import assert from "node:assert/strict";
import { overlapCount, runIncidentScenario } from "./app.js";
const report = await runIncidentScenario({ dryRun: true });
assert.equal(report.schema, "incidentmesh.report/v1");
assert.equal(report.hypotheses.length, 3);
assert.equal(overlapCount(report), 3);
assert.equal(report.gateDecision, "blocked");
assert.equal(report.evidence.length, 2);
console.log(JSON.stringify({ ok: true, schema: report.schema, overlapPairs: overlapCount(report), gate: report.gateDecision }));
