import { runIncidentScenario } from "./app.js"

const report = await runIncidentScenario({ dryRun: true })
console.log(JSON.stringify({ event: "incidentmesh.replay", report }))
