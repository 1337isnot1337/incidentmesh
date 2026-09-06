import { concurrencySpeedup, runIncidentScenario } from "./app.js";
const report = await runIncidentScenario({ dryRun: true });
const sequentialEstimateMs = report.spans.reduce((sum, span) => sum + ((span.completedAtMs ?? 0) - span.startedAtMs), 0);
const concurrentWallMs = Math.max(...report.spans.map((span) => span.completedAtMs ?? 0));
console.log(JSON.stringify({
    task: "same three-signal incident investigation",
    concurrent: { wallMs: concurrentWallMs, hypotheses: report.hypotheses.length, overlapPairs: report.spans.length },
    sequentialBaseline: { estimatedWallMs: sequentialEstimateMs, hypotheses: report.hypotheses.length },
    speedupProxy: concurrencySpeedup(report),
    note: "Sequential baseline is the sum of the same measured responder work intervals; no quality claim is inferred from latency alone.",
}));
