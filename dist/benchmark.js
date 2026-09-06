import { concurrencySpeedup, overlapCount, runIncidentScenario } from "./app.js";
const report = await runIncidentScenario({ dryRun: true });
const sumResponderDurationsMs = report.spans.reduce((sum, span) => sum + ((span.completedAtMs ?? 0) - span.startedAtMs), 0);
const concurrentStartMs = Math.min(...report.spans.map((span) => span.startedAtMs));
const concurrentEndMs = Math.max(...report.spans.map((span) => span.completedAtMs ?? span.startedAtMs));
const concurrentWallMs = concurrentEndMs - concurrentStartMs;
console.log(JSON.stringify({
    measurement: "responder overlap",
    concurrentWallMs,
    sumResponderDurationsMs,
    hypotheses: report.hypotheses.length,
    contradictions: report.contradictions,
    overlapPairs: overlapCount(report),
    latencyOverlapProxy: concurrencySpeedup(report),
    definition: "sum of measured responder durations / concurrent wall time",
    limitation: "Does not measure reasoning quality, throughput, MTTR, or production performance.",
}));
