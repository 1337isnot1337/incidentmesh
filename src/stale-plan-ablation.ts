import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runStalePlanAblation, type FrozenHypothesis } from "./stale-plan.js"

type ProviderReceipt = {
  schema: string
  commit: string
  provider: string
  model: string
  hypotheses: FrozenHypothesis[]
}

const receiptPath = resolve("docs/evidence/real-provider-run.json")
const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as ProviderReceipt
if (receipt.schema !== "incidentmesh.provider-evidence/v1") throw new Error("unexpected provider receipt schema")

const report = await runStalePlanAblation({
  source: {
    receipt: "docs/evidence/real-provider-run.json",
    commit: receipt.commit,
    provider: receipt.provider,
    model: receipt.model,
  },
  evidence: receipt.hypotheses,
})

const failed = Object.entries(report.invariants).filter(([, value]) => value !== true && value !== 0)
if (failed.length > 0) throw new Error(`stale-plan invariants failed: ${failed.map(([name]) => name).join(", ")}`)

const outputJson = resolve("docs/evidence/stale-plan-ablation.json")
const outputMd = resolve("docs/evidence/stale-plan-ablation.md")
const markdown = `# Stale-plan causal ablation\n\n` +
  `The exact hypotheses from the authenticated Google Gemini receipt are frozen. Both arms use the same incident, eventual evidence, confidence, planner, policy, action, target, and proposal boundary. **Only peer-evidence scheduling relative to the in-flight plan changes.**\n\n` +
  `- Source receipt: [real-provider-run.json](real-provider-run.json)\n` +
  `- Source commit: \`${report.source.commit}\`\n` +
  `- Provider/model: ${report.source.provider} / \`${report.source.model}\`\n` +
  `- Candidate: proposal-only bounded \`targeted_canary_probe\` targeting \`${report.fixedInputs.candidateTargetCause}\`\n\n` +
  `| | Concurrent | Sequential |\n| --- | --- | --- |\n` +
  `| First planning revision | ${report.concurrent.firstPlanningRevision} | ${report.sequential.firstPlanningRevision} |\n` +
  `| Same candidate action | yes | yes |\n` +
  `| Peer evidence advances during planning | yes | no |\n` +
  `| Boundary revision | ${report.concurrent.boundaryRevision} | ${report.sequential.boundaryRevision} |\n` +
  `| Proposal fresh | **${report.concurrent.proposalFresh ? "yes" : "no"}** | **${report.sequential.proposalFresh ? "yes" : "no"}** |\n` +
  `| Attempt policy | \`${report.concurrent.policyDecision} — ${report.concurrent.policyReason}\` | \`${report.sequential.policyDecision} — ${report.sequential.policyReason}\` |\n` +
  `| Bounded action crosses | **${report.concurrent.boundedActionCrossed ? "yes" : "no"}** | **${report.sequential.boundedActionCrossed ? "yes" : "no"}** |\n` +
  `| Mozaik boundary result | rewrite to \`${report.concurrent.executedAction}\` | execute \`${report.sequential.executedAction}\` |\n` +
  `| Later eventual evidence | same | same |\n` +
  `| Rollback authorized | no | no |\n\n` +
  `## Result\n\n${report.causalFinding}\n\n` +
  `The concurrent stale proposal is rewritten to \`request_corroboration\`; a fresh replan at the current revision sees conflict and is also blocked. The serialized bounded proposal is fresh at its action boundary and crosses before the remaining responders publish the same eventual conflicting evidence.\n\n` +
  `## Scope\n\n${report.limitation}\n`

await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8")
await writeFile(outputMd, markdown, "utf8")
console.log(JSON.stringify({ ...report, outputJson, outputMd }))
