import { concurrencySpeedup, overlapCount, runIncidentScenario } from "./app.js"

const report = await runIncidentScenario({ dryRun: true })
const sequentialEstimateMs = report.spans.reduce((sum, span) => sum + ((span.completedAtMs ?? 0) - span.startedAtMs), 0)
const concurrentStartMs = Math.min(...report.spans.map((span) => span.startedAtMs))
const concurrentEndMs = Math.max(...report.spans.map((span) => span.completedAtMs ?? span.startedAtMs))
const concurrentWallMs = concurrentEndMs - concurrentStartMs
console.log(JSON.stringify({
  task: "same three-signal incident investigation",
  concurrent: { wallMs: concurrentWallMs, hypotheses: report.hypotheses.length, overlapPairs: overlapCount(report) },
  sequentialBaseline: { estimatedWallMs: sequentialEstimateMs, hypotheses: report.hypotheses.length },
  speedupProxy: concurrencySpeedup(report),
  note: "Sequential baseline is the sum of the same measured responder work intervals; no quality claim is inferred from latency alone.",
}))
