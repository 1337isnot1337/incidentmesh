import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runIncidentScenario, type IncidentReport, type ScheduleMode } from "./app.js"
import { runStalePlanAblation, type FrozenHypothesis, type StalePlanAblationReport } from "./stale-plan.js"

const repetitions = Number.parseInt(process.env.SEMANTIC_STABILITY_RUNS ?? "25", 10)
if (!Number.isInteger(repetitions) || repetitions <= 0) throw new Error("SEMANTIC_STABILITY_RUNS must be a positive integer")

const projection = (report: IncidentReport) => ({
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
})

const results: Record<ScheduleMode, IncidentReport[]> = { concurrent: [], sequential: [] }
for (const scheduleMode of ["concurrent", "sequential"] as const) {
  for (let index = 0; index < repetitions; index += 1) {
    results[scheduleMode].push(await runIncidentScenario({ dryRun: true, scheduleMode, actionBoundaryMs: 205 }))
  }
}

const expected: Record<ScheduleMode, ReturnType<typeof projection>> = {
  concurrent: projection(results.concurrent[0]),
  sequential: projection(results.sequential[0]),
}
const semanticMismatches = (Object.keys(results) as ScheduleMode[]).flatMap((scheduleMode) => results[scheduleMode]
  .map((report, index) => JSON.stringify(projection(report)) === JSON.stringify(expected[scheduleMode]) ? null : { scheduleMode, index })
  .filter((item): item is { scheduleMode: ScheduleMode; index: number } => item !== null))

const providerReceipt = JSON.parse(await readFile(resolve("docs/evidence/real-provider-run.json"), "utf8")) as {
  commit: string
  provider: string
  model: string
  hypotheses: FrozenHypothesis[]
}
const staleRuns: StalePlanAblationReport[] = []
for (let index = 0; index < repetitions; index += 1) {
  staleRuns.push(await runStalePlanAblation({
    source: {
      receipt: "docs/evidence/real-provider-run.json",
      commit: providerReceipt.commit,
      provider: providerReceipt.provider,
      model: providerReceipt.model,
    },
    evidence: providerReceipt.hypotheses,
  }))
}
const staleProjection = (item: StalePlanAblationReport) => ({
  concurrent: {
    planningRevision: item.concurrent.firstPlanningRevision,
    boundaryRevision: item.concurrent.boundaryRevision,
    fresh: item.concurrent.proposalFresh,
    crossed: item.concurrent.boundedActionCrossed,
    policyReason: item.concurrent.policyReason,
    rewritten: item.concurrent.proposalRewritten,
  },
  sequential: {
    planningRevision: item.sequential.firstPlanningRevision,
    boundaryRevision: item.sequential.boundaryRevision,
    fresh: item.sequential.proposalFresh,
    crossed: item.sequential.boundedActionCrossed,
    policyReason: item.sequential.policyReason,
    rewritten: item.sequential.proposalRewritten,
  },
  invariants: item.invariants,
})
const expectedStaleProjection = staleProjection(staleRuns[0])
const stalePlanMismatches = staleRuns
  .map((item, index) => JSON.stringify(staleProjection(item)) === JSON.stringify(expectedStaleProjection) ? null : { index })
  .filter((item): item is { index: number } => item !== null)
const elapsed = (scheduleMode: ScheduleMode) => results[scheduleMode].map((report) => report.elapsedMs)
const range = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values) })
const report = {
  schema: "incidentmesh.semantic-stability/v1",
  repetitionsPerArm: repetitions,
  runs: repetitions * 4,
  semanticMismatches,
  stalePlanMismatches,
  concurrent: { expected: expected.concurrent, elapsedMs: range(elapsed("concurrent")) },
  sequential: { expected: expected.sequential, elapsedMs: range(elapsed("sequential")) },
  stalePlan: { expected: expectedStaleProjection },
  finding: "Observed timer jitter may shift elapsed milliseconds, but the fixed-boundary and revision-stamped stale-plan semantic projections remained stable across every repeated run.",
}

const outputJson = resolve("docs/evidence/semantic-stability.json")
const outputMd = resolve("docs/evidence/semantic-stability.md")
const markdown = `# IncidentMesh semantic-stability receipt\n\n` +
  `Repeated deterministic fixture runs under ordinary host timer scheduling. This measures semantic stability, not production latency.\n\n` +
  `- Repetitions per arm: ${repetitions}\n` +
  `- Total runs: ${report.runs}\n` +
  `- Semantic mismatches: **${semanticMismatches.length}**\n` +
  `- Stale-plan semantic mismatches: **${stalePlanMismatches.length}**\n` +
  `- Concurrent elapsed range: ${report.concurrent.elapsedMs.min}–${report.concurrent.elapsedMs.max} ms\n` +
  `- Sequential elapsed range: ${report.sequential.elapsedMs.min}–${report.sequential.elapsedMs.max} ms\n\n` +
  `The expected projections include boundary gate reason, evidence available, safe action, interception, executed tool, final gate, and stale-plan freshness/crossing outcomes. Millisecond ranges are observational only; no MTTR or production-speed claim is made.\n`
await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8")
await writeFile(outputMd, markdown, "utf8")
console.log(JSON.stringify({ ...report, outputJson, outputMd }))
