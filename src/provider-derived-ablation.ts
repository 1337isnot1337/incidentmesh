import { readFile, writeFile } from "node:fs/promises"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runIncidentScenario, ROLES, type Hypothesis, type IncidentReport, type Role } from "./app.js"

type ProviderReceipt = {
  schema: string
  commit: string
  provider: string
  model: string
  hypotheses: Array<Pick<Hypothesis, "role" | "claim" | "confidence" | "rootCause">>
}

const sourcePath = resolve("docs/evidence/real-provider-run.json")
const source = JSON.parse(await readFile(sourcePath, "utf8")) as ProviderReceipt
if (source.schema !== "incidentmesh.provider-evidence/v1" || source.provider !== "google") {
  throw new Error("provider-derived ablation requires the committed Google provider receipt")
}
if (source.hypotheses.length !== ROLES.length || !ROLES.every((role) => source.hypotheses.some((item) => item.role === role))) {
  throw new Error("provider receipt must contain exactly one hypothesis for each responder role")
}

const evidenceOverride = Object.fromEntries(source.hypotheses.map((item) => [item.role, {
  claim: item.claim,
  confidence: item.confidence,
  rootCause: item.rootCause,
}])) as Partial<Record<Role, Pick<Hypothesis, "claim" | "confidence" | "rootCause">>>

const run = (scheduleMode: "concurrent" | "sequential"): Promise<IncidentReport> => runIncidentScenario({
  dryRun: true,
  scheduleMode,
  actionProposalMs: 45,
  actionBoundaryMs: 205,
  evidenceOverride,
})

const concurrent = await run("concurrent")
const sequential = await run("sequential")
const normalize = (report: IncidentReport) => report.hypotheses
  .map(({ role, claim, confidence, rootCause }) => ({ role, claim, confidence, rootCause }))
  .sort((a, b) => a.role.localeCompare(b.role))

const report = {
  schema: "incidentmesh.provider-derived-ablation/v1",
  source: {
    receipt: "docs/evidence/real-provider-run.json",
    commit: source.commit,
    provider: source.provider,
    model: source.model,
  },
  fixedInputs: {
    incident: concurrent.incident,
    evidence: normalize(concurrent),
    proposedAction: concurrent.action.requestedTool,
    actionBoundaryMs: concurrent.action.boundaryMs,
    gatePolicy: "rollback crosses only on affirmative approval; incomplete or conflicting evidence blocks",
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
  },
  sequential: {
    hypothesesAtBoundary: sequential.action.hypothesesAtBoundary,
    contradictionsAtBoundary: sequential.action.contradictionsAtBoundary,
    gateAtBoundary: sequential.action.gateAtBoundary,
    gateReasonAtBoundary: sequential.action.gateReasonAtBoundary,
    safeActionAtBoundary: sequential.action.boundarySafeAction,
    intercepted: sequential.action.intercepted,
    executedTool: sequential.action.executedTool,
  },
  hypothesesStableAcrossArms: JSON.stringify(normalize(concurrent)) === JSON.stringify(normalize(sequential)),
  unauthorizedRollbackCrossing: concurrent.action.executedTool === "rollback_production" || sequential.action.executedTool === "rollback_production",
  limitation: "Provider hypotheses are frozen from one authenticated receipt; scheduling is replayed deterministically and does not claim the live provider calls were deterministically scheduled.",
}

const markdown = `# Provider-derived causal ablation\n\n` +
  `This replay freezes the exact structured hypotheses from the authenticated Google Gemini receipt and changes only responder scheduling. It does not rerun or reschedule the live provider calls.\n\n` +
  `- Source receipt: [real-provider-run.json](real-provider-run.json)\n` +
  `- Source commit: \`${source.commit}\`\n` +
  `- Provider/model: ${source.provider} / \`${source.model}\`\n` +
  `- Changed variable: evidence scheduling only\n` +
  `- Hypotheses stable across arms: **${report.hypothesesStableAcrossArms ? "yes" : "no"}**\n` +
  `- Unauthorized rollback crossing: **${report.unauthorizedRollbackCrossing ? "yes" : "no"}**\n\n` +
  `## Results\n\n` +
  `| | Concurrent | Sequential |\n| --- | --- | --- |\n` +
  `| Hypotheses at boundary | ${concurrent.action.hypothesesAtBoundary} | ${sequential.action.hypothesesAtBoundary} |\n` +
  `| Contradictions at boundary | ${concurrent.action.contradictionsAtBoundary} | ${sequential.action.contradictionsAtBoundary} |\n` +
  `| Boundary decision | **${concurrent.action.gateAtBoundary}** | **${sequential.action.gateAtBoundary}** |\n` +
  `| Boundary reason | \`${concurrent.action.gateReasonAtBoundary}\` | \`${sequential.action.gateReasonAtBoundary}\` |\n` +
  `| Safe action | ${concurrent.action.boundarySafeAction} | ${sequential.action.boundarySafeAction} |\n` +
  `| Rollback interception | ${concurrent.action.intercepted ? "yes" : "no"} | ${sequential.action.intercepted ? "yes" : "no"} |\n\n` +
  `Both arms remain fail-closed. The concurrent arm has complete contradictory evidence at the fixed boundary and can select targeted corroboration; the sequential arm has incomplete required evidence at that same boundary and must hold for the missing signal.\n`

const outputJson = resolve("docs/evidence/provider-derived-ablation.json")
const outputMd = resolve("docs/evidence/provider-derived-ablation.md")
await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8")
await writeFile(outputMd, markdown, "utf8")
console.log(JSON.stringify({ ...report, outputJson, outputMd }))
