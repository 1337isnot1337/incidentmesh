import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { runSafetyStress } from "./safety-stress.js"

const seed = Number.parseInt(process.env.SAFETY_STRESS_SEED ?? "1cedb00c", 16) >>> 0
const cases = Number.parseInt(process.env.SAFETY_STRESS_CASES ?? "10000", 10)
if (!Number.isInteger(cases) || cases <= 0) throw new Error("SAFETY_STRESS_CASES must be a positive integer")

const report = await runSafetyStress({ seed, cases })
const outputJson = resolve("docs/evidence/safety-stress.json")
const outputMd = resolve("docs/evidence/safety-stress.md")
const markdown = `# IncidentMesh seeded safety stress\n\n` +
  `Deterministic property-style execution over generated evidence schedules. No provider calls or wall-clock timers are used.\n\n` +
  `- Seed: \`${report.seed.toString(16)}\`\n` +
  `- Cases: ${report.cases}\n` +
  `- Approved boundary snapshots: ${report.approvedSnapshots}\n` +
  `- Blocked boundary snapshots: ${report.blockedSnapshots}\n` +
  `- Approved rollback crossings (proposal-only): ${report.approvedCrossings}\n` +
  `- Blocked rollback rewrites: ${report.blockedRewrites}\n` +
  `- Unauthorized rollback crossings: **${report.unauthorizedRollbackCrossings}**\n` +
  `- Snapshot mutation violations: **${report.snapshotMutationViolations}**\n` +
  `- Invariant violations: **${report.invariantViolations.length}**\n\n` +
  `The critical invariant is: an immutable action-boundary snapshot permits the rollback proposal only when its decision is affirmatively APPROVED; every other decision rewrites the proposal to \`request_corroboration\`.\n\n` +
  `Generated profiles: ${Object.entries(report.generatedProfiles).map(([name, count]) => `${name}=${count}`).join(", ")}.\n`

await mkdir(dirname(outputJson), { recursive: true })
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8")
await writeFile(outputMd, markdown, "utf8")
console.log(JSON.stringify({ ...report, outputJson, outputMd }))
