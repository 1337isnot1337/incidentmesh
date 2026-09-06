import { runIncidentScenario } from "./app.js"

const env = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}
const dryRun = env.DRY_RUN !== "0" && env.RUN_MODEL !== "1"
const report = await runIncidentScenario({ dryRun, model: env.MODEL ?? "gpt-5.5" })
console.log(JSON.stringify(report))
