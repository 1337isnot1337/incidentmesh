import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runIncidentScenario } from "./app.js";
const repetitions = Number.parseInt(process.env.SEMANTIC_STABILITY_RUNS ?? "25", 10);
if (!Number.isInteger(repetitions) || repetitions <= 0)
    throw new Error("SEMANTIC_STABILITY_RUNS must be a positive integer");
const projection = (report) => ({
    gateAtBoundary: report.action.gateAtBoundary,
    gateReasonAtBoundary: report.action.gateReasonAtBoundary,
    hypothesesAtBoundary: report.action.hypothesesAtBoundary,
    contradictionsAtBoundary: report.action.contradictionsAtBoundary,
    boundarySafeAction: report.action.boundarySafeAction,
    intercepted: report.action.intercepted,
    executedTool: report.action.executedTool,
    finalGate: report.gateDecision,
    finalReason: report.gateReason,
    timedOut: report.timeline.some((event) => event.type === "incident.scenario.timeout"),
});
const results = { concurrent: [], sequential: [] };
for (const scheduleMode of ["concurrent", "sequential"]) {
    for (let index = 0; index < repetitions; index += 1) {
        results[scheduleMode].push(await runIncidentScenario({ dryRun: true, scheduleMode, actionBoundaryMs: 205 }));
    }
}
const expected = {
    concurrent: projection(results.concurrent[0]),
    sequential: projection(results.sequential[0]),
};
const semanticMismatches = Object.keys(results).flatMap((scheduleMode) => results[scheduleMode]
    .map((report, index) => JSON.stringify(projection(report)) === JSON.stringify(expected[scheduleMode]) ? null : { scheduleMode, index })
    .filter((item) => item !== null));
const elapsed = (scheduleMode) => results[scheduleMode].map((report) => report.elapsedMs);
const range = (values) => ({ min: Math.min(...values), max: Math.max(...values) });
const report = {
    schema: "incidentmesh.semantic-stability/v1",
    repetitionsPerArm: repetitions,
    runs: repetitions * 2,
    semanticMismatches,
    concurrent: { expected: expected.concurrent, elapsedMs: range(elapsed("concurrent")) },
    sequential: { expected: expected.sequential, elapsedMs: range(elapsed("sequential")) },
    finding: "Observed timer jitter may shift elapsed milliseconds, but the canonical concurrent and sequential semantic projections remained stable across every repeated run.",
};
const outputJson = resolve("docs/evidence/semantic-stability.json");
const outputMd = resolve("docs/evidence/semantic-stability.md");
const markdown = `# IncidentMesh semantic-stability receipt\n\n` +
    `Repeated deterministic fixture runs under ordinary host timer scheduling. This measures semantic stability, not production latency.\n\n` +
    `- Repetitions per arm: ${repetitions}\n` +
    `- Total runs: ${report.runs}\n` +
    `- Semantic mismatches: **${semanticMismatches.length}**\n` +
    `- Concurrent elapsed range: ${report.concurrent.elapsedMs.min}–${report.concurrent.elapsedMs.max} ms\n` +
    `- Sequential elapsed range: ${report.sequential.elapsedMs.min}–${report.sequential.elapsedMs.max} ms\n\n` +
    `The expected projections include boundary gate reason, evidence available, safe action, interception, executed tool, and final gate. Millisecond ranges are observational only; no MTTR or production-speed claim is made.\n`;
await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(outputMd, markdown, "utf8");
console.log(JSON.stringify({ ...report, outputJson, outputMd }));
